import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const verifiedUser={id:'user-one',email:'chef@example.test',email_confirmed_at:'2026-11-04T00:00:00Z',is_anonymous:false};
const profile={country_code:'AE',professional_role:'chef',use_case:'new_opening'};
function backend(user=verifiedUser){
  const calls=[];let authChange;
  const sb={auth:{
    getSession:async()=>({data:{session:user?{user}:null}}),
    onAuthStateChange:f=>{authChange=f;},
    signInWithOtp:async args=>{calls.push({kind:'email',args});return {error:null};}
  },from:table=>{
    const q={table,filters:[]};calls.push(q);
    const chain={select:fields=>{q.fields=fields;return chain;},eq:(key,value)=>{q.filters.push([key,value]);return chain;},update:row=>{q.update=row;return chain;},maybeSingle:async()=>({data:{id:user.id,...profile},error:null}),single:async()=>({data:{id:user.id,...q.update,onboarding_completed_at:'2026-11-04T00:00:00Z'},error:null})};
    return chain;
  }};
  const window={KS_CONFIG:{supabaseUrl:'https://example.test',supabaseAnonKey:'public'},supabase:{createClient:()=>sb}};
  vm.runInNewContext(fs.readFileSync(new URL('./cloud.js',import.meta.url),'utf8'),{window,URLSearchParams,location:{origin:'https://kitchenstudio.design'},fetch:async()=>Response.json({external:{email:true}})});
  return {B:window.KS_backend,calls,auth:u=>authChange('SIGNED_IN',u?{user:u}:null)};
}

test('profile reads and writes are scoped to the signed-in account',async()=>{
  const {B,calls}=backend();await B.ready;
  assert.equal((await B.getProfile()).id,'user-one');
  const saved=await B.saveProfile({...profile,country_code:' ae ',id:'someone-else',plan:'admin',onboarding_completed_at:'forged'});
  assert.equal(saved.country_code,'AE');assert.equal(saved.onboarding_completed_at,'2026-11-04T00:00:00Z');
  for(const c of calls){assert.equal(c.table,'profiles');assert.deepEqual(c.filters,[['id','user-one']]);}
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].update)),profile);
});

test('invalid survey fields do not reach the database or send a sign-in email',async()=>{
  const {B,calls}=backend();await B.ready;
  for(const bad of [{...profile,country_code:'Unknown'},{...profile,country_code:'XX'},{...profile,professional_role:'admin'},{...profile,use_case:''}]){
    await assert.rejects(B.saveProfile(bad),e=>e.code==='invalid_profile');
    await assert.rejects(B.signInEmail('chef@example.test',undefined,bad),e=>e.code==='invalid_profile');
  }
  assert.equal(calls.length,0);
});

test('passwordless signup carries only the validated survey answers',async()=>{
  const {B,calls}=backend(null);await B.ready;
  await B.signInEmail('chef@example.test','https://kitchenstudio.design/app/',{...profile,plan:'admin'});
  assert.equal(calls[0].args.options.emailRedirectTo,'https://kitchenstudio.design/app/');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].args.options.data)),profile);
});

test('anonymous and unconfirmed sessions cannot access account features',async()=>{
  for(const user of [null,{...verifiedUser,is_anonymous:true},{...verifiedUser,email_confirmed_at:null},{...verifiedUser,email:''}]){
    const {B,calls}=backend(user);await B.ready;assert.equal(B.user(),null);
    await assert.rejects(B.getProfile(),e=>e.code==='not_granted');
    await assert.rejects(B.saveProfile(profile),e=>e.code==='not_granted');
    assert.equal(calls.length,0);
  }
});

test('auth transitions only expose verified accounts and clear them on sign-out',async()=>{
  const {B,auth}=backend(null);await B.ready;const seen=[];B.onAuth(u=>seen.push(u&&u.id));
  auth({...verifiedUser,is_anonymous:true});assert.equal(B.user(),null);
  auth(verifiedUser);assert.equal(B.user().id,'user-one');auth(null);assert.equal(B.user(),null);
  assert.deepEqual(seen,['user-one',null]);
});
