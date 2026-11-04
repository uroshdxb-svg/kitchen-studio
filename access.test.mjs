import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=readFileSync(new URL('./access.js',import.meta.url),'utf8');
const NOW=1793779200000,USER={id:'11111111-1111-4111-8111-111111111111',email:'chef@example.com',email_confirmed_at:'2026-11-01T00:00:00Z'},PROFILE={country_code:'AE',professional_role:'chef',use_case:'new_opening'};
function harness({saved=new Map(),backend={},now=NOW}={}){
  const calls=[],nodes=new Map(),timers=new Map();let timerId=0;
  function node(){return {hidden:false,open:false,isConnected:true,innerHTML:'',value:'',setAttribute(){},addEventListener(){},querySelector(){return node();},showModal(){this.open=true;},close(){this.open=false;},remove(){},focus(){},reportValidity(){return true;}};}
  const storage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  const document={body:{appendChild(el){nodes.set(el.id,el);}},createElement:node,querySelector:()=>null,getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},activeElement:node()};
  const window={document,location:{pathname:'/app/',href:'https://kitchenstudio.design/app/'},localStorage:storage,KS_analytics:{identify:(...a)=>calls.push(['identify',...a]),reset:()=>calls.push(['reset'])}};
  vm.runInNewContext(source,{window,Intl,Date,setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setInterval:()=>1,clearInterval:()=>{}});
  const access=window.KS_createAccess({backend,clock:()=>now,storage,measure:(name,props)=>calls.push([name,props])});
  return {window,access,policy:window.KS_accessPolicy,calls,saved,nodes,timers,runTimers:()=>{const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn());},advance:ms=>now+=ms};
}

test('exports, online saves and MCP require a confirmed account with valid profile',()=>{
  const {policy:p}=harness(),trial=p.newTrial(NOW);
  for(const feature of ['export','save','mcp']){
    assert.equal(p.allowed(feature,null,null,trial,NOW),false,feature+' guest blocked');
    assert.equal(p.allowed(feature,USER,PROFILE,trial,NOW),true,feature+' complete account allowed');
    assert.equal(p.allowed(feature,{...USER,email_confirmed_at:null},PROFILE,trial,NOW),false);
    assert.equal(p.allowed(feature,{...USER,is_anonymous:true},PROFILE,trial,NOW),false);
    assert.equal(p.allowed(feature,USER,{...PROFILE,professional_role:'invented'},trial,NOW),false);
    assert.equal(p.allowed(feature,USER,{...PROFILE,country_code:'XX'},trial,NOW),false);
    assert.equal(p.allowed(feature,USER,{...PROFILE,use_case:''},trial,NOW),false);
  }
});

test('custom equipment guest access expires at exactly 72 hours; signed-in users stay unlocked',()=>{
  const {policy:p}=harness(),trial=p.newTrial(NOW);
  assert.equal(p.allowed('custom_equipment',null,null,trial,NOW+p.TRIAL-1),true);
  assert.equal(p.allowed('custom_equipment',null,null,trial,NOW+p.TRIAL),false);
  assert.equal(p.allowed('custom_equipment',USER,PROFILE,trial,NOW+p.TRIAL*3),true);
});

test('invalid or future trial records expire safely; clock rollback cannot restore access',()=>{
  const {policy:p}=harness();
  for(const value of [{},{startedAt:NOW+1,lastSeenAt:NOW+1},{startedAt:'junk',lastSeenAt:NOW}])assert.equal(p.expired(p.normalizeTrial(value,NOW),NOW),true);
  const trial=p.normalizeTrial({startedAt:NOW-p.TRIAL,lastSeenAt:NOW},NOW);
  assert.equal(p.expired(trial,NOW-p.DAY),true);
});

test('engagement nudge starts after three actions and respects a full-day cooldown',()=>{
  const {policy:p}=harness(),trial=p.newTrial(NOW);
  trial.actions=2;assert.equal(p.shouldNudge(trial,NOW),false);
  trial.actions=3;assert.equal(p.shouldNudge(trial,NOW),true);
  trial.promptAt=NOW;assert.equal(p.shouldNudge(trial,NOW+p.DAY-1),false);
  assert.equal(p.shouldNudge(trial,NOW+p.DAY),true);
});

test('guest page visits preserve analytics identity and the original trial start',async()=>{
  const saved=new Map(),a=harness({saved});await a.access.start();
  assert.equal(a.calls.filter(c=>c[0]==='reset').length,0);
  assert.equal(a.calls.filter(c=>c[0]==='Guest Trial Started').length,1);
  const b=harness({saved,now:NOW+1000});await b.access.start();
  assert.equal(b.access.trial().startedAt,NOW);
  assert.equal(b.calls.filter(c=>c[0]==='Guest Trial Started').length,0);
  assert.equal(b.calls.filter(c=>c[0]==='reset').length,0);
  a.access.destroy();b.access.destroy();
});

test('an account change invalidates earlier profile responses and resets only on actual sign-out',async()=>{
  let resolveProfile;
  const h=harness({backend:{getProfile:()=>new Promise(r=>resolveProfile=r)}});
  const loading=h.access.authChanged(USER);await h.access.authChanged(null);resolveProfile(PROFILE);await loading;
  assert.equal(h.access.isReady(),false);
  assert.equal(h.access.profile(),null);
  assert.equal(h.calls.filter(c=>c[0]==='reset').length,1);
  await h.access.authChanged(null);
  assert.equal(h.calls.filter(c=>c[0]==='reset').length,1);
  h.access.destroy();
});

test('sign-in return hydrates only matching email profile, before conversion events',async()=>{
  const saved=new Map([['ks.signup.pending.v1',JSON.stringify({email:USER.email,profile:PROFILE,method:'email',at:NOW})],['ks.signin.requested.v1',JSON.stringify({email:USER.email,method:'email',at:NOW})]]);
  let writes=0;
  const h=harness({saved,backend:{user:()=>USER,getProfile:async()=>null,saveProfile:async p=>{writes++;return p;}}});
  await h.access.start();
  assert.equal(h.access.isReady(),true);assert.equal(writes,1);
  const completed=h.calls.findIndex(c=>c[0]==='Profile Completed');assert.equal(h.calls[completed-1][0],'identify');assert.equal(h.calls[completed-1][2].professional_role,'chef');
  assert.equal(h.calls.filter(c=>c[0]==='Sign In Completed').length,1);
  assert.equal(saved.has('ks.signin.requested.v1'),false);
  h.access.destroy();
  const otherSaved=new Map([['ks.signup.pending.v1',JSON.stringify({email:'someone-else@example.com',profile:PROFILE,method:'email',at:NOW})]]);
  const other=harness({saved:otherSaved,backend:{user:()=>USER,getProfile:async()=>null,saveProfile:async()=>{throw Error('must not use another email draft');}}});
  await other.access.start();assert.equal(other.access.isReady(),false);other.access.destroy();
});

test('trial expiry event fires once and local storage failure does not break guest access',async()=>{
  const saved=new Map([['ks.guest.v1',JSON.stringify({startedAt:NOW-3*86400000,lastSeenAt:NOW,actions:3})]]);
  const h=harness({saved});await h.access.start();h.access.gate('custom_equipment');h.access.gate('export');
  assert.equal(h.calls.filter(c=>c[0]==='Guest Trial Expired').length,1);h.access.destroy();
  const window={localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},document:{}};
  vm.runInNewContext(source,{window,Intl,Date,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{}});
  assert.doesNotThrow(()=>window.KS_createAccess({clock:()=>NOW}));
});

test('an interrupted nudge can be scheduled again after the dismissal cooldown',async()=>{
  const h=harness();await h.access.start();
  h.access.action();h.access.action();h.access.action();assert.equal(h.timers.size,1);
  h.access.gate('export');assert.equal(h.timers.size,0);
  h.nodes.get('ksAccessLater').onclick();h.advance(h.policy.DAY);h.access.action();
  assert.equal(h.timers.size,1,'cleared timer does not permanently suppress later prompts');
  h.runTimers();assert.equal(h.nodes.get('ksAccessDialog').open,true);h.access.destroy();
});

test('new profile already saved by the signup trigger is counted once, older profile is not recounted',async()=>{
  for(const [completedAt,expected]of [[NOW+100,1],[NOW-1000,0]]){
    const saved=new Map([['ks.signup.pending.v1',JSON.stringify({email:USER.email,profile:PROFILE,method:'email',at:NOW})]]);
    const h=harness({saved,now:NOW+1000,backend:{user:()=>USER,getProfile:async()=>({...PROFILE,onboarding_completed_at:new Date(completedAt).toISOString()})}});
    await h.access.start();assert.equal(h.calls.filter(c=>c[0]==='Profile Completed').length,expected);
    await h.access.authChanged(USER);assert.equal(h.calls.filter(c=>c[0]==='Profile Completed').length,expected);h.access.destroy();
  }
});
