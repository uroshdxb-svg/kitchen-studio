import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./analytics.js', import.meta.url), 'utf8');
function visit({ key = '0'.repeat(32), path = '/', host = 'kitchenstudio.design', navigator = {}, excluded = false, failInit = false, search = '?email=private@example.com', country = 'KW', failCountry = false, storedUserId } = {}) {
  const calls = [], scripts = [], saved = new Map(excluded ? [['KS_analytics_disabled', '1']] : []);
  let userId = storedUserId, deviceId = 'browser-1', resetCount = 0;
  const window = { amplitude: {
    add: plugin => { window.plugin = plugin; },
    init: (...args) => { calls.push(['init', ...args]); return { promise: failInit ? Promise.reject(new Error('offline')) : Promise.resolve() }; },
    track: (...args) => calls.push(['track', ...args, {userId,deviceId}]),
    setOptOut: flag => calls.push(['optOut', flag]),
    getUserId: () => userId,
    setUserId: id => { userId=id; calls.push(['setUserId',id]); },
    reset: () => { userId=undefined; deviceId='reset-'+(++resetCount); calls.push(['reset']); },
    Identify: class { constructor(){this.properties={};} set(key,value){this.properties[key]=value;return this;} },
    identify: traits => calls.push(['identify',traits.properties])
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
  assert.equal(v.calls.find(c=>c[0]==='track')[2].referrer_host, 'www.google.com');
  assert.equal(v.calls.find(c=>c[0]==='track')[2].measurement_version, 2, 'additive profile tracking preserves existing report filters');
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
  assert.equal(v.calls.find(c=>c[0]==='track')[2].country_code,'KW');
  assert.equal(v.calls.find(c=>c[0]==='track')[2].internal_test,true);
  const event=await v.window.plugin.execute({event_type:'session_start'});
  assert.equal(event.event_properties.internal_test,true);
  for(const options of [{country:'XX'},{country:'private'},{failCountry:true}]) {
    const v=visit(options);await v.scripts[0].onload();
    assert.equal(v.calls.find(c=>c[0]==='track')[2].country_code,'Unknown');
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

const accountA='48f54a0e-cf55-49be-826e-a0db292ef302', accountB='3b69e999-a071-4a8b-91d7-798ef7e12b8c';
const profileA={country_code:'AE',professional_role:'chef',use_case:'new_opening'};

test('identity and safe profile supplied before SDK loading are applied to initial and later events', async () => {
  const v=visit(),a=v.window.KS_analytics;
  a.identify(accountA,{...profileA,email:'private@example.com',display_name:'private'});
  a.track('Export Generated',{format:'pdf',reason:'export',email:'private'});
  await v.scripts[0].onload();
  const events=v.calls.filter(c=>c[0]==='track');
  for(const event of events){
    assert.equal(event[3].userId,accountA);
    assert.equal(event[2].account_status,'signed_in');
    assert.equal(event[2].profile_country_code,'AE');
    assert.equal(event[2].country_code,'KW');
    assert.equal(event[2].professional_role,'chef');
    assert.equal(event[2].use_case,'new_opening');
  }
  assert.equal(v.calls[0][2].optOut,true);
  assert.ok(v.calls.findIndex(c=>c[0]==='setUserId')<v.calls.findIndex(c=>c[0]==='optOut'&&c[1]===false));
  assert.equal(JSON.stringify(v.calls).includes('private'),false);
});

test('signed-out browser and direct account switching cannot retain previous identity or traits', async () => {
  const v=visit({storedUserId:accountA}),a=v.window.KS_analytics;
  await v.scripts[0].onload();
  let event=v.calls.filter(c=>c[0]==='track').at(-1);
  assert.equal(event[3].userId,undefined);
  assert.equal(event[2].account_status,'guest');
  assert.equal(event[3].deviceId,'reset-1');
  a.identify(accountA,profileA);a.track('Project Saved',{storage:'cloud'});
  const saved=v.calls.filter(c=>c[0]==='track').at(-1);
  a.reset();a.track('Feature Gated',{feature:'export'});
  const guestEvent=v.calls.filter(c=>c[0]==='track').at(-1);
  assert.equal(guestEvent[2].professional_role,'unknown');
  assert.notEqual(guestEvent[3].deviceId,saved[3].deviceId);
  a.identify(accountB,{country_code:'GB',professional_role:'supplier',use_case:'equipment_sales'});
  a.track('Project Created',{storage:'cloud'});
  const second=v.calls.filter(c=>c[0]==='track').at(-1);
  assert.equal(second[3].userId,accountB);
  a.identify(accountA,profileA);a.track('Export Generated',{format:'csv'});
  const switched=v.calls.filter(c=>c[0]==='track').at(-1);
  assert.notEqual(switched[3].deviceId,second[3].deviceId);
  assert.equal(switched[3].userId,accountA);
});

test('loading queue retains each actions identity and does not rewrite earlier profiles on signout', async () => {
  const v=visit(),a=v.window.KS_analytics;
  a.track('Guest Trial Started');
  a.identify(accountA,profileA);a.track('Project Saved',{storage:'cloud'});
  a.reset();a.track('Feature Gated',{feature:'export',reason:'export'});
  a.identify(accountB,{professional_role:'owner',use_case:'redesign',country_code:'RS'});
  a.track('Export Generated',{format:'svg'});
  await v.scripts[0].onload();
  const events=v.calls.filter(c=>c[0]==='track');
  const saved=events.find(c=>c[1]==='Kitchen Studio Project Saved');
  const gated=events.find(c=>c[1]==='Kitchen Studio Feature Gated');
  const exported=events.find(c=>c[1]==='Kitchen Studio Export Generated');
  assert.equal(saved[3].userId,accountA);assert.equal(saved[2].professional_role,'chef');
  assert.equal(gated[3].userId,undefined);assert.equal(gated[2].professional_role,'unknown');
  assert.equal(exported[3].userId,accountB);assert.equal(exported[2].professional_role,'owner');
  const enriched=await v.window.plugin.execute({event_properties:saved[2]});
  assert.equal(enriched.event_properties.professional_role,'chef');
});

test('onboarding events accept only controlled enums and reject email-shaped identities', async () => {
  const v=visit(),a=v.window.KS_analytics;
  a.identify('private@example.com',profileA);
  a.identify(accountA,{country_code:'private',professional_role:'private',use_case:'private',email:'private'});
  for(const event of ['Signup Prompt Viewed','Signup Prompt Dismissed','Sign In Requested','Sign In Completed','Profile Completed','Feature Gated','Guest Trial Started','Guest Trial Expired']) {
    a.track(event,{feature:'custom_equipment',reason:'trial_expired',action:'email',arbitrary:'private'});
  }
  a.track('Feature Gated',{feature:'private',reason:'private',action:'private'});
  await v.scripts[0].onload();
  const events=v.calls.filter(c=>c[0]==='track');
  assert.equal(events.at(-1)[2].feature,undefined);
  assert.equal(events.at(-1)[2].professional_role,'unknown');
  assert.equal(events.at(-1)[2].profile_country_code,'Unknown');
  assert.equal(events.at(-1)[2].use_case,'unknown');
  assert.equal(JSON.stringify(v.calls).includes('private'),false);
  a.excludeThisBrowser();const calls=v.calls.length;
  a.identify(accountB,profileA);a.reset();a.track('Profile Completed');
  assert.equal(v.calls.length,calls);
});
