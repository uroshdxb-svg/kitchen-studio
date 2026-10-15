import {ROLES,LABELS,feedState,roleView,attentionCount} from './telemetry.mjs';
const $=id=>document.getElementById(id);
const node=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;return n;};
const stamp=x=>x?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'UTC'}).format(new Date(x))+' UTC':'Not observed';
const ago=(x,now)=>{const age=Math.max(0,Math.floor((now-Date.parse(x))/1000));return age<60?`${age}s ago`:age<3600?`${Math.floor(age/60)}m ago`:`${Math.floor(age/3600)}h ago`;};
let data=null,failed=false,selected='supervisor',busy=false,lastAttempt=0,lastDetailKey='',lastHandoffKey='',lastActive=null;
const buttons=new Map();
for(const role of ROLES){
  const b=node('button','node');b.type='button';b.dataset.role=role.id;b.setAttribute('aria-pressed','false');
  const top=node('div','node-top');top.append(node('span','role-mark',role.mark),node('i','dot unknown'));
  b.append(top,node('h4','',role.name),node('span','state','Unobserved'),node('p','task-preview','Waiting for shared-state evidence'));
  b.addEventListener('click',()=>{selected=role.id;render();});
  $(role.id==='supervisor'?'supervisor':['catalog','product','reviewer','reliability'].includes(role.id)?'build-nodes':'reach-nodes').append(b);buttons.set(role.id,b);
}
function render(){
  const now=Date.now(),feed=feedState(data,now,failed),views=ROLES.map(r=>roleView(data,r.id,now,feed));
  const feedLabel=({current:'Feed connected',offline:'Offline · snapshot only',stale:'Stale · snapshot only',unknown:'Connecting'})[feed];
  if($('feed-status').textContent!==feedLabel)$('feed-status').textContent=feedLabel;
  $('feed-light').className='feed-indicator '+feed;
  $('fetch-time').textContent=data?'Last successful read '+stamp(data.fetchedAt):'No successful read yet';
  $('queue-time').textContent=data?'Queue last changed '+ago(data.queueUpdatedAt,now):'Queue update unknown';
  $('refresh-error').textContent=failed?'Live state could not be verified. Working lights are off.':'';
  $('revision').textContent=data?'REV '+data.revision:'REV —';
  const active=views.filter(v=>v.state==='working').length;
  $('active-count').textContent=data&&feed==='current'?String(active):'—';
  $('queued-count').textContent=data?String(data.tasks.filter(t=>['ready','retry_wait'].includes(t.status)).length):'—';
  $('blocked-count').textContent=data?String(attentionCount(data,now,feed)):'—';
  if(lastActive!==active){$('headline').replaceChildren(document.createTextNode(active?'Work in motion.':'See the work.'),node('br'),node('em','',active?'Evidence in view.':'Know the state.'));lastActive=active;}
  for(const view of views){const b=buttons.get(view.id);b.setAttribute('aria-pressed',String(view.id===selected));b.dataset.state=view.state;b.querySelector('.dot').className='dot '+view.state;b.querySelector('.state').textContent=LABELS[view.state]||'Unobserved';b.querySelector('.task-preview').textContent=view.current?.title||(view.lastTick?'No open assigned task':'No shared check-in observed');b.setAttribute('aria-label',`${ROLES.find(r=>r.id===view.id).name}: ${LABELS[view.state]}`);}
  const role=ROLES.find(r=>r.id===selected),v=views.find(v=>v.id===selected);
  const detailKey=JSON.stringify([selected,feed,v]);
  if(detailKey!==lastDetailKey){lastDetailKey=detailKey;
  $('detail-name').textContent=role.name;$('detail-purpose').textContent=role.purpose;
  const body=$('detail-body');body.replaceChildren();
  const state=node('div','detail-state');state.append(node('i','dot '+v.state),node('strong','',LABELS[v.state]));body.append(state);
  const field=(label,value,cls='detail-copy')=>{body.append(node('p','detail-label',label),node('p',cls,value));};
  if(v.current){field(v.incoming?'INCOMING HANDOFF':['done','cancelled'].includes(v.current.status)?'LAST RECORDED TASK':'CURRENT ASSIGNMENT',v.current.title);body.append(node('p','detail-id',v.current.id));if(v.incoming)body.append(node('div','detail-callout','Acknowledgement required. Ownership remains with '+ROLES.find(r=>r.id===v.current.owner).name+' until the receiving worker accepts.'));if(v.current.reason)body.append(node('div','detail-callout',v.current.reason));if(v.current.lease){field('LEASE EXPIRES',stamp(v.current.lease.expiresAt));field('ACTIVITY EVIDENCE',stamp(v.current.lease.heartbeatAt));}if(v.current.deadline)field('TASK DEADLINE',stamp(v.current.deadline));}
  else field('CURRENT ASSIGNMENT','No task observed in the shared ledger.');
  field('LAST SHARED CHECK-IN',stamp(v.lastTick),'detail-copy muted');
  field('PLANNED CADENCE',role.cadence+' · nominal, not execution evidence','detail-copy muted');
  field('NEXT PLANNED WAKE','Not exposed by the public ledger. An enabled schedule does not prove a run.','detail-copy muted');
  if(v.tasks.length>1)field('OTHER ASSIGNED RECORDS',v.tasks.slice(1).map(x=>`${LABELS[x.state]} · ${x.task.title}`).join('\n'),'detail-copy muted');
  if(feed!=='current')body.append(node('div','detail-callout','Snapshot context only. Live activity cannot be confirmed until a fresh read succeeds.'));
  }
  const handoffKey=JSON.stringify(data?.handoffs||[]);if(handoffKey===lastHandoffKey)return;lastHandoffKey=handoffKey;
  const list=$('handoffs');list.replaceChildren();
  if(!data?.handoffs?.length)list.append(node('p','detail-copy muted',data?'No handoffs recorded.':'No receipts loaded.'));
  else for(const h of data.handoffs.slice(0,12)){const card=node('article','receipt'),status=node('span','receipt-status',h.acceptedAt?'ACKNOWLEDGED':h.pending?'AWAITING ACK':'HISTORICAL RECEIPT');card.append(status,node('strong','',`${ROLES.find(r=>r.id===h.from).name} → ${ROLES.find(r=>r.id===h.to).name}`),node('p','',h.taskId),node('p','',h.acceptedAt?'Accepted '+stamp(h.acceptedAt):'ACK due '+stamp(h.ackDueAt)));list.append(card);}
}
function validData(d){return d?.schemaVersion===1&&Number.isInteger(d.revision)&&Array.isArray(d.tasks)&&Array.isArray(d.handoffs)&&d.workers&&Number.isFinite(Date.parse(d.fetchedAt))&&Number.isFinite(Date.parse(d.queueUpdatedAt))&&d.tasks.every(t=>ROLES.some(r=>r.id===t.owner)&&typeof t.title==='string');}
async function refresh(){
  const now=Date.now();if(busy||document.hidden||now-lastAttempt<15000)return;
  busy=true;lastAttempt=now;$('refresh').disabled=true;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const r=await fetch('./state.json',{cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});if(!r.ok)throw new Error('Feed unavailable');const d=await r.json();if(!validData(d))throw new Error('Invalid feed');data=d;failed=false;}
  catch{failed=true;}finally{clearTimeout(timer);busy=false;$('refresh').disabled=false;render();}
}
$('refresh').addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();void refresh();}});
setInterval(()=>{if(!document.hidden)render();},1000);
setInterval(()=>{void refresh();},60000);
render();void refresh();
