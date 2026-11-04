/* Website account and guest-trial UX. Anonymous trial state belongs to this browser;
   clearing browser storage or using a different browser starts a fresh trial.
   Server APIs must continue to authenticate independently of these client gates. */
(function(root){
  'use strict';
  const DAY=86400000,TRIAL=3*DAY,KEY='ks.guest.v1',PENDING='ks.signup.pending.v1',REQUESTED='ks.signin.requested.v1';
  const ROLES=[['operator','Operator'],['chef','Chef'],['restaurant_manager','Restaurant manager'],['general_manager','General manager'],['owner','Owner / opening a restaurant'],['supplier','Kitchen equipment supplier'],['other','Other']];
  const USES=[['new_opening','Plan a new opening'],['redesign','Improve an existing kitchen'],['client_project','Design for a client'],['equipment_sales','Specify or sell equipment'],['exploring','Explore an idea']];
  const COUNTRIES='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const verified=u=>!!(u&&u.id&&u.email&&u.email_confirmed_at&&!u.is_anonymous);
  const complete=p=>!!(p&&COUNTRIES.includes(p.country_code)&&ROLES.some(r=>r[0]===p.professional_role)&&USES.some(r=>r[0]===p.use_case));
  const fields=p=>({country_code:p?.country_code||'',professional_role:p?.professional_role||'',use_case:p?.use_case||''});
  function newTrial(now){return {startedAt:now,lastSeenAt:now,actions:0,promptAt:0,expiredReported:false};}
  function normalizeTrial(value,now){
    if(!value)return newTrial(now);
    const start=Number(value.startedAt),last=Number(value.lastSeenAt);
    if(!Number.isFinite(start)||start<=0||start>now||!Number.isFinite(last)||last<start)return {...newTrial(now),startedAt:now-TRIAL};
    return {startedAt:start,lastSeenAt:Math.max(last,now),actions:Math.max(0,Math.min(10000,Math.floor(Number(value.actions)||0))),promptAt:Math.max(0,Number(value.promptAt)||0),expiredReported:value.expiredReported===true};
  }
  const expired=(trial,now)=>Math.max(now,trial.lastSeenAt)-trial.startedAt>=TRIAL;
  const allowed=(feature,user,profile,trial,now)=>verified(user)&&complete(profile)||(!user&&feature==='custom_equipment'&&!expired(trial,now));
  const shouldNudge=(trial,now)=>trial.actions>=3&&(!trial.promptAt||now-trial.promptAt>=DAY);
  root.KS_accessPolicy=Object.freeze({TRIAL,DAY,COUNTRIES,ROLES,USES,verified,complete,newTrial,normalizeTrial,expired,allowed,shouldNudge});

  root.KS_createAccess=function({backend,measure=()=>{},onReady=()=>{},clock=()=>Date.now(),storage}={}){
    const doc=root.document;
    if(!storage)try{storage=root.localStorage;}catch(_){}
    let user=null,profile=null,loading=false,generation=0,dialog=null,notice=null,reason='account',prompted=false,nudgeTimer=null,interval=null,previousFocus=null;
    const emit=(name,data={})=>{try{measure(name,data);}catch(_){}};
    const get=k=>{try{return JSON.parse(storage.getItem(k)||'null');}catch(_){return null;}};
    const put=(k,v)=>{try{storage.setItem(k,JSON.stringify(v));}catch(_){}};
    const remove=k=>{try{storage.removeItem(k);}catch(_){}};
    let trial=normalizeTrial(get(KEY),clock()),trialStarted=false;
    const persistTrial=()=>{trial.lastSeenAt=Math.max(trial.lastSeenAt,clock());put(KEY,trial);};
    const ready=()=>!loading&&verified(user)&&complete(profile);
    const identify=()=>{try{if(verified(user))root.KS_analytics?.identify(user.id,profile||{});}catch(_){}};
    function touchTrial(){
      if(user)return;
      if(!trialStarted){trialStarted=true;if(!get(KEY))emit('Guest Trial Started');}
      persistTrial();
      if(expired(trial,clock())&&!trial.expiredReported){trial.expiredReported=true;persistTrial();emit('Guest Trial Expired');}
    }
    function renderNotice(){
      if(!notice){notice=doc.createElement('div');notice.id='ksTrialNotice';notice.className='ks-trial-notice';notice.setAttribute('role','status');doc.body.appendChild(notice);}
      notice.hidden=ready();if(notice.hidden)return;
      if(user){notice.innerHTML='<span>Complete your profile to save and export.</span><button type="button" class="btn sm">Complete profile</button>';}
      else{touchTrial();const hours=Math.max(0,Math.ceil((trial.startedAt+TRIAL-Math.max(clock(),trial.lastSeenAt))/3600000));const time=hours>24?Math.ceil(hours/24)+' days':hours+' hours';
        notice.innerHTML=`<span>${hours?'Guest trial · '+time+' left':'Guest trial ended · basic planning available'}</span><button type="button" class="btn sm">Create free account</button>`;}
      notice.querySelector('button').onclick=()=>show(user?'profile_required':'account');
    }
    function ensureDialog(){
      if(dialog)return;
      dialog=doc.createElement('dialog');dialog.id='ksAccessDialog';dialog.className='ks-access-dialog';dialog.setAttribute('aria-labelledby','ksAccessTitle');doc.body.appendChild(dialog);
      dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
      dialog.addEventListener('click',e=>{if(e.target===dialog)dismiss();});
    }
    function close(success=false){
      if(!dialog?.open)return;
      if(!success&&prompted){emit('Signup Prompt Dismissed',{reason,action:'dismiss'});trial.promptAt=clock();persistTrial();}
      prompted=false;dialog.close();previousFocus?.focus?.();
    }
    function dismiss(){close(false);}
    function options(list,current,empty){return `<option value="">${empty}</option>`+list.map(([v,t])=>`<option value="${v}"${v===current?' selected':''}>${esc(t)}</option>`).join('');}
    function countryOptions(current){let names;try{names=new Intl.DisplayNames(['en'],{type:'region'});}catch(_){}return options(COUNTRIES.map(c=>[c,names?names.of(c):c]).sort((a,b)=>a[1].localeCompare(b[1])),current,'Choose country');}
    const draftKey=email=>String(email||'').trim().toLowerCase();
    function savePending(email,data,method){const pending={email:draftKey(email),profile:fields(data),method,at:clock()};put(PENDING,pending);}
    function pendingFor(u){const p=get(PENDING);return p&&clock()-p.at<DAY&&clock()>=p.at&&complete(p.profile)&&(p.email===draftKey(u.email)||(!p.email&&p.method==='google'))?p:null;}
    function redirect(){return /^\/oauth\/consent\/?$/.test(root.location.pathname)?root.location.href:undefined;}
    function profileForm(data){return `<div class="ks-access-grid"><div class="fld"><label for="ksCountry">Country</label><select id="ksCountry" required autocomplete="country">${countryOptions(data.country_code)}</select></div><div class="fld"><label for="ksRole">Your role</label><select id="ksRole" required>${options(ROLES,data.professional_role,'Choose role')}</select></div></div><div class="fld"><label for="ksUseCase">What are you planning?</label><select id="ksUseCase" required>${options(USES,data.use_case,'Choose your goal')}</select></div>`;}
    const readFields=()=>({country_code:doc.getElementById('ksCountry').value,professional_role:doc.getElementById('ksRole').value,use_case:doc.getElementById('ksUseCase').value});
    function message(text){const el=doc.getElementById('ksAccessMessage');if(el)el.textContent=text;}
    function show(why='account',note){
      ensureDialog();reason=why;clearTimeout(nudgeTimer);nudgeTimer=null;
      const signed=verified(user),data=fields(profile);const isOpen=dialog.open;
      if(!isOpen){previousFocus=doc.activeElement;prompted=true;emit('Signup Prompt Viewed',{reason});trial.promptAt=clock();persistTrial();}
      const copy=note||({engagement:'Your kitchen is taking shape. Create a free account to keep it online and export your plans.',export:'Create a free account to export your kitchen plans and equipment schedules.',save:'Create a free account to save kitchens online and open them on any device.',mcp:'Sign in to connect an AI assistant to your saved kitchens.',custom_equipment:'Your guest trial has ended. Create a free account to add your own equipment.',trial_expired:'Your guest trial has ended. Create a free account to add equipment, save and export.',profile_required:'Just a few details to finish your account. Your kitchen stays right here.',account:'Save your kitchens, export plans and add your own equipment.'}[why]||'Create your free Kitchen Studio account.');
      dialog.innerHTML=`<button type="button" class="ks-access-close" aria-label="Close signup">×</button><div class="ks-access-eyebrow">KITCHEN STUDIO · FREE ACCOUNT</div><h2 id="ksAccessTitle">${signed?'Finish your profile':'Keep building your kitchen'}</h2><p class="ks-access-lead">${esc(copy)}</p><form id="ksAccessForm">${signed?'':`<div class="fld"><label for="ksEmail">Email</label><input id="ksEmail" type="email" required autocomplete="email" inputmode="email" placeholder="you@company.com"></div>`}${profileForm(data)}<button id="ksAccessSubmit" type="submit" class="btn pri ks-access-submit">${signed?'Save profile & continue':'Email me a sign-in link'}</button>${signed?'':'<button id="ksAccessGoogle" type="button" class="btn ks-access-submit" hidden>Continue with Google</button><button id="ksReturning" type="button" class="ks-access-link">Already have an account? Sign in</button>'}<p id="ksAccessMessage" class="note" role="status" aria-live="polite"></p></form><p class="ks-access-privacy">${signed?'Your profile helps us understand how Kitchen Studio is used.':'No password. Verify your email to unlock your account.'} Your draft stays on this device. This does not subscribe you to marketing emails.</p><button type="button" id="ksAccessLater" class="ks-access-link">Keep planning for now</button>`;
      dialog.querySelector('.ks-access-close').onclick=dismiss;doc.getElementById('ksAccessLater').onclick=dismiss;
      const form=doc.getElementById('ksAccessForm');form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const data=readFields();if(!complete(data)){message('Choose your country, role and goal.');return;}const button=doc.getElementById('ksAccessSubmit');button.disabled=true;
        try{if(!backend)throw new Error('Sign-in is temporarily unavailable. Your draft is safe here; please try again shortly.');
          if(signed){const owner=user.id;const saved=await backend.saveProfile(data);if(user?.id!==owner)return;profile=complete(saved)?saved:data;identify();emit('Profile Completed',{action:'profile'});close(true);renderNotice();await onReady();}
          else{const email=doc.getElementById('ksEmail').value.trim();savePending(email,data,'email');await backend.signInEmail(email,redirect(),data);put(REQUESTED,{email:draftKey(email),at:clock(),method:'email'});emit('Sign In Requested',{reason,action:'email'});message('Check your inbox for your sign-in link. You can keep this kitchen open while you verify your email.');button.textContent='Send another link';}
        }catch(error){message(error?.message||'Could not complete sign-in. Please try again.');}finally{button.disabled=false;}
      };
      if(!signed){
        doc.getElementById('ksReturning').onclick=()=>returning(why);
        const google=doc.getElementById('ksAccessGoogle');Promise.resolve(backend?.providers?.()).then(p=>{if(Array.isArray(p)&&p.includes('google')&&google.isConnected)google.hidden=false;}).catch(()=>{});
        google.onclick=async()=>{const data=readFields();if(!complete(data)){form.reportValidity();message('Choose your country, role and goal, then continue with Google.');return;}google.disabled=true;try{savePending('',data,'google');put(REQUESTED,{email:'',at:clock(),method:'google'});await backend.signInGoogle(redirect());emit('Sign In Requested',{reason,action:'google'});}catch(error){remove(REQUESTED);message(error?.message||'Google sign-in is unavailable.');google.disabled=false;}};
      }
      if(!isOpen){try{dialog.showModal();}catch(_){dialog.setAttribute('open','');}}
    }
    function returning(why){
      reason=why;dialog.innerHTML=`<button type="button" class="ks-access-close" aria-label="Close signup">×</button><h2 id="ksAccessTitle">Welcome back</h2><p class="ks-access-lead">We’ll email you a link to sign in. No password needed.</p><form id="ksReturnForm"><div class="fld"><label for="ksEmail">Email</label><input id="ksEmail" type="email" required autocomplete="email" inputmode="email"></div><button id="ksAccessSubmit" class="btn pri ks-access-submit" type="submit">Email me a sign-in link</button><p id="ksAccessMessage" class="note" role="status" aria-live="polite"></p></form><button id="ksCreateInstead" class="ks-access-link" type="button">Create a new account</button>`;
      dialog.querySelector('.ks-access-close').onclick=dismiss;doc.getElementById('ksCreateInstead').onclick=()=>show(why);
      const form=doc.getElementById('ksReturnForm');form.onsubmit=async e=>{e.preventDefault();if(!form.reportValidity())return;const button=doc.getElementById('ksAccessSubmit');button.disabled=true;try{if(!backend)throw new Error('Sign-in is temporarily unavailable. Please try again shortly.');const email=doc.getElementById('ksEmail').value.trim();await backend.signInEmail(email,redirect());put(REQUESTED,{email:draftKey(email),at:clock(),method:'email'});emit('Sign In Requested',{reason,action:'email'});message('Check your inbox for your sign-in link. Your draft is safe here.');button.textContent='Send another link';}catch(error){message(error?.message||'Could not send the link.');}finally{button.disabled=false;}};
    }
    async function authChanged(next,{initial=false}={}){
      const token=++generation,previous=user?.id;user=verified(next)?next:null;profile=null;loading=!!user;clearTimeout(nudgeTimer);nudgeTimer=null;identify();
      if(!user){loading=false;if(previous)try{root.KS_analytics?.reset();}catch(_){}close(true);renderNotice();return false;}
      try{const loaded=await backend.getProfile();if(token!==generation)return false;profile=loaded;const pending=pendingFor(user);
        if(!complete(profile)&&pending){const saved=await backend.saveProfile(pending.profile);if(token!==generation)return false;profile=complete(saved)?saved:pending.profile;remove(PENDING);identify();emit('Profile Completed',{action:'profile'});}
        else if(complete(profile)){
          // A new-account trigger can save signup metadata before this browser returns.
          // Count that completion once, without recounting an older returning profile.
          if(pending&&Date.parse(profile.onboarding_completed_at)>=pending.at){identify();emit('Profile Completed',{action:'profile'});}
          remove(PENDING);
        }
      }catch(_){if(token!==generation)return false;profile=null;}
      if(token!==generation)return false;loading=false;identify();const requested=get(REQUESTED);const returningFromLink=requested&&clock()>=requested.at&&clock()-requested.at<DAY&&(requested.email===draftKey(user.email)||(!requested.email&&requested.method==='google'));if((!initial&&previous!==user.id)||returningFromLink){emit('Sign In Completed');remove(REQUESTED);}renderNotice();
      if(ready())close(true);else show('profile_required');return ready();
    }
    function gate(feature){
      if(!['export','save','mcp','custom_equipment'].includes(feature))return false;
      touchTrial();renderNotice();if(!loading&&allowed(feature,user,profile,trial,clock()))return true;
      emit('Feature Gated',{feature,reason:loading?'profile_required':user?'profile_required':feature});show(user?'profile_required':feature);return false;
    }
    function action(){
      if(user)return;touchTrial();trial.actions++;persistTrial();renderNotice();
      if(shouldNudge(trial,clock())&&!dialog?.open&&!nudgeTimer)nudgeTimer=setTimeout(()=>{nudgeTimer=null;if(!user&&!dialog?.open&&!doc.querySelector('dialog[open]'))show(expired(trial,clock())?'trial_expired':'engagement');},450);
    }
    return {gate,action,account:(note)=>show(user?'profile_required':'account',note),isReady:ready,profile:()=>profile,authChanged,
      start:async()=>{const ok=await authChanged(backend?.user?.()||null,{initial:true});if(!interval)interval=setInterval(renderNotice,60000);return ok;},
      destroy:()=>{generation++;clearTimeout(nudgeTimer);clearInterval(interval);dialog?.remove();notice?.remove();},
      trial:()=>({...trial,expired:expired(trial,clock())})};
  };
})(window);
