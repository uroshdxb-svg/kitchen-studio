import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./analytics.js', import.meta.url), 'utf8');
function visit({ key = '0'.repeat(32), path = '/', host = 'kitchenstudio.design', navigator = {}, excluded = false, failInit = false } = {}) {
  const calls = [], scripts = [], saved = new Map(excluded ? [['KS_analytics_disabled', '1']] : []);
  const window = { amplitude: {
    init: (...args) => { calls.push(['init', ...args]); return { promise: failInit ? Promise.reject(new Error('offline')) : Promise.resolve() }; },
    track: (...args) => calls.push(['track', ...args]),
    setOptOut: flag => calls.push(['optOut', flag])
  } };
  const context = vm.createContext({ window,
    location: { protocol: 'https:', hostname: host, pathname: path, search: '?email=private@example.com', hash: '#access_token=private' },
    navigator, URL,
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) },
    document: { currentScript: { dataset: { amplitudeKey: key } },
      referrer: 'https://www.google.com/search?q=private',
      createElement: () => ({}), head: { appendChild: s => scripts.push(s) } }
  });
  vm.runInContext(source, context);
  return { window, calls, scripts, saved, context };
}

test('production traffic initializes once, with only allowlisted event properties', async () => {
  const v = visit({ path: '/app/' });
  assert.equal(v.scripts.length, 1);
  assert.equal(v.scripts[0].referrerPolicy, 'no-referrer');
  await v.scripts[0].onload();
  assert.equal(v.window.KS_analytics.state, 'active');
  assert.equal(v.calls[0][2].identityStorage, 'localStorage');
  assert.equal(v.calls[0][2].autocapture.formInteractions, false);
  assert.equal(v.calls[0][2].trackingOptions.ipAddress, false);
  assert.equal(v.calls[0][2].remoteConfig.fetchRemoteConfig, false);
  assert.equal(v.calls[0][2].enableDiagnostics, false);
  assert.deepEqual(v.calls.filter(c => c[0] === 'track').map(c => c[1]), ['Kitchen Studio Page Viewed', 'Kitchen Studio Builder Opened']);
  assert.equal(v.calls[1][2].referrer_host, 'www.google.com');
  assert.equal(JSON.stringify(v.calls).includes('private'), false);
  vm.runInContext(source, v.context);
  assert.equal(v.scripts.length, 1);
});

test('missing configuration, previews, automation, and privacy preferences send nothing', () => {
  for (const options of [{key:''}, {host:'localhost'}, {host:'preview.workers.dev'}, {navigator:{webdriver:true}}, {navigator:{doNotTrack:'1'}}, {navigator:{globalPrivacyControl:true}}, {excluded:true}, {path:'/oauth/consent'}, {path:'/connect/'}]) {
    const v = visit(options);
    assert.equal(v.scripts.length, 0, JSON.stringify(options));
    assert.equal(v.calls.length, 0);
  }
});

test('shared kitchens and unknown routes cannot leak identifiers in analytics', async () => {
  for (const path of ['/k/customer-secret-kitchen', '/customer-private-name/']) {
    const v = visit({path});
    await v.scripts[0].onload();
    assert.equal(JSON.stringify(v.calls).includes('customer'), false);
  }
});

test('a blocked script or failing SDK leaves the planner running', async () => {
  const blocked = visit();
  blocked.scripts[0].onerror();
  assert.equal(blocked.window.KS_analytics.state, 'blocked');
  const failing = visit({ failInit:true });
  await failing.scripts[0].onload();
  assert.equal(failing.window.KS_analytics.state, 'blocked');
  assert.equal(failing.calls.filter(c => c[0] === 'track').length, 0);
});

test('owner can exclude this browser, including while the SDK is loading', async () => {
  const v = visit();
  v.window.KS_analytics.excludeThisBrowser();
  await v.scripts[0].onload();
  assert.equal(v.saved.get('KS_analytics_disabled'), '1');
  assert.equal(v.calls.filter(c => c[0] === 'track').length, 0);
  assert.equal(v.window.KS_analytics.state, 'excluded');
});
