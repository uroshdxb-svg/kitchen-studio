// The only external evidence link shapes this dashboard may expose.
export function publicEvidence(refs){
 if(!Array.isArray(refs))return [];const out=[];
 for(const ref of refs){if(typeof ref!=='string'||ref.length>400)continue;let u;try{u=new URL(ref);}catch{continue;}
  if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.search||u.hash)continue;
  const m=u.pathname.match(/^\/uroshdxb-svg\/kitchen-studio\/(pull\/[1-9]\d*|commit\/[a-f0-9]{40}|actions\/runs\/[1-9]\d*)\/?$/);if(!m)continue;
  const url='https://github.com/uroshdxb-svg/kitchen-studio/'+m[1];if(out.some(x=>x.url===url))continue;const [kind,id]=m[1].split('/');out.push({url,label:kind==='pull'?'Pull request #'+id:kind==='commit'?'Commit '+id.slice(0,7):'CI run '+m[1].split('/').at(-1),kind:kind==='actions'?'ci':kind});if(out.length===8)break;
 }return out;
}
