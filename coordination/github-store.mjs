import {validateQueue} from './queue.mjs';
// Inject the existing connected GitHub actions, not credentials or a new client.
// readFile returns {content,sha}; updateFile uses the GitHub Contents API's blob-SHA CAS.
export function githubContentsStore({readFile,updateFile},{repository='uroshdxb-svg/kitchen-studio',branch='coordination-state',path='coordination/queue.json'}={}){
 return {
  async read(){
   const r=await readFile({repository_full_name:repository,ref:branch,path});
   if(!r||typeof r.content!=='string'||!/^[a-f0-9]{40}$/.test(r.sha??''))throw new Error('Missing/corrupt shared queue response; never overwrite or reinitialize');
   return{queue:validateQueue(JSON.parse(r.content)),revision:r.sha};
  },
  async compareAndSwap(revision,next){
   validateQueue(next);
   const content=JSON.stringify(next,null,2)+'\n';
   const r=await updateFile({repository_full_name:repository,branch,path,sha:revision,content,message:'Record coordinated worker receipt '+next.revision});
   if(r?.conflict===true)return false;
   if(!/^[a-f0-9]{40}$/.test(r?.commit_sha??'')||!/^[a-f0-9]{40}$/.test(r?.content_sha??''))throw new Error('Unconfirmed queue write; reread and replay same opId');
   const committed=await readFile({repository_full_name:repository,ref:r.commit_sha,path});
   if(committed?.sha!==r.content_sha||committed?.content!==content)throw new Error('Unconfirmed committed queue readback; reconcile and replay SAME opId');
   validateQueue(JSON.parse(committed.content));
   return true;
  }
 };
}
