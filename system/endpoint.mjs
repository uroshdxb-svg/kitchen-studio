import {projectQueue} from './telemetry.mjs';
const SOURCE='https://raw.githubusercontent.com/uroshdxb-svg/kitchen-studio/coordination-state/coordination/queue.json';
const LIMIT=1048576;
export async function systemState(request,fetcher=fetch,now=Date.now()){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(!['GET','HEAD'].includes(request.method))return new Response(JSON.stringify({error:'Read only'}),{status:405,headers:{...headers,Allow:'GET, HEAD'}});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
  try{
    // A unique read URL avoids treating GitHub's cached branch response as fresh lease evidence.
    const response=await fetcher(SOURCE+'?read='+now,{signal:controller.signal,headers:{Accept:'application/json','Cache-Control':'no-cache'},cf:{cacheTtl:0}});
    if(!response.ok||Number(response.headers.get('content-length'))>LIMIT)throw new Error('Upstream unavailable');
    const reader=response.body.getReader();let size=0,chunks=[];
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT){await reader.cancel();throw new Error('Oversized queue');}chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    const data=projectQueue(JSON.parse(new TextDecoder().decode(bytes)),now);
    return new Response(request.method==='HEAD'?null:JSON.stringify(data),{headers});
  }catch{return new Response(request.method==='HEAD'?null:JSON.stringify({error:'Coordination feed unavailable',checkedAt:new Date(now).toISOString()}),{status:503,headers});}
  finally{clearTimeout(timeout);}
}
