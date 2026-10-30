// Kitchen Studio build. All sources sit at the top level of the repo on purpose (uploadable without folders).
//   node build.mjs              -> dist/ (website: landing at /, app at /app, share links at /k/:id)
//   node build.mjs artifact     -> dist-artifact/kitchen-studio.html (claude.ai artifact flavour, libs from CDN)
//   node build.mjs standalone   -> dist-standalone/Kitchen_Studio.html (single offline file, libs inlined)
// Supabase config: env SUPABASE_URL / SUPABASE_ANON_KEY / SITE_URL win; site.config.json is the fallback (public anon key only).
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {visualCoverage} from "./equipment-visual-coverage.mjs";
import {buildDiscovery} from "./discovery.mjs";

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(ROOT,f),"utf8");
const mode=process.argv[2]||"site";
const brandScope={};new Function("window",read("brand.js"))(brandScope);
const brand=brandScope.KS_brand;
const branded=html=>html.replaceAll("__KS_BRAND_MARK__",brand.iconSVG({className:"mark",border:"#66727F"}));
const head=branded(read("head.html")).replace(mode==='standalone'?/<link[^>]*href="https:\/\/fonts\.googleapis\.com[^>]*>/g:/$^/g,"");
const styleEnd=head.indexOf("</style>")+"</style>".length;
const headPart=head.slice(0,styleEnd), bodyPart=head.slice(styleEnd);
const assetFiles={environment:'studio-small-09.hdr',chef:'chef.glb',diffuse:'floor-diff.jpg',normal:'floor-nor_gl.jpg',rough:'floor-rough.jpg'};
const assetURLs={},assetNames={};
for(const [key,file] of Object.entries(assetFiles)){
 const bytes=fs.readFileSync(path.join(ROOT,'assets/3d/'+file)),ext=path.extname(file),name=path.basename(file,ext)+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+ext;assetNames[key]=name;
 assetURLs[key]=mode==='standalone'||mode==='artifact'?'data:'+(key==='chef'?'model/gltf-binary':key==='environment'?'application/octet-stream':'image/jpeg')+';base64,'+bytes.toString('base64'):'/app/assets/'+name;
}
const renderingLibs=['libs/meshopt_decoder.js','loaders/GLTFLoader.js','utils/BufferGeometryUtils.js','loaders/RGBELoader.js','math/SimplexNoise.js','shaders/CopyShader.js','shaders/SSAOShader.js','postprocessing/Pass.js','postprocessing/SSAOPass.js'].map(f=>read('node_modules/three/examples/js/'+f)).join('\n');
const rendererJs=renderingLibs+'\nwindow.KS_3D_URLS='+JSON.stringify({chef:assetURLs.chef,environment:assetURLs.environment,floor:{diffuse:assetURLs.diffuse,normal:assetURLs.normal,rough:assetURLs.rough}})+';\n'+['view3d-assets.js','view3d-equipment.js','view3d-families.js','view3d-details.js','view3d-effects.js','view3d.js'].map(read).join('\n');
const appJs=['brand.js','fab.js','cat.js','symbols.js','equipment-intake.js','equipment-reader.js','equipment-layout.js','equipment-ocr.js','equipment-intake-ui.js'].map(read).join('\n')+'\n'+rendererJs+'\n'+read('app.js');
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
  const showcase=read("showcase.html").replace('href="/equipment/"','href="https://codex-3d-materials-preview-kitchen-studio.urosh-dxb.workers.dev/equipment/"').replace('src="/logo-icon.svg"','src="data:image/svg+xml,'+encodeURIComponent(brand.iconSVG())+'"').replace('href="/app/"','href="https://kitchenstudio.design/app/"').replace('<script src="/app/vendor/three.min.js"></script>',()=>'<script>'+read(LIBS['three.min.js'])+'</script>').replace('<script src="/app/renderer.js"></script>',()=>'<script>'+rendererJs+'</script>');
  out("dist-standalone","Kitchen_Studio_3D_Showcase.html",showcase);
  console.log("dist-standalone/Kitchen_Studio.html",(html.length/1e6).toFixed(2),"MB");
}else{
  let fileCfg={};try{fileCfg=JSON.parse(read("site.config.json"));}catch(_){}
  const cfg={supabaseUrl:process.env.SUPABASE_URL||fileCfg.supabaseUrl||"",supabaseAnonKey:process.env.SUPABASE_ANON_KEY||fileCfg.supabaseAnonKey||"",siteUrl:process.env.SITE_URL||fileCfg.siteUrl||"",version:ver};
  const D="dist";
  fs.rmSync(path.join(ROOT,D),{recursive:true,force:true});
  // catalogue rows for the MCP server (mcp.js reads /app/catalogue.json through the ASSETS binding)
  {const m={};new Function("m",read("cat.js")+";m.rows=CATALOGUE_ROWS;")(m);out(D,"app/catalogue.json",JSON.stringify(m.rows));}
  const libs={"jspdf-src":"/app/vendor/jspdf.min.js","svg2pdf-src":"/app/vendor/svg2pdf.min.js","pdfjs-src":"/app/vendor/pdf.min.js","pdfjs-worker-src":"/app/vendor/pdf.worker.min.js"};
  const seo=`<meta name="description" content="Plan your commercial kitchen with real-size equipment and prepare a concept layout and schedule for supplier review."><link rel="canonical" href="https://kitchenstudio.design/app/"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#F0602F">`;
  const scripts=[`<script>window.KS_OCR_BASE="/app/vendor/ocr/v1";window.KS_CONFIG=${JSON.stringify(cfg)};window.KS_LIBS=${JSON.stringify(libs)};</script>`,
    `<script src="/app/vendor/three.min.js"></script>`,
    `<script src="/app/vendor/supabase.js?v=${ver}"></script>`,
    `<script src="/app/cloud.js?v=${ver}"></script>`,
    `<script src="/app/app.js?v=${ver}"></script>`].join("\n");
  out(D,"app/index.html",`<!DOCTYPE html><html lang="en"><head>${META}${seo}\n${headPart}\n</head><body style="margin:0">\n${bodyPart}\n${scripts}\n</body></html>`);
  out(D,"app/app.js",appJs);
  for(const [key,file] of Object.entries(assetFiles))copy("assets/3d/"+file,D,"app/assets/"+assetNames[key]);
  out(D,"app/renderer.js",rendererJs);
  out(D,"showcase/index.html",read("showcase.html").replace("/app/renderer.js",`/app/renderer.js?v=${ver}`));
  out(D,"equipment/index.html",read("equipment-review.html").replace("/app/renderer.js",`/app/renderer.js?v=${ver}`));
  {const rows=new Function(read('cat.js')+';return CATALOGUE_ROWS')(),registry=new Function(read('view3d-equipment.js')+';return KS3DEquipment')(),entries=registry.entries,refs=JSON.parse(read('equipment-model-references.json'));
   const models=entries.map(e=>{const r=rows.find(r=>r[0]===e.brand&&r[1]===e.model);if(!r||!refs[e.id])throw new Error('Missing catalogue row or reference for '+e.id);const ref=refs[e.id];copy('assets/equipment-reference/'+ref.file,D,'equipment/reference/'+ref.file);return {kind:'eq',brand:r[0],model:r[1],cat:r[2],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7],image:'/equipment/reference/'+ref.file,source:ref.source};});out(D,'equipment/models.json',JSON.stringify(models));const symbolOf=new Function(read('symbols.js')+';return KS_symOf')();out(D,'equipment/coverage.json',JSON.stringify(visualCoverage(rows,registry,symbolOf,refs,new Function(read('view3d-families.js')+';return KS3DFamilies')())));}
  copy("cloud.js",D,"app/cloud.js");
  copy("equipment-ocr-worker.js",D,"app/ocr-worker.js");
  copy("equipment-layout.js",D,"app/equipment-layout.js");
  for(const name of fs.readdirSync(path.join(ROOT,"assets/ocr/v1")))copy("assets/ocr/v1/"+name,D,"app/vendor/ocr/v1/"+name);
  for(const [name,src] of Object.entries(LIBS))copy(src,D,"app/vendor/"+name);
  out(D,"connect/index.html",branded(read("connect.html")));
  out(D,"index.html",branded(read("landing.html")).replace("__KS_CONFIG__",JSON.stringify(cfg)));
  await buildDiscovery((file,data)=>out(D,file,data),branded);
  for(const f of ["favicon.svg","robots.txt","sample_floorplan.png","demo.mp4","demo.webm","demo-poster.jpg"])if(fs.existsSync(path.join(ROOT,f)))copy(f,D,f);
  for(const f of fs.readdirSync(ROOT).filter(f=>/^shot-.*\.png$/.test(f)))copy(f,D,"shots/"+f.replace(/^shot-/,""));
  out(D,"logo.svg",brand.lockupSVG());
  out(D,"logo-dark.svg",brand.lockupSVG({ink:"#FFFFFF",muted:"#AAB5C1",border:"#FFFFFF"}));
  out(D,"logo-icon.svg",brand.iconSVG());
  out(D,"favicon.svg",brand.iconSVG({border:"#66727F"}));
  out(D,"_headers","/app/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n/app/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n");
  console.log("dist/ built",cfg.supabaseUrl?"with Supabase config":"in local-only mode (no Supabase config)");
}
