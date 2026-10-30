import test from 'node:test';
import assert from 'node:assert/strict';
import {retiredAI} from './ai-handler.mjs';
test('retired native AI endpoint responds immediately without reading or sending documents',async()=>{
  const r=retiredAI(new Request('https://example.test/ai',{method:'POST',body:'not JSON'}));
  assert.equal(r.status,410);assert.equal((await r.json()).code,'ai_via_mcp');
  assert.equal(retiredAI(new Request('https://example.test/ai',{method:'OPTIONS'})).status,204);
});
