import {ROLES,LABELS,feedState,roleView,taskState,attentionCount} from './telemetry.mjs';
import {selectTasks,selectIncidents,selectActivity,publicEvidence} from './selectors.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
const setText=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
const stamp=x=>x&&Number.isFinite(Date.parse(x))?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'}).format(new Date(x))+' UTC':'Not observed';
const ago=(x,now)=>{const age=Math.max(0,Math.floor((now-Date.parse(x))/1000));return age<60?age+'s ago':age<3600?Math.floor(age/60)+'m ago':Math.floor(age/3600)+'h ago';};
const roleName=id=>ROLES.find(r=>r.id===id)?.name||'Unknown role';
const cleanReason=value=>String(value||'').replace(/Report SHA256 [a-f0-9]{64}\.\s*/gi,'');
const badge=state=>node('span','badge '+state,LABELS[state]||'Unobserved');
const dot=state=>node('i','dot '+state);
let data=null,failed=false,busy=false,lastAttempt=0,view='overview',selectedRole='supervisor',selectedTask=null,detailMode='role',detailKey='',contentKey='',sideKey='';
const positions={'catalog':[17,22],'product':[44,12],'reviewer':[74,20],'reliability':[86,45],'discovery':[83,75],'content-qa':[56,88],'social-readiness':[28,84],'cx':[13,58]};
const buttons=new Map(),drawer=$('worker-drawer');
for(const role of ROLES){
 const b=node('button','node');b.type='button';b.dataset.role=role.id;b.setAttribute('aria-pressed','false');
 const top=node('div','node-top');top.append(node('span','role-mark',role.mark),dot('unknown'));
 b.append(top,node('h4','',role.id==='supervisor'?'ROOK':role.name));
 if(role.id==='supervisor')b.append(node('span','core-role','SUPERVISOR'));
 b.append(node('span','state','Unobserved'),node('p','task-preview','Waiting for shared-state evidence'));
 b.addEventListener('click',()=>openRole(role.id));
 if(role.id!=='supervisor'){const [x,y]=positions[role.id];b.style.setProperty('--x',x+'%');b.style.setProperty('--y',y+'%');}
 $(role.id==='supervisor'?'supervisor':'specialists').append(b);buttons.set(role.id,b);
 const option=node('option','',role.name);option.value=role.id;$('role-filter').append(option);
}
function evidenceLinks(container,refs){for(const e of publicEvidence((refs||[]).map(r=>typeof r==='string'?r:r.url))){const a=node('a','evidence-link',e.label+' ↗');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';container.append(a);}}
function openRole(id){selectedRole=id;selectedTask=null;detailMode='role';detailKey='';if(!drawer.open)drawer.showModal();render();}
function openTask(id){const t=data?.tasks.find(t=>t.id===id);if(!t)return;selectedRole=t.owner;selectedTask=id;detailMode='task';detailKey='';if(!drawer.open)drawer.showModal();render();}
$('close-drawer').addEventListener('click',()=>drawer.close());drawer.addEventListener('close',()=>render());
drawer.addEventListener('click',e=>{if(e.target===drawer){const r=drawer.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)drawer.close();}});
function go(next,{attention=false}={}){
 view=['overview','agents','missions','evidence','handoffs','activity'].includes(next)?next:'overview';
 if(attention)$('state-filter').value='attention';
 for(const b of document.querySelectorAll('nav [data-view]'))b.setAttribute('aria-current',b.dataset.view===view?'page':'false');
 const titles={overview:['Mission Control','Your operating picture. Grounded in actual shared-state evidence.'],agents:['Your agent system','Nine configured roles. Activity is observed, never assumed.'],missions:['Mission queue','Inspect ownership, blockers and progress without triggering work.'],evidence:['Evidence library','Public project references attached to actual ledger records.'],handoffs:['Handoff trail','A recorded handoff becomes accepted only after a receiving ACK.'],activity:['Recorded activity','Timestamped observations. This is not a live execution stream.']};
 setText('page-title',titles[view][0]);setText('page-subtitle',titles[view][1]);setText('breadcrumb',view.toUpperCase());
 $('overview-view').hidden=view!=='overview';$('collection-view').hidden=view==='overview';
 $('filters').hidden=!['agents','missions','evidence'].includes(view);
 try{history.replaceState(null,'','#'+view);}catch{}
 contentKey='';render();
}
for(const b of document.querySelectorAll('nav [data-view]'))b.addEventListener('click',()=>go(b.dataset.view));
for(const b of document.querySelectorAll('[data-open-view]'))b.addEventListener('click',()=>go(b.dataset.openView,{attention:b.dataset.attention==='true'}));
for(const id of ['role-filter','state-filter'])$(id).addEventListener('change',()=>{contentKey='';render();});
$('reset-filters').addEventListener('click',()=>{$('role-filter').value='all';$('state-filter').value='all';$('task-search').value='';$('clear-search').hidden=true;contentKey='';render();});
$('task-search').addEventListener('input',()=>{$('clear-search').hidden=!$('task-search').value;if(view!=='missions')go('missions');else{contentKey='';render();}});
$('clear-search').addEventListener('click',()=>{$('task-search').value='';$('clear-search').hidden=true;contentKey='';render();$('task-search').focus();});
function taskRow(task,state){const b=node('button','task-row');b.type='button';b.dataset.task=task.id;const heading=node('div','row-heading');heading.append(dot(state),node('strong','',task.title),badge(state));b.append(heading,node('p','',roleName(task.owner)+' · '+task.id));if(task.reason)b.append(node('p','',cleanReason(task.reason)));b.addEventListener('click',()=>openTask(task.id));return b;}
function activityRow(event){const b=node('button','activity-item');b.type='button';b.append(node('strong','',event.title),node('small','',roleName(event.role)+' · '+stamp(event.at)));b.addEventListener('click',()=>event.taskId?openTask(event.taskId):openRole(event.role));return b;}
function renderCollection(now,feed,views){
 if(view==='overview')return;
 const filters={role:$('role-filter').value,status:$('state-filter').value,query:$('task-search').value};
 const key=JSON.stringify([view,data,feed,filters,views.map(v=>[v.id,v.state]),data?.tasks.map(t=>[t.id,taskState(t,now,feed)])]);if(key===contentKey)return;contentKey=key;
 const list=$('collection-list');list.replaceChildren();
 setText('collection-title',({agents:'Nine worker roles',missions:'Shared missions',evidence:'Public evidence',handoffs:'Recent handoffs',activity:'Activity timeline'})[view]);
 setText('collection-kicker',feed==='current'?'CURRENT READ · PUBLIC METADATA':'SNAPSHOT CONTEXT · '+feed.toUpperCase());
 let count=0;
 if(view==='agents'){
  for(const r of ROLES){const v=views.find(v=>v.id===r.id),query=filters.query.toLocaleLowerCase();if(filters.role!=='all'&&filters.role!==r.id)continue;if(filters.status!=='all'&&filters.status!==v.state&&!(filters.status==='attention'&&['blocked','approval','incoming','handoff','expired','unconfirmed'].includes(v.state)))continue;if(query&&![r.name,r.purpose,v.current?.title].some(x=>String(x||'').toLocaleLowerCase().includes(query)))continue;
   const b=node('button','agent-row');b.type='button';const h=node('div','row-heading');h.append(dot(v.state),node('strong','',r.name),badge(v.state));b.append(h,node('p','',r.purpose),node('p','',v.current?.title||'No assigned work observed'),node('p','',r.cadence+' · nominal schedule'));b.addEventListener('click',()=>openRole(r.id));list.append(b);count++;
  }
 }else if(view==='missions'||view==='evidence'){
  for(const {task,state}of selectTasks(data,filters,now,feed)){if(view==='evidence'&&!task.evidence?.length)continue;list.append(taskRow(task,state));if(view==='evidence'){const links=node('div','collection-evidence');evidenceLinks(links,task.evidence);list.append(links);}count++;}
 }else if(view==='handoffs'){
  for(const h of data?.handoffs||[]){const item=node('article','receipt'),head=node('div','row-heading');head.append(node('strong','',roleName(h.from)+' → '+roleName(h.to)),badge(h.acceptedAt?'done':h.pending?'handoff':'unknown'));item.append(head,node('p','',h.taskId),node('p','',h.acceptedAt?'Acknowledged '+stamp(h.acceptedAt):'ACK due '+stamp(h.ackDueAt)));const b=node('button','evidence-link','Inspect mission');b.type='button';b.addEventListener('click',()=>openTask(h.taskId));item.append(b);evidenceLinks(item,h.evidence);list.append(item);count++;}
 }else for(const e of selectActivity(data)){list.append(activityRow(e));count++;}
 setText('result-count',count+' '+(count===1?'record':'records'));if(!count)list.append(node('p','empty',!data?'No shared-state evidence loaded.':'No records match this view. Try another filter or clear the search.'));
}
function renderDetails(now,feed,views){
 const r=ROLES.find(r=>r.id===selectedRole),v=views.find(v=>v.id===selectedRole),chosen=selectedTask?data?.tasks.find(t=>t.id===selectedTask):v.current;
 const state=selectedTask?selectTasks(data,{role:r.id},now,feed).find(x=>x.task.id===selectedTask)?.state:v.state;
 const key=JSON.stringify([selectedRole,selectedTask,detailMode,feed,v,chosen,state]);if(key===detailKey)return;detailKey=key;
 setText('detail-kicker',detailMode==='role'?'WORKER DETAIL':'MISSION DETAIL');setText('detail-name',detailMode==='role'?r.name:chosen?.title||'Mission');setText('detail-purpose',detailMode==='role'?r.purpose:'Owned by '+r.name+' · read-only evidence');
 const body=$('detail-body');body.replaceChildren();const status=node('div','detail-state');status.append(dot(state||'unknown'),node('strong','',LABELS[state]||'Unobserved'));body.append(status);
 const field=(label,value,cls='detail-copy')=>body.append(node('p','detail-label',label),node('p',cls,value));
 if(chosen){field(v.incoming&&detailMode==='role'?'INCOMING HANDOFF':['done','cancelled'].includes(chosen.status)?'LAST RECORDED TASK':'CURRENT ASSIGNMENT',chosen.title);body.append(node('p','detail-id',chosen.id));if(v.incoming&&detailMode==='role')body.append(node('div','detail-callout','Acknowledgement required. Ownership remains with '+roleName(chosen.owner)+' until the receiving worker accepts.'));if(chosen.reason)body.append(node('div','detail-callout',cleanReason(chosen.reason)));if(chosen.lease){field('LEASE EXPIRES',stamp(chosen.lease.expiresAt));field('ACTIVITY EVIDENCE',stamp(chosen.lease.heartbeatAt));}if(chosen.deadline)field('TASK DEADLINE',stamp(chosen.deadline));if(chosen.evidence?.length){body.append(node('p','detail-label','PUBLIC EVIDENCE'));evidenceLinks(body,chosen.evidence);}}
 else field('CURRENT ASSIGNMENT','No task observed in the shared ledger.');
 field('LAST SHARED CHECK-IN',stamp(v.lastTick),'detail-copy muted');field('PLANNED CADENCE',r.cadence+' · nominal, not execution evidence','detail-copy muted');field('NEXT PLANNED WAKE','Not exposed by the public ledger. An enabled schedule does not prove a run.','detail-copy muted');
 const own=selectTasks(data,{role:r.id},now,feed).filter(x=>x.task.id!==chosen?.id);if(own.length){body.append(node('p','detail-label','OTHER OWNED MISSIONS'));for(const x of own){const b=taskRow(x.task,x.state);b.classList.add('drawer-task');body.append(b);}}
 if(feed!=='current')body.append(node('div','detail-callout','Snapshot context only. Current activity cannot be verified until a fresh read succeeds.'));
}
function renderSide(now,feed,views){
 const key=JSON.stringify([data,feed,views.map(v=>[v.id,v.state]),data?.tasks.map(t=>[t.id,taskState(t,now,feed)])]);if(key===sideKey)return;sideKey=key;
 const attention=$('attention-list');attention.replaceChildren();const incidents=selectIncidents(data,now,feed);
 for(const i of incidents.slice(0,3)){const b=node('button','attention-item');b.type='button';b.append(node('strong','',i.title),node('p','',cleanReason(i.reason)),node('small','',roleName(i.owner)+' · '+LABELS[i.state]));b.addEventListener('click',()=>openTask(i.id));attention.append(b);}if(!incidents.length)attention.append(node('p','empty',data?'No attention items in this snapshot.':'Waiting for evidence.'));
 const activity=$('activity-list');activity.replaceChildren();for(const e of selectActivity(data).slice(0,4))activity.append(activityRow(e));if(!data)activity.append(node('p','empty','No recorded activity loaded.'));
 const latest=$('latest-deliverable');latest.replaceChildren();const completed=(data?.tasks||[]).filter(t=>t.status==='done').sort((a,b)=>Date.parse(b.completedAt||0)-Date.parse(a.completedAt||0));const task=completed.find(t=>t.evidence?.length);
 latest.append(node('p','panel-note','Public completion evidence; not a claim of a released media asset.'));if(task){const b=node('button','attention-item');b.type='button';b.append(node('strong','',task.title),node('small','',stamp(task.completedAt)));b.addEventListener('click',()=>openTask(task.id));latest.append(b);evidenceLinks(latest,task.evidence);}else latest.append(node('p','empty','No public deliverable link is recorded. Completion and preview evidence will appear when present in the shared ledger.'));
}
function render(){
 const now=Date.now(),feed=feedState(data,now,failed),views=ROLES.map(r=>roleView(data,r.id,now,feed));
 setText('feed-status',({current:'Feed connected',offline:'Offline · snapshot only',stale:'Stale · snapshot only',unknown:'Connecting'})[feed]);$('feed-light').className='feed-indicator '+feed;
 setText('fetch-time',data?'Last read '+stamp(data.fetchedAt):'No successful read yet');setText('queue-time',data?'Queue changed '+ago(data.queueUpdatedAt,now):'Queue update unknown');setText('refresh-error',failed?'Live state unavailable. Working lights are off.':'');setText('revision',data?'REV '+data.revision:'REV —');
 setText('active-count',data&&feed==='current'?String(views.filter(v=>v.state==='working').length):'—');setText('done-count',data?String(data.tasks.filter(t=>t.status==='done').length):'—');setText('blocked-count',data?String(attentionCount(data,now,feed)):'—');
 for(const v of views){const b=buttons.get(v.id);b.setAttribute('aria-pressed',String(drawer.open&&detailMode==='role'&&v.id===selectedRole));b.dataset.state=v.state;b.querySelector('.dot').className='dot '+v.state;b.querySelector('.state').textContent=LABELS[v.state]||'Unobserved';b.querySelector('.task-preview').textContent=v.current?.title||(v.lastTick?'No open assigned task':'No shared check-in observed');b.setAttribute('aria-label',roleName(v.id)+': '+LABELS[v.state]);}
 renderDetails(now,feed,views);renderCollection(now,feed,views);renderSide(now,feed,views);
}
function validData(d){return d?.schemaVersion===1&&Number.isInteger(d.revision)&&Array.isArray(d.tasks)&&Array.isArray(d.handoffs)&&d.workers&&Number.isFinite(Date.parse(d.fetchedAt))&&Number.isFinite(Date.parse(d.queueUpdatedAt))&&d.tasks.every(t=>ROLES.some(r=>r.id===t.owner)&&typeof t.title==='string');}
async function refresh(){
 const now=Date.now();if(busy||document.hidden||now-lastAttempt<15000)return;busy=true;lastAttempt=now;$('refresh').disabled=true;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{const r=await fetch('./state.json',{cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Feed unavailable');const d=await r.json();if(!validData(d)||data&&d.revision<data.revision)throw new Error('Invalid feed');data=d;failed=false;}catch{failed=true;}finally{clearTimeout(timer);busy=false;$('refresh').disabled=false;render();}
}
$('refresh').addEventListener('click',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();void refresh();}});setInterval(()=>{if(!document.hidden)render();},1000);setInterval(()=>{void refresh();},60000);
go(location.hash.slice(1));void refresh();
