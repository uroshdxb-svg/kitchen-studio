// Read-only interaction data. Pure selectors never fetch, mutate a queue or infer execution.
import {taskState} from './telemetry.mjs';
export {publicEvidence} from './evidence.mjs';
const attention=new Set(['blocked','approval','handoff','incoming','expired','unconfirmed','unknown']);
const finite=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
export function selectTasks(data,{role='all',status='all',query=''}={},now=Date.now(),feed='current'){
 const needle=String(query).trim().toLocaleLowerCase();
 return (data?.tasks||[]).map(task=>({task,state:taskState(task,now,feed)})).filter(({task,state})=>(role==='all'||task.owner===role)&&(status==='all'||status===state||status==='attention'&&attention.has(state))&&(!needle||[task.id,task.title,task.reason,task.owner].some(x=>String(x||'').toLocaleLowerCase().includes(needle))));
}
export function selectIncidents(data,now=Date.now(),feed='current'){
 return selectTasks(data,{status:'attention'},now,feed).map(({task,state})=>({id:task.id,title:task.title,owner:task.owner,state,reason:task.reason||({handoff:'Waiting for the receiving worker to acknowledge.',expired:'Lease expired; reconcile external effects before retry.',unconfirmed:'Current work cannot be verified from this snapshot.',unknown:'Lease identity or activity evidence is incomplete.'})[state]||'Requires attention.',deadline:task.deadline??null}));
}
export function selectActivity(data){
 const events=[];
 for(const t of data?.tasks||[]){if(finite(t.completedAt))events.push({id:'done:'+t.id,at:t.completedAt,type:'completion',role:t.owner,taskId:t.id,title:'Completion recorded: '+t.title});else if(finite(t.updatedAt))events.push({id:'task:'+t.id,at:t.updatedAt,type:'task',role:t.owner,taskId:t.id,title:'Task state recorded: '+t.title});}
 for(const h of data?.handoffs||[]){const at=h.acceptedAt||h.createdAt;if(finite(at))events.push({id:'handoff:'+h.taskId+':'+at,at,type:'handoff',role:h.acceptedAt?h.to:h.from,taskId:h.taskId,title:h.acceptedAt?'Handoff acknowledged':'Handoff recorded'});}
 for(const [role,w]of Object.entries(data?.workers||{}))if(finite(w.at))events.push({id:'tick:'+role+':'+w.at,at:w.at,type:'check-in',role,taskId:null,title:'Shared check-in recorded; not continuous activity'});
 return events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||a.id.localeCompare(b.id)).slice(0,24);
}
