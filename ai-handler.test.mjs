import assert from 'node:assert/strict';
import test from 'node:test';
import { createAIHandler } from './ai-handler.mjs';

function fixture(overrides = {}) {
  const calls = { provider: [], users: [], usage: [], logs: [] };
  const config = { url: 'https://example.test', anonKey: 'public', serviceKey: 'server', apiKey: 'provider', ...overrides.config };
  const logger = { warn: (...a) => calls.logs.push(a), error: (...a) => calls.logs.push(a) };
  const createClient = (url, key, options) => key === 'public' ? {
    auth: { getUser: async token => { calls.users.push(token); return overrides.auth ?? { data: { user: { id: 'u1' } } }; } },
  } : { from: () => ({
    select: () => ({ eq: () => ({ gte: async () => overrides.quota ?? { count: 0 } }) }),
    insert: async row => { calls.usage.push(row); return {}; },
  }) };
  const fetchImpl = async (url, opts) => {
    calls.provider.push({ url, opts });
    if (overrides.fetch) return overrides.fetch(url, opts);
    return Response.json({ content: [{ type: 'text', text: '{"items":[{"name":"Chiller"}]}' }], usage: { input_tokens: 12 }, ...overrides.output });
  };
  const handler = createAIHandler({ createClient, config, fetchImpl, logger, timeoutMs: overrides.timeoutMs ?? 1000 });
  const request = (body = { prompt: 'Read the equipment' }, auth = 'Bearer user-jwt') => handler(new Request('https://example.test/ai', { method: 'POST', headers: auth ? { Authorization: auth } : {}, body: JSON.stringify(body) }));
  return { handler, request, calls };
}
test('missing provider configuration returns a readable CORS error without any downstream call', async () => {
  const f = fixture({ config: { apiKey: '' } }); const res = await f.request();
  assert.equal(res.status, 503); assert.equal((await res.json()).code, 'ai_not_configured');
  assert.equal(res.headers.get('access-control-allow-origin'), '*'); assert.equal(f.calls.users.length, 0); assert.equal(f.calls.provider.length, 0);
});
test('preflight works, missing or invalid user is rejected before inference', async () => {
  const f = fixture({ auth: { data: { user: null }, error: {} } });
  assert.equal((await f.handler(new Request('https://example.test', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await f.request(undefined, '')).status, 401); assert.equal((await f.request()).status, 401);
  assert.deepEqual(f.calls.users, ['user-jwt']); assert.equal(f.calls.provider.length, 0);
});
test('quota exhaustion and quota query failure both prevent inference', async () => {
  for (const [quota, expected] of [[{ count: 40 }, 429], [{ error: { message: 'private database detail' } }, 503]]) {
    const f = fixture({ quota }); assert.equal((await f.request()).status, expected); assert.equal(f.calls.provider.length, 0);
    assert.ok(!JSON.stringify(f.calls.logs).includes('private database detail'));
  }
});
test('images and requested token budget reach provider; structured result and usage return', async () => {
  const f = fixture(); const images = [{ media_type: 'image/jpeg', data: 'cGhvdG8=' }];
  const res = await f.request({ prompt: 'Read the equipment', images, kind: 'equipment-intake', max_tokens: 8000 });
  assert.equal(res.status, 200); assert.equal((await res.json()).json.items[0].name, 'Chiller');
  const sent = JSON.parse(f.calls.provider[0].opts.body);
  assert.equal(sent.max_tokens, 8000); assert.equal(sent.messages[0].content[0].source.data, images[0].data);
  assert.equal(f.calls.usage[0].kind, 'equipment-intake'); assert.equal(f.calls.usage[0].owner, 'u1');
});
test('invalid images are rejected without silently discarding pages', async () => {
  const f = fixture();
  assert.equal((await f.request({ prompt: 'Read the equipment', images: Array(5).fill({ media_type: 'image/jpeg', data: 'x' }) })).status, 400);
  assert.equal(f.calls.provider.length, 0);
});
test('provider errors never leak its response body', async () => {
  for (const [status, expected, code] of [[401, 502, 'provider_unavailable'], [429, 429, 'rate_limited'], [529, 429, 'rate_limited']]) {
    const f = fixture({ fetch: async () => new Response('private provider detail', { status }) });
    const res = await f.request(); assert.equal(res.status, expected); assert.equal((await res.json()).code, code);
    assert.ok(!JSON.stringify(f.calls.logs).includes('private provider detail'));
  }
});
test('deadline aborts stalled provider and returns a CORS timeout', async () => {
  let signal;
  const f = fixture({ timeoutMs: 20, fetch: async (_, opts) => { signal = opts.signal; return new Promise(() => {}); } });
  const res = await f.request(); assert.equal(res.status, 504); assert.equal((await res.json()).code, 'timeout');
  assert.equal(res.headers.get('access-control-allow-origin'), '*'); assert.equal(signal.aborted, true); assert.equal(f.calls.usage.length, 0);
  assert.deepEqual(f.calls.logs, [['ai_timeout', { stage: 'provider' }]]);
});
test('network failures, truncated output and invalid JSON are readable errors', async () => {
  for (const options of [{ fetch: async () => { throw new Error('private network detail'); } }, { output: { stop_reason: 'max_tokens' } }, { output: { content: [{ type: 'text', text: 'oops' }] } }]) {
    const f = fixture(options); const res = await f.request(); assert.equal(res.status, 502);
    assert.ok(['provider_unavailable', 'invalid_response'].includes((await res.json()).code));
    assert.ok(!JSON.stringify(f.calls.logs).includes('private network detail'));
  }
});
