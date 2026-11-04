import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./analytics.js', import.meta.url), 'utf8');
function visit({ key = '0'.repeat(32), path = '/', host = 'kitchenstudio.design', navigator = {}, excluded = false, failInit = false, search = '?email=private@example.com', country = 'KW', failCountry = false } = {}) {
  const calls = [], scripts = [], saved = new Map(excluded ? [['KS_analytics_disabled', '1']] : []);
  const window = { amplitude: {
    add: plugin => { window.plugin = plugin; },
    init: (...args) => { calls.push(['init', ...args]); return { promise: failInit ? Promise.reject(new Error('offline')) : Promise.resolve() }; },
    track: (...args) => calls.push(['track', ...args]),
    setOptOut: flag => calls.push(['optOut', flag])
  } };
  const context = vm.createContext({ window,
    location: { protocol: 'https:', hostname: host, pathname: path, search, hash: '#access_token=private' },
    navigator, URL, URLSearchParams, setTimeout, clearTimeout,
    fetch: async () => { if(failCountry) throw new Error('offline'); return {ok:true,json:async()=>({country_code:country})}; },
    sessionStorage: {getItem:()=>null,setItem:()=>{}},
    localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v), removeItem:k=>saved.delete(k) },
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
  assert.equal(v.calls[0][2].autocapture.pageUrlEnrichment, false);
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


test('country and test markers accompany events including SDK sessions', async () => {
  const v=visit({search:'?analytics_test=1'});await v.scripts[0].onload();
  assert.equal(v.calls[1][2].country_code,'KW');
  assert.equal(v.calls[1][2].internal_test,true);
  const event=await v.window.plugin.execute({event_type:'session_start'});
  assert.equal(event.event_properties.internal_test,true);
  for(const options of [{country:'XX'},{country:'private'},{failCountry:true}]) {
    const v=visit(options);await v.scripts[0].onload();
    assert.equal(v.calls[1][2].country_code,'Unknown');
    assert.equal(v.window.KS_analytics.state,'active');
  }
});

test('early actions queue once, redact arbitrary content, and stop after exclusion', async () => {
  const v=visit({path:'/app/'}),track=v.window.KS_analytics.track;
  track('App Engaged');track('App Engaged');
  track('Equipment Added',{source:'catalogue',quantity:2,name:'private kitchen',email:'private'});
  track('Unknown Event',{source:'catalogue'});
  await v.scripts[0].onload();track('App Engaged');
  const events=v.calls.filter(c=>c[0]==='track');
  assert.equal(events.filter(c=>c[1]==='Kitchen Studio App Engaged').length,1);
  assert.equal(events.at(-1)[2].quantity,2);
  assert.equal(JSON.stringify(events).includes('private'),false);
  v.window.KS_analytics.excludeThisBrowser();track('Export Generated',{format:'pdf'});
  assert.equal(v.calls.filter(c=>c[0]==='track').length,events.length);
});

test('owner exclusion link prevents even the initial page view', () => {
  const v=visit({search:'?analytics_exclude=1'});
  assert.equal(v.scripts.length,0);assert.equal(v.saved.get('KS_analytics_disabled'),'1');
  const resumed=visit({search:'?analytics_exclude=0',excluded:true});
  assert.equal(resumed.scripts.length,1);assert.equal(resumed.saved.has('KS_analytics_disabled'),false);
});

test('country endpoint never exposes IP or caches one visitors country for another', async () => {
  const {default:worker}=await import('./worker.js');
  for(const [value,expected] of [['KW','KW'],['XX','Unknown'],[undefined,'Unknown'],['invalid','Unknown']]) {
    const request=new Request('https://kitchenstudio.design/analytics-country');
    request.cf={country:value,city:'Private City',latitude:'1.234',longitude:'2.345'};
    const response=await worker.fetch(request,{});
    assert.deepEqual(await response.json(),{country_code:expected});
    assert.match(response.headers.get('cache-control'),/no-store/);
  }
});
