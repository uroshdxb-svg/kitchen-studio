// Inspect built public pages without requiring a network, account or paid API.
// This checks local delivery contracts, not indexing, AI recommendations or conversions.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root,"dist");
const origin = "https://kitchenstudio.design";
const failures=[];
const requireCheck=(ok,message)=>{if(!ok)failures.push(message);};
const read=p=>fs.readFileSync(path.join(dist,p),"utf8");
const targetFile=urlPath=>path.join(dist,urlPath.endsWith("/")?urlPath+"index.html":urlPath);
const allowedPublicPath=p=>!/^\/(?:k|oauth)(?:\/|$)/.test(p);

try {
  const sitemap=read("sitemap.xml");
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
  requireCheck(urls.length>3,"Sitemap must include public documentation, not just the landing page.");
  requireCheck(new Set(urls).size===urls.length,"Duplicate sitemap entries.");
  const titles=new Set();
  for(const href of urls){
    const url=new URL(href);
    requireCheck(url.origin===origin,`Noncanonical sitemap origin: ${href}`);
    requireCheck(allowedPublicPath(url.pathname),`Private/account route in sitemap: ${href}`);
    requireCheck(fs.existsSync(targetFile(url.pathname)),`Sitemap URL has no built page: ${href}`);
    if(!fs.existsSync(targetFile(url.pathname)))continue;
    const source=fs.readFileSync(targetFile(url.pathname),"utf8");
    const title=[...source.matchAll(/<title>([^<]+)<\/title>/g)];
    requireCheck(title.length===1,`Expected one title: ${href}`);
    requireCheck(!titles.has(title[0]?.[1]),`Repeated page title: ${href}`);titles.add(title[0]?.[1]);
    const canonical=[...source.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
    requireCheck(canonical.length===1&&canonical[0][1]===href,`Wrong/missing canonical: ${href}`);
    requireCheck(/<meta\s+name="description"\s+content="[^"]+"/.test(source),`Missing description: ${href}`);
    requireCheck(!/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(source),`Public page is noindex: ${href}`);
    if(/^\/(?:guides|docs)\//.test(url.pathname)){
      requireCheck((source.match(/<h1[ >]/g)||[]).length===1,`Expected one primary heading: ${href}`);
      requireCheck(source.includes('<p class="answer">'),`Main answer must be in raw HTML: ${href}`);
      requireCheck(!source.includes("__KS_"),`Unexpanded build placeholder: ${href}`);
      requireCheck(source.includes('href="/app/"'),`No editor next action: ${href}`);
      const md=path.join(dist,url.pathname,"index.md");
      requireCheck(fs.existsSync(md),`Missing Markdown counterpart: ${href}`);
      for(const [,link] of source.matchAll(/href="(\/[^"#?]*)"/g)){
        requireCheck(allowedPublicPath(link),`Customer/account link on public docs: ${link}`);
        requireCheck(fs.existsSync(targetFile(link)),`Broken internal resource ${link} on ${href}`);
      }
    }
  }
  const robots=read("robots.txt");
  requireCheck(robots.includes(`Sitemap: ${origin}/sitemap.xml`),"robots.txt must advertise the canonical sitemap.");
  requireCheck(robots.includes("Disallow: /k/"),"Keep customer share routes out of crawl discovery.");
  requireCheck(!/^Disallow:\s*\/\s*$/m.test(robots),"robots.txt blocks the whole public site.");
  requireCheck(read("llms.txt").includes("/docs/ai/tools.json"),"Documentation index is missing the tool reference.");
  const tools=JSON.parse(read("docs/ai/tools.json"));
  requireCheck(Array.isArray(tools.tools)&&tools.tools.some(t=>t.name==="get_schedule"),"Missing published tool schemas.");
  console.log(JSON.stringify({scope:"local_built_files_only",sitemap_pages:urls.length,failures,external_indexing:"not_measured",ai_citation_share:"not_measured",conversions:"not_measured"},null,2));
  if(failures.length)process.exitCode=1;
}catch(error){console.error(JSON.stringify({scope:"local_built_files_only",error:error.message,failures},null,2));process.exitCode=1;}
