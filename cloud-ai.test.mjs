import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('webapp exposes no native AI backend or artifact model capability',async()=>{
  const window={KS_CONFIG:{supabaseUrl:'https://example.test',supabaseAnonKey:'public'},supabase:{createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}}})}};
  vm.runInNewContext(fs.readFileSync('cloud.js','utf8'),{window,URLSearchParams,location:{origin:'https://example.test'},fetch:async()=>Response.json({external:{}})});
  await window.KS_backend.ready;assert.equal(window.KS_backend.ai,undefined);
  for(const file of ['app.js','cloud.js','equipment-intake-ui.js','ai-function.ts','ai-handler.mjs','index.ts']){
    const s=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(s,/api\.anthropic\.com|api\.openai\.com|ANTHROPIC_API_KEY|OPENAI_API_KEY|functions\.invoke|be\.ai\s*\(|sampleFn|use\(["']sample/);
  }
});
