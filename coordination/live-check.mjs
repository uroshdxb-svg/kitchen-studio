// Read-only production verification; no account, customer, or publishing actions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const origin='https://kitchenstudio.design';
const pages=['/','/app/','/connect/','/guides/','/guides/commercial-kitchen-layout/','/guides/equipment-schedule/','/docs/','/docs/ai/'];
const docs=pages.slice(3);
const paths=[...pages,'/sitemap.xml','/robots.txt','/llms.txt','/llms-full.txt','/docs/ai/tools.json','/app/catalogue.json',...docs.map(p=>p+'index.md'),'/.well-known/oauth-protected-resource','/mcp','/guides','/docs/ai'];
const failures=[],rows=[],bodies=new Map();
for(let start=0;start<paths.length;start+=5)await Promise.all(paths.slice(start,start+5).map(async path=>{
 try{
  const r=await fetch(origin+path,{redirect:'follow',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'KitchenStudioReleaseCheck/1.0'}});
  const body=await r.text();bodies.set(path,body);
  const canonical=body.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/)?.[1]??null;
  rows.push({path,status:r.status,url:r.url,type:r.headers.get('content-type'),canonical,sha256:createHash('sha256').update(body).digest('hex')});
  if(r.status!==(path==='/mcp'?401:200))failures.push(path+': HTTP '+r.status);
  if(pages.includes(path)&&canonical!==origin+path)failures.push(path+': canonical mismatch');
  if(docs.includes(path)&&!body.includes('<p class="answer">'))failures.push(path+': missing static answer');
  if(path.endsWith('.md')&&!/text\/markdown/.test(r.headers.get('content-type')??''))failures.push(path+': Markdown content type');
  if(path==='/mcp'&&!/resource_metadata=/.test(r.headers.get('www-authenticate')??''))failures.push('Missing MCP auth challenge');
 }catch(e){rows.push({path,error:e.message});failures.push(path+': '+e.message);}
}));
const sitemap=[...(bodies.get('/sitemap.xml')??'').matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
if(JSON.stringify(sitemap)!==JSON.stringify(pages.map(p=>origin+p)))failures.push('Unexpected sitemap URLs');
if(!(bodies.get('/robots.txt')??'').includes('Sitemap: '+origin+'/sitemap.xml'))failures.push('Missing robots sitemap');
let catalogueRows=null,toolCount=null;
try{const catalogue=JSON.parse(bodies.get('/app/catalogue.json'));catalogueRows=Array.isArray(catalogue)?catalogue.length:null;if(catalogueRows===null||catalogueRows<483)failures.push('Catalogue fell below verified baseline483');}catch{failures.push('Invalid catalogue JSON');}
try{toolCount=JSON.parse(bodies.get('/docs/ai/tools.json')).tools.length;if(toolCount!==11)failures.push('Unexpected tool-schema count');}catch{failures.push('Invalid tool reference JSON');}
for(const path of ['/guides','/docs/ai'])if(rows.find(x=>x.path===path)?.url!==origin+path+'/')failures.push(path+': trailing slash redirect');
const report={scope:'public_HTTP_only',checkedAt:new Date().toISOString(),workflowCommit:process.env.GITHUB_SHA??null,requests:paths.length,sitemapPages:sitemap.length,catalogueRows,toolCount,failures,rows,indexing:'not_measured',engineMentions:'not_measured',authenticatedExternalMcp:'not_tested'};
fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/production-http-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scope:report.scope,checkedAt:report.checkedAt,workflowCommit:report.workflowCommit,requests:report.requests,sitemapPages:report.sitemapPages,catalogueRows,toolCount,failures},null,2));
if(failures.length)process.exitCode=1;
