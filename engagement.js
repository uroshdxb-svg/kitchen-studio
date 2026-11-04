/* Customer research stays in the private reports inbox. Free text and contact details
   are never sent to analytics. Consent is explicit and recorded with each response. */
(function(root){
  'use strict';
  const RELEASES=[{id:'2026-11-04',date:'4 November 2026',title:'Keep your kitchen moving',items:[
    'Create a free account with an email sign-in link, save kitchens online and return on another device.',
    'Export plans as PDF or SVG and equipment schedules as CSV after signing in.',
    'Tell us what is missing through Report a gap, or share your priorities through Help shape Kitchen Studio.'
  ]}];
  const SOURCES=[['google','Google / search'],['ai','ChatGPT / another AI assistant'],['instagram','Instagram'],['linkedin','LinkedIn'],['youtube','YouTube'],['supplier','Equipment supplier'],['recommendation','Friend / colleague'],['other','Other']];
  const PAYMENT=[['not_sure','Not sure yet'],['free_only','I would only use a free version'],['per_project','Per kitchen / project'],['per_export','Per export'],['subscription','Monthly / annual subscription'],['setup_service','A paid setup / design service']];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const options=rows=>rows.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('');
  root.KS_createEngagement=function({backend=()=>null,open,close,measure=()=>{}}){
    const doc=root.document,$=id=>doc.getElementById(id),seenKey='ks.updates.seen.v1';
    const seen=()=>{try{return root.localStorage.getItem(seenKey);}catch(_){return null;}};
    const badge=$('ksUpdatesBadge');if(badge)badge.hidden=seen()===RELEASES[0].id;
    function updates(){
      open("What's new",`<p>Recent improvements to Kitchen Studio.</p>${RELEASES.map(r=>`<article><p class="note">${esc(r.date)}</p><h3>${esc(r.title)}</h3><ul>${r.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></article>`).join('')}<div class="bar"><button class="btn pri" id="ksUpdateFeedback">Tell us what to build next</button><button class="btn" id="ksUpdateClose">Close</button></div>`);
      try{root.localStorage.setItem(seenKey,RELEASES[0].id);}catch(_){}if(badge)badge.hidden=true;
      measure('Updates Viewed');$('ksUpdateFeedback').onclick=research;$('ksUpdateClose').onclick=close;
    }
    function research(){
      const be=backend(),user=be?.user?.();
      if(!be?.report){open('Help shape Kitchen Studio','<p>Feedback is available in the online app at kitchenstudio.design.</p>');return;}
      open('Help shape Kitchen Studio',`<p>What would make this useful enough for your next real project? About a minute. Pricing questions are research; there is no purchase or commitment.</p>
        <form id="ksResearchForm">
        <div class="fld"><label for="ksResearchGoal">What are you trying to get done?</label><textarea id="ksResearchGoal" required minlength="3" maxlength="800" rows="2" placeholder="e.g. Plan a cafe kitchen before asking suppliers for quotes"></textarea></div>
        <div class="fld"><label for="ksResearchBlocker">What is missing or getting in your way?</label><textarea id="ksResearchBlocker" required minlength="3" maxlength="800" rows="2"></textarea></div>
        <div class="fld"><label for="ksResearchAlternative">How do you do this today? (optional)</label><input id="ksResearchAlternative" maxlength="300" placeholder="e.g. AutoCAD, supplier drawings, pen and paper"></div>
        <div class="fld"><label for="ksResearchValue">What result or feature would you consider paying for? (optional)</label><input id="ksResearchValue" maxlength="500"></div>
        <div class="fld"><label for="ksResearchPayment">How would you prefer to pay? (optional)</label><select id="ksResearchPayment">${options(PAYMENT)}</select></div>
        <div class="fld"><label for="ksResearchBudget">What budget would make sense for that? (optional)</label><input id="ksResearchBudget" maxlength="120" placeholder="Amount + currency + per project / month / export"></div>
        <div class="fld"><label for="ksResearchSource">How did you find us? (optional)</label><select id="ksResearchSource"><option value="">Choose or skip</option>${options(SOURCES)}</select></div>
        ${user?'':`<div class="fld"><label for="ksResearchEmail">Email (only needed if you want us to contact you)</label><input id="ksResearchEmail" type="email" maxlength="254" autocomplete="email"></div>`}
        <div class="checks"><label><input id="ksResearchContact" type="checkbox"> You may email me about my feedback or a short research conversation.</label></div>
        <div class="checks"><label><input id="ksResearchUpdates" type="checkbox"> Email me occasional product updates. I can opt out by replying.</label></div>
        <p class="note">Both choices are optional. Submit again to change these preferences. No kitchen file is attached.</p>
        <div class="bar"><button id="ksResearchSend" class="btn pri" type="submit">Send feedback</button><button id="ksResearchCancel" class="btn" type="button">Cancel</button></div>
        <p id="ksResearchMessage" class="note" role="status" aria-live="polite"></p></form>`);
      measure('Research Viewed');$('ksResearchCancel').onclick=close;
      const form=$('ksResearchForm');
      form.onsubmit=async e=>{
        e.preventDefault();if(!form.reportValidity())return;
        const goal=$('ksResearchGoal').value.trim(),blocker=$('ksResearchBlocker').value.trim();
        const contact=$('ksResearchContact').checked,updates=$('ksResearchUpdates').checked;
        const email=user?.email||$('ksResearchEmail')?.value.trim()||null;
        const note=$('ksResearchMessage'),button=$('ksResearchSend');
        if((be.user?.()?.id||null)!==(user?.id||null)){note.textContent='Your account changed. Close and reopen this form before sending.';return;}
        if(goal.length<3||blocker.length<3){note.textContent='Tell us a little more about your goal and blocker.';return;}
        if((contact||updates)&&!email){note.textContent='Add an email address for the contact options you selected.';return;}
        const context={type:'customer_research',version:'v1',goal,blocker,alternative:$('ksResearchAlternative').value.trim(),paid_value:$('ksResearchValue').value.trim(),payment_preference:$('ksResearchPayment').value,budget:$('ksResearchBudget').value.trim(),discovery_source:$('ksResearchSource').value||null,research_contact_consent:contact,product_updates_consent:updates,consent_version:'research-v1',consent_recorded_at:new Date().toISOString()};
        button.disabled=true;note.textContent='Sending…';
        try{
          // Capture only submitted answers, never the working kitchen or page URL.
          await be.report({kind:'feature',message:`Goal: ${goal}\nBlocker: ${blocker}`,email,view:'research',context,project:null});
          measure('Research Submitted');
          if(form.isConnected){open('Thank you',`<p>Your feedback has been sent. ${contact?'You have opted in to a research follow-up.':''} ${updates?'You have opted in to occasional product updates.':''}</p><button id="ksResearchDone" class="btn pri">Close</button>`);$('ksResearchDone').onclick=close;}
        }catch(error){if(form.isConnected){button.disabled=false;note.textContent='Could not send: '+(error?.message||'Please try again. Your answers are still here.');}}
      };
    }
    return {updates,research};
  };
})(window);
