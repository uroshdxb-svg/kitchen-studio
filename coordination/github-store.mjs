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
   const r=await updateFile({repository_full_name:repository,branch,path,sha:revision,content:JSON.stringify(next,null,2)+'\n',message:'Record coordinated worker receipt '+next.revision});
   if(r?.conflict===true)return false;
   if(!r?.commit_sha||!r?.content_sha)throw new Error('Unconfirmed queue write; reread and replay same opId');
   return true;
  }
 };
}
