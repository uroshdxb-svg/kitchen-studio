import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('./cloud.js', import.meta.url), 'utf8');
async function backend(invoke, fastTimer = false) {
  const window = { KS_CONFIG: { supabaseUrl: 'https://example.test', supabaseAnonKey: 'public' }, supabase: { createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }), onAuthStateChange: () => {} },
    functions: { invoke },
  }) } };
  vm.runInNewContext(source, { window, URLSearchParams, AbortController, location: { origin: 'https://example.test' },
    fetch: async () => Response.json({ external: {} }), setTimeout: fastTimer ? fn => setTimeout(fn, 15) : setTimeout, clearTimeout });
  await window.KS_backend.ready; return window.KS_backend;
}
test('real cloud wrapper decodes Supabase HTTP error bodies, including legacy configuration errors', async () => {
  for (const [status, payload, code, message] of [
    [500, { error: 'AI is not configured on the server', code: 'failed' }, 'ai_not_configured', /not configured/],
    [503, { code: 'ai_not_configured' }, 'ai_not_configured', /not configured/],
    [401, {}, 'not_granted', /Sign in again/],
    [429, {}, 'rate_limited', /daily limit/],
    [504, { code: 'timeout' }, 'timeout', /took too long/],
    [502, { code: 'provider_unavailable' }, 'provider_unavailable', /provider is unavailable/],
  ]) {
    const b = await backend(async () => ({ error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: Response.json(payload, { status }) } }));
    await assert.rejects(b.ai('Read equipment'), e => e.code === code && message.test(e.message));
  }
});
test('network failures and malformed success responses are actionable', async () => {
  const b = await backend(async () => ({ error: { name: 'FunctionsFetchError' } }));
  await assert.rejects(b.ai('Read equipment'), e => e.code === 'unreachable');
  const c = await backend(async () => ({ data: {} }));
  await assert.rejects(c.ai('Read equipment'), e => e.code === 'invalid_response');
});
test('stalled browser invocation aborts and rejects on deadline', async () => {
  let signal; const b = await backend(async (_, opts) => { signal = opts.signal; return new Promise(() => {}); }, true);
  await assert.rejects(b.ai('Read equipment'), e => e.code === 'timeout' && /file is still selected/.test(e.message));
  assert.equal(signal.aborted, true);
});
test('successful extraction and image options are preserved', async () => {
  let sent; const result = { items: [{ name: 'Chiller' }] };
  const b = await backend(async (_, opts) => { sent = opts; return { data: { json: result } }; });
  assert.deepEqual(await b.ai('Read equipment', { images: [{ data: 'image' }], kind: 'equipment-intake' }), result);
  assert.equal(sent.body.images[0].data, 'image'); assert.equal(sent.body.kind, 'equipment-intake');
});
