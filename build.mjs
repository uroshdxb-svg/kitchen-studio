// Kitchen Studio build. All sources sit at the top level of the repo on purpose (uploadable without folders).
//   node build.mjs              -> dist/ (website: landing at /, app at /app, share links at /k/:id)
//   node build.mjs artifact     -> dist-artifact/kitchen-studio.html (claude.ai artifact flavour, libs from CDN)
//   node build.mjs standalone   -> dist-standalone/Kitchen_Studio.html (single offline file, libs inlined)
// Supabase config: env SUPABASE_URL / SUPABASE_ANON_KEY / SITE_URL win; site.config.json is the fallback (public anon key only).
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(ROOT,f),"utf8");
const mode=process.argv[2]||"site";
const head=read("head.html");
const styleEnd=head.indexOf("</style>")+"</style>".length;
const headPart=head.slice(0,styleEnd), bodyPart=head.slice(styleEnd);
const appJs=["cat.js","symbols.js","view3d.js","app.js"].map(read).join("\n");
const META='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">';
const ver=Date.now().toString(36);
const LIBS={"three.min.js":"node_modules/three/build/three.min.js","jspdf.min.js":"node_modules/jspdf/dist/jspdf.umd.min.js","svg2pdf.min.js":"node_modules/svg2pdf.js/dist/svg2pdf.umd.min.js","pdf.min.js":"node_modules/pdfjs-dist/build/pdf.min.js","pdf.worker.min.js":"node_modules/pdfjs-dist/build/pdf.worker.min.js","supabase.js":"node_modules/@supabase/supabase-js/dist/umd/supabase.js"};
const out=(dir,file,data)=>{fs.mkdirSync(path.join(ROOT,dir,path.dirname(file)),{recursive:true});fs.writeFileSync(path.join(ROOT,dir,file),data);};
const copy=(src,dir,file)=>{fs.mkdirSync(path.join(ROOT,dir,path.dirname(file)),{recursive:true});fs.copyFileSync(path.join(ROOT,src),path.join(ROOT,dir,file));};

if(mode==="artifact"){
  out("dist-artifact","kitchen-studio.html",head+'\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n'+appJs+'\n</script>\n');
  console.log("dist-artifact/kitchen-studio.html");
}else if(mode==="standalone"){
  const inl=(id,f)=>`<script type="text/plain" id="${id}">\n${read(f)}\n</script>`;
  const html=`<!DOCTYPE html><html lang="en"><head>${META}\n${headPart}\n</head><body style="margin:0">\n${bodyPart}\n<script>\n${read(LIBS["three.min.js"])}\n</script>\n${inl("jspdf-src",LIBS["jspdf.min.js"])}\n${inl("svg2pdf-src",LIBS["svg2pdf.min.js"])}\n${inl("pdfjs-src",LIBS["pdf.min.js"])}\n${inl("pdfjs-worker-src",LIBS["pdf.worker.min.js"])}\n<script>\n${appJs}\n</script></body></html>`;
  out("dist-standalone","Kitchen_Studio.html",html);
  console.log("dist-standalone/Kitchen_Studio.html",(html.length/1e6).toFixed(2),"MB");
}else{
  let fileCfg={};try{fileCfg=JSON.parse(read("site.config.json"));}catch(_){}
  const cfg={supabaseUrl:process.env.SUPABASE_URL||fileCfg.supabaseUrl||"",supabaseAnonKey:process.env.SUPABASE_ANON_KEY||fileCfg.supabaseAnonKey||"",siteUrl:process.env.SITE_URL||fileCfg.siteUrl||"",version:ver};
  const D="dist";
  fs.rmSync(path.join(ROOT,D),{recursive:true,force:true});
  const libs={"jspdf-src":"/app/vendor/jspdf.min.js","svg2pdf-src":"/app/vendor/svg2pdf.min.js","pdfjs-src":"/app/vendor/pdf.min.js","pdfjs-worker-src":"/app/vendor/pdf.worker.min.js"};
  const seo=`<meta name="description" content="Design your commercial kitchen yourself. Real equipment, real dimensions, drawings your contractor can build from."><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#F0602F">`;
  const scripts=[`<script>window.KS_CONFIG=${JSON.stringify(cfg)};window.KS_LIBS=${JSON.stringify(libs)};</script>`,
    `<script src="/app/vendor/three.min.js"></script>`,
    `<script src="/app/vendor/supabase.js?v=${ver}"></script>`,
    `<script src="/app/cloud.js?v=${ver}"></script>`,
    `<script src="/app/app.js?v=${ver}"></script>`].join("\n");
  out(D,"app/index.html",`<!DOCTYPE html><html lang="en"><head>${META}${seo}\n${headPart}\n</head><body style="margin:0">\n${bodyPart}\n${scripts}\n</body></html>`);
  out(D,"app/app.js",appJs);
  copy("cloud.js",D,"app/cloud.js");
  for(const [name,src] of Object.entries(LIBS))copy(src,D,"app/vendor/"+name);
  out(D,"index.html",read("landing.html").replace("__KS_CONFIG__",JSON.stringify(cfg)));
  for(const f of ["favicon.svg","robots.txt","sample_floorplan.png"])copy(f,D,f);
  for(const f of fs.readdirSync(ROOT).filter(f=>/^shot-.*\.png$/.test(f)))copy(f,D,"shots/"+f.replace(/^shot-/,""));
  out(D,"_headers","/app/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n");
  console.log("dist/ built",cfg.supabaseUrl?"with Supabase config":"in local-only mode (no Supabase config)");
}
