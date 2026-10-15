import test from 'node:test';
import assert from 'node:assert/strict';
import {githubContentsStore} from './github-store.mjs';
import {emptyQueue,applyCommand,transact} from './queue.mjs';

const NOW=Date.parse('2026-10-15T12:00:00Z');
const SHA_A='a'.repeat(40),SHA_B='b'.repeat(40),SHA_C='c'.repeat(40);
const tick={opId:'tick-once',type:'worker_tick',worker:'supervisor',runId:'run-1'};

test('Contents adapter reads fresh content and blob SHA on every call',async()=>{
  const fresh=applyCommand(emptyQueue(),tick,NOW).queue;
  const reads=[];
  const responses=[{content:JSON.stringify(emptyQueue()),sha:SHA_A},{content:JSON.stringify(fresh),sha:SHA_B}];
  const store=githubContentsStore({readFile:async args=>{reads.push(args);return responses.shift();},updateFile:async()=>assert.fail('read must not write')});
  assert.equal((await store.read()).revision,SHA_A);
  const second=await store.read();
  assert.equal(second.revision,SHA_B);
  assert.equal(second.queue.workers.supervisor.runId,'run-1');
  assert.equal(reads.length,2);
  assert.deepEqual(reads[0],{repository_full_name:'uroshdxb-svg/kitchen-studio',ref:'coordination-state',path:'coordination/queue.json'});
});

test('Contents adapter submits the observed blob SHA and recognizes explicit conflicts',async()=>{
  let sent;
  const next=applyCommand(emptyQueue(),tick,NOW).queue;
  const store=githubContentsStore({readFile:async()=>assert.fail('not needed'),updateFile:async args=>{sent=args;return {conflict:true};}},{repository:'example/repo',branch:'state',path:'queue.json'});
  assert.equal(await store.compareAndSwap(SHA_A,next),false);
  assert.equal(sent.sha,SHA_A);
  assert.equal(sent.repository_full_name,'example/repo');
  assert.equal(sent.branch,'state');
  assert.equal(sent.path,'queue.json');
  assert.deepEqual(JSON.parse(sent.content),next);
});

test('Contents conflict replay preserves the competing fresh worker receipt',async()=>{
  let queue=emptyQueue(),sha=SHA_A,reads=0,updates=0;
  const other={opId:'other-tick',type:'worker_tick',worker:'reviewer',runId:'other-run'};
  const store=githubContentsStore({
    readFile:async()=>{reads++;return {content:JSON.stringify(queue),sha};},
    updateFile:async args=>{
      updates++;
      if(updates===1){queue=applyCommand(queue,other,NOW).queue;sha=SHA_B;return {conflict:true};}
      assert.equal(args.sha,SHA_B);
      queue=JSON.parse(args.content);sha=SHA_C;
      return {commit_sha:SHA_A,content_sha:SHA_C};
    },
  });
  await transact(store,tick,NOW);
  assert.equal(reads,2);assert.equal(updates,2);
  assert.equal(queue.workers.reviewer.runId,'other-run');
  assert.equal(queue.workers.supervisor.runId,'run-1');
});

test('an unconfirmed successful Contents write recovers by fresh same-op read without duplication',async()=>{
  let queue=emptyQueue(),sha=SHA_A,updates=0;
  const store=githubContentsStore({
    readFile:async()=>({content:JSON.stringify(queue),sha}),
    updateFile:async args=>{updates++;queue=JSON.parse(args.content);sha=SHA_B;return {};},
  });
  await assert.rejects(transact(store,tick,NOW),/Unconfirmed queue write/);
  const recovered=await transact(store,tick,NOW+1);
  assert.equal(updates,1);
  assert.equal(recovered.queue.revision,1);
  assert.equal(recovered.queue.workers.supervisor.runId,'run-1');
});

test('malformed Contents responses fail without initializing or writing',async()=>{
  for(const response of [null,{content:'{}',sha:SHA_A},{content:JSON.stringify(emptyQueue()),sha:'not-a-sha'},{content:'invalid json',sha:SHA_A}]){
    let writes=0;
    const store=githubContentsStore({readFile:async()=>response,updateFile:async()=>{writes++;}});
    await assert.rejects(store.read());
    assert.equal(writes,0);
  }
});

test('non-conflict adapter errors propagate for explicit reconciliation',async()=>{
  const error=new Error('Access unavailable');
  const store=githubContentsStore({readFile:async()=>{throw error;},updateFile:async()=>{throw error;}});
  await assert.rejects(store.read(),e=>e===error);
  await assert.rejects(store.compareAndSwap(SHA_A,emptyQueue()),e=>e===error);
});
