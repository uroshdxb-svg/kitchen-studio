// Tiny static server for dist/ that mimics the Cloudflare Pages _redirects rewrites (for tests and local preview).
import http from "node:http";import fs from "node:fs";import path from "node:path";import {fileURLToPath} from "node:url";
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","dist");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".json":"application/json",".txt":"text/plain",".ico":"image/x-icon"};
export function serve(port=5173){
  return new Promise(res=>{const s=http.createServer((req,r)=>{
    let u=decodeURIComponent(req.url.split("?")[0]);
    if(u.startsWith("/k/")||u==="/app"||u==="/app/")u="/app/index.html";
    if(u.endsWith("/"))u+="index.html";
    const f=path.join(ROOT,u);
    if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end("not found");return;}
    r.writeHead(200,{"Content-Type":types[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(r);});
    s.listen(port,()=>res(s));});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){serve(+process.argv[2]||5173).then(()=>console.log("http://localhost:"+(process.argv[2]||5173)));}
