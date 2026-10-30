/* Private document review. No raw document is saved or included in a contribution. */
(function(root){
  "use strict";
  root.KS_createIntake=function(hooks){
    const I=root.KS_intake,$=id=>document.getElementById(id);
    const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    const uuid=()=>crypto.randomUUID();
    let draft=null,owner=null,busy=false,generation=0,readController=null;
    const dialog=$("intakeDlg"),body=$("intakeBody");
    const scope=()=>hooks.owner()||"device",storageKey=()=>"ks.intake.v1."+owner;
    function store(){try{localStorage.setItem(storageKey(),JSON.stringify(draft));return true;}catch(_){return false;}}
    function notice(text){$("intakeMessage").textContent=text;}
    function active(token){return token===generation&&owner===scope();}
    function load(){owner=scope();try{const d=JSON.parse(localStorage.getItem(storageKey())||"null");draft=d&&d.schema===1&&Array.isArray(d.rows)&&d.rows.length<=I.LIMITS.rows?d:null;}catch(_){draft=null;}}
    function open(){generation++;load();render();dialog.showModal();}
    function close(){if(busy)return;dialog.close();generation++;}
    $("intakeOpen").onclick=open;$("intakeClose").onclick=close;
    dialog.addEventListener("cancel",e=>{if(busy)e.preventDefault();else generation++;});
    function lock(on){busy=on;dialog.setAttribute("aria-busy",String(on));$("intakeClose").disabled=on;body.querySelectorAll("input,textarea,select,button").forEach(el=>el.disabled=on&&el.id!=="intakeCancel");if($("intakeCancel"))$("intakeCancel").hidden=!on;}
    function start(rows){draft={schema:1,id:uuid(),createdAt:new Date().toISOString(),rows:rows.map(data=>({id:uuid(),data,selected:true,match:null,confirmed:false,contribute:false,saved:false,placed:false,cloud:"",request:""}))};store();render();}
    function field(row,f,label,type="text"){
      const v=row.data[f],rid=row.id+"-"+f;
      return `<div class="fld"><label for="${rid}">${label}</label><input id="${rid}" data-field="${f}" type="${type}" ${type==="number"?'min="0" step="any"':''} value="${esc(v)}" maxlength="${f==="src"?1000:240}" ${row.saved?"disabled":""}></div>`;
    }
    function select(row,f,label,choices){return `<div class="fld"><label for="${row.id}-${f}">${label}</label><select id="${row.id}-${f}" data-field="${f}" ${row.saved?"disabled":""}>${choices.map(([v,t])=>`<option value="${v}" ${String(row.data[f]??"")===v?"selected":""}>${t}</option>`).join("")}</select></div>`;}
    function effective(row){
      const match=I.matches(row.data,hooks.catalogue).find(m=>m.index===row.match);
      return match?{...match.equipment,qty:row.data.qty}:row.data;
    }
    function render(){
      if(!draft){body.innerHTML=`<p class="intake-lead">Turn a supplier quotation into equipment for your kitchen.</p>
        <ol class="intake-steps"><li class="current">1 · Upload</li><li>2 · Review</li><li>3 · Add</li></ol>
        <div class="intake-upload"><label for="intakeFile"><b>Choose a quotation or specification</b></label><input id="intakeFile" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.tsv,.txt">
        <p class="note">PDF (up to 4 pages), photo, CSV or tab-separated table. Up to 10 MB and 50 equipment lines. Export Excel files as CSV.</p></div>
        <div class="fld"><label for="intakeText">Or paste equipment lines</label><textarea id="intakeText" rows="5" maxlength="60000" placeholder="Paste a quotation excerpt or a table with Brand, Model, Qty, Width mm, Depth mm, Height mm…"></textarea></div>
        <p class="note">Files are read on your device. No AI service, API key or sign-in is needed. Image text recognition supports printed English; check model numbers and measurements carefully. Original files and recognized text are not stored. Equipment review drafts stay in this browser.</p>
        <div class="bar"><button id="intakeRead" class="btn pri">Review equipment</button><button id="intakeCancel" class="btn" hidden>Cancel reading</button><button id="intakeManual" class="btn">Enter manually</button><button id="intakeTemplate" class="btn sm">Sample CSV</button>${owner!=="device"?'<button id="intakeDevice" class="btn sm">Open this device’s draft</button>':''}</div>`;
        $("intakeRead").onclick=read;$("intakeManual").onclick=()=>start([I.normalize({})]);
        $("intakeCancel").onclick=()=>readController?.abort();
        $("intakeTemplate").onclick=()=>hooks.download("equipment-template.csv","brand,model,name,qty,w,d,h,units,mount,power,kw,elec,water,drain,region,variant,src\r\nExample manufacturer,Exact model,Equipment description,1,600,700,850,mm,floor,,,,,,,,\r\n");
        if($("intakeDevice"))$("intakeDevice").onclick=()=>{try{const d=JSON.parse(localStorage.getItem("ks.intake.v1.device")||"null");if(!d||d.schema!==1||!Array.isArray(d.rows)||d.rows.length>I.LIMITS.rows){notice("No signed-out review draft is stored on this device.");return;}if(!confirm("Open this device’s signed-out draft in your account? Its saved models can then be saved online when you choose Retry."))return;draft=d;store();render();notice("Device draft opened. Choose Retry online saves / requests to sync saved models.");}catch(_){notice("The device draft could not be opened.");}};
        notice("Original documents stay out of your project and the shared catalogue.");return;
      }
      for(const r of draft.rows){if(r.match!==null&&!r.saved){const index=hooks.catalogue.findIndex(e=>I.catalogueKey(e)===r.matchKey);if(index<0){r.match=null;r.confirmed=false;r.catalogueChanged=true;}else r.match=index;}}
      body.innerHTML=`<ol class="intake-steps"><li>1 · Upload</li><li class="current">2 · Review</li><li>3 · Add</li></ol>
        <p class="intake-lead">Check the identity, quantity and dimensions.</p><p class="note">${draft.rows.length} lines · Dimensions are in mm. New models remain user supplied and unverified. Only items with dimensions and placement can enter the layout; incomplete lines stay here as a draft.</p>
        <div id="intakeRows">${draft.rows.map((r,n)=>rowHTML(r,n)).join("")}</div>
        <div class="intake-footer"><p class="note">Contributions send only the product fields shown above for manufacturer review. Review requests do not publish equipment. Original documents, excerpts, quantities and negotiated prices are not attached. Your account identifies the request.</p>
        <div class="bar"><button id="intakeAdd" class="btn pri">Save & add selected</button><button id="intakeSave" class="btn">Save models only</button><button id="intakeRetry" class="btn">Retry online saves / requests</button></div>
        <div class="bar"><button id="intakeMore" class="btn sm">Add another line</button><button id="intakeReset" class="btn sm danger">Discard this review</button></div></div>`;
      body.querySelectorAll("[data-row]").forEach(card=>{
        const r=draft.rows.find(x=>x.id===card.dataset.row);
        card.querySelectorAll("[data-field]").forEach(el=>el.onchange=()=>{
          r.data=I.normalize({...r.data,[el.dataset.field]:el.value});r.confirmed=false;r.match=null;store();render();
        });
        card.querySelector("[data-select]").onchange=e=>{r.selected=e.target.checked;store();};
        const m=card.querySelector("[data-match]");if(m)m.onchange=e=>{r.match=e.target.value===""?null:Number(e.target.value);r.matchKey=r.match===null?null:I.catalogueKey(hooks.catalogue[r.match]);r.catalogueChanged=false;r.confirmed=false;store();render();};
        const c=card.querySelector("[data-confirm]");if(c)c.onchange=e=>{r.confirmed=e.target.checked;store();};
        const s=card.querySelector("[data-contribute]");if(s)s.onchange=e=>{r.contribute=e.target.checked;store();};
      });
      $("intakeAdd").onclick=()=>apply(true);$("intakeSave").onclick=()=>apply(false);$("intakeRetry").onclick=()=>retry();
      $("intakeMore").onclick=()=>{if(draft.rows.length>=I.LIMITS.rows){notice("This review is limited to 50 lines.");return;}draft.rows.push({id:uuid(),data:I.normalize({}),selected:true,match:null,confirmed:false,contribute:false,saved:false,placed:false,cloud:"",request:""});store();render();};
      $("intakeReset").onclick=()=>{if(!confirm("Discard this review draft? Equipment already saved or placed will stay."))return;draft=null;store();render();};
    }
    function rowHTML(r,n){
      const matches=I.matches(r.data,hooks.catalogue),errors=I.validate(effective(r));
      const status=r.saved?`${r.match===null?"Saved privately":"Catalogue item confirmed"}${r.placed?" · added to layout":""}${r.cloud?" · "+r.cloud:""}${r.request?" · "+r.request:""}`:errors.length?"Needs details":matches.length?"Catalogue match available":"New private model";
      const choices=[["","Unknown"],["true","Yes"],["false","No"]];
      return `<section class="intake-card" data-row="${r.id}"><div class="intake-row-head"><label class="checks"><span><input type="checkbox" data-select ${r.selected?"checked":""} ${r.placed?"disabled":""}> ${n+1}. ${esc(r.data.brand||"Equipment")} ${esc(r.data.model)}</span></label><span class="pill ${r.saved?"me":"warn"}">${esc(status)}</span></div>
        ${r.catalogueChanged?'<p class="note warnbox">The catalogue specifications changed since this draft. Compare and confirm the model again.</p>':''}
        ${r.data.excerpt?`<details><summary>Document excerpt</summary><blockquote>${esc(r.data.excerpt)}</blockquote></details>`:""}
        <details ${!r.saved?"open":""}><summary>Product details</summary><div class="intake-fields">
          ${field(r,"brand","Manufacturer")}${field(r,"model","Full model / private reference")}${field(r,"name","Description")}${field(r,"qty","Quantity","number")}
          ${field(r,"w","Width mm","number")}${field(r,"d","Depth mm","number")}${field(r,"h","Height mm","number")}
          ${select(r,"mount","Placement",[["","Choose placement"],["floor","Floor"],["top","Counter / stand"]])}
          ${select(r,"cat","Category",[["","Unspecified"],...hooks.categories.map(c=>[c,c])])}
          ${select(r,"power","Energy",[["","Unknown"],["electric","Electric"],["gas","Gas"],["charcoal","Charcoal"],["none","None"]])}
          ${field(r,"kw","Input load kW","number")}${field(r,"elec","Electrical supply")}
          ${select(r,"water","Water connection",choices)}${select(r,"drain","Drain connection",choices)}
          ${field(r,"region","Market / region")}${field(r,"variant","Configuration / suffix")}${field(r,"src","Product source URL")}
        </div></details>
        ${!r.saved&&matches.length?`<div class="fld"><label for="${r.id}-match">Compare with the catalogue</label><select id="${r.id}-match" data-match><option value="">Keep my supplied specifications</option>${matches.map(m=>`<option value="${m.index}" ${r.match===m.index?"selected":""}>Use catalogue: ${esc(m.equipment.brand+" "+m.equipment.model)} · ${m.equipment.w} × ${m.equipment.d} × ${m.equipment.h} mm · ${esc(m.equipment.elec||m.equipment.power||"")}</option>`).join("")}</select></div><p class="note">${matches.map(m=>m.conflicts.length?"Check differences: "+esc(m.conflicts.join(", ")):"Same model name; confirm the exact market and configuration.").join(" · ")} Choosing the catalogue uses its specifications.</p>`:""}
        ${!r.saved&&r.match!==null?`<p class="note">Using catalogue specifications: ${effective(r).w} × ${effective(r).d} × ${effective(r).h} mm · ${esc(effective(r).power)} · ${effective(r).kw??"Unknown"} kW · ${esc(effective(r).elec||"Supply unspecified")} · water ${I.connection(effective(r).water)} · drain ${I.connection(effective(r).drain)}.</p>`:""}
        ${!r.saved?`<p class="note ${errors.length?"warnbox":""}">${errors.length?esc(errors.join(" ")):"Ready for your confirmation. Missing utility values remain unknown."}</p><label class="checks"><span><input type="checkbox" data-confirm ${r.confirmed?"checked":""}> I checked the exact model, configuration, quantity and dimensions.</span></label>`:""}
        ${r.match===null&&r.request!=="Review requested"?`<label class="checks"><span><input type="checkbox" data-contribute ${r.contribute?"checked":""}> Contribute these product specifications for verification.</span></label>`:""}
      </section>`;
    }
    function reviewText(text){
      const uploadNodes=[...body.childNodes];
      body.innerHTML=`<ol class="intake-steps"><li class="current">1 · Check text</li><li>2 · Review fields</li><li>3 · Add</li></ol>
        <p class="intake-lead">Check the recognized text</p><p class="note">Keep equipment details only. Put each item in a separate block with a blank line between items. Correct misread model numbers. Labels such as Brand:, Model:, Width: 600 mm, Depth: 700 mm and Height: 850 mm help fill fields. Unlabelled dimensions and missing details stay blank.</p>
        <div class="fld"><label for="intakeRecognized">Editable document text</label><textarea id="intakeRecognized" rows="8" maxlength="60000"></textarea></div>
        <p class="note">Text recognition cannot identify equipment from a photograph without readable text. You can always enter details manually.</p>
        <div class="bar"><button id="intakeBuild" class="btn pri">Review equipment fields</button><button id="intakeBack" class="btn">Back to upload</button></div>`;
      $("intakeRecognized").value=text;
      $("intakeBack").onclick=()=>{body.replaceChildren(...uploadNodes);lock(false);notice("Your original input is still selected.");};
      $("intakeBuild").onclick=()=>{try{const rows=KS_reader.parseText($("intakeRecognized").value,hooks.catalogue);start(rows);notice("Check every field. Missing specifications remain unknown; nothing has been added yet.");}catch(e){notice(e.message);}};
      notice(text.trim()?"Text read on your device. Check it before creating equipment rows.":"No readable text was found. Paste or type equipment details here, or go back and try a clearer crop.");
    }
    async function documentData(file,signal){
      if(file.size>I.LIMITS.fileBytes)throw new Error("The file is larger than 10 MB. Split or compress it first.");
      const ext=file.name.split(".").pop().toLowerCase();
      if(["csv","tsv","txt"].includes(ext)){const text=await file.text();if(text.length>I.LIMITS.text)throw new Error("Use a smaller document (up to 60,000 characters).");return {text,table:["csv","tsv"].includes(ext),delimiter:ext==="tsv"?"\t":","};}
      const ocr=(cv,prefix="")=>KS_readImage(cv,{signal,onProgress:message=>{if(!signal.aborted)notice(prefix+message);}});
      if(ext==="pdf"){
        await hooks.pdfReady();signal.throwIfAborted();
        const loading=pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
        const abort=()=>{void loading.destroy();};signal.addEventListener("abort",abort,{once:true});
        try{
          const doc=await loading.promise;
          if(doc.numPages>I.LIMITS.pages)throw new Error("This PDF has "+doc.numPages+" pages. Select a file of up to 4 pages so every page can be reviewed.");
          const pages=[];
          for(let n=1;n<=doc.numPages;n++){
            signal.throwIfAborted();const page=await doc.getPage(n),tc=await page.getTextContent();
            let text=tc.items.map(t=>t.str+(t.hasEOL?"\n":" ")).join("").trim();
            if(!text){
              notice("Reading scanned page "+n+" of "+doc.numPages+"…");
              const v=page.getViewport({scale:1}),vp=page.getViewport({scale:Math.min(3,2400/Math.max(v.width,v.height))});
              const cv=document.createElement("canvas");cv.width=Math.ceil(vp.width);cv.height=Math.ceil(vp.height);
              try{await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;text=await ocr(cv,"Page "+n+" of "+doc.numPages+": ");}finally{cv.width=cv.height=0;}
            }
            pages.push(text);if(pages.join("\n\n").length>I.LIMITS.text)throw new Error("This PDF contains too much text. Split it into smaller files.");
          }
          return {text:pages.join("\n\n")};
        }finally{signal.removeEventListener("abort",abort);await loading.destroy();}
      }
      if(!["png","jpg","jpeg","webp"].includes(ext))throw new Error("Use PDF, PNG, JPEG, WebP, CSV, TSV or text. Export Excel files as CSV.");
      const bitmap=await createImageBitmap(file);signal.throwIfAborted();
      const cv=document.createElement("canvas");
      try{
        const scale=Math.min(2,2400/Math.max(bitmap.width,bitmap.height));cv.width=Math.max(1,Math.round(bitmap.width*scale));cv.height=Math.max(1,Math.round(bitmap.height*scale));
        const cx=cv.getContext("2d");cx.fillStyle="#fff";cx.fillRect(0,0,cv.width,cv.height);cx.drawImage(bitmap,0,0,cv.width,cv.height);
        const text=await ocr(cv);if(text.length>I.LIMITS.text)throw new Error("Too much text was found. Use a smaller crop.");return {text};
      }finally{bitmap.close();cv.width=cv.height=0;}
    }
    async function read(){
      const file=$("intakeFile").files[0],text=$("intakeText").value.trim(),token=generation;
      if(file&&text){notice("Choose a file or pasted text, so the source is unambiguous.");return;}
      if(!file&&!text){notice("Choose a document, paste equipment lines or enter manually.");return;}
      const controller=new AbortController();readController=controller;lock(true);notice("Reading on your device… Your file will stay selected if this cannot finish.");
      try{
        const source=file?await documentData(file,controller.signal):{text,table:/^(brand|manufacturer)[,\t]/i.test(text)};
        controller.signal.throwIfAborted();if(!active(token))return;
        if(source.table){start(I.parseDelimited(source.text,source.delimiter));notice("Check the equipment fields below. Nothing has been added yet.");}
        else reviewText(source.text);
      }catch(e){if(active(token))notice(controller.signal.aborted?"Reading cancelled. Your file is still selected.":e.message||"Could not read this document. Try manual entry.");}
      finally{if(readController===controller){readController=null;lock(false);if(draft)render();}}
    }
    async function syncRow(r,token){
      if(!hooks.owner()){r.cloud="Saved on this device";if(r.contribute)r.request="Sign in to request review";return;}
      try{await hooks.sync(r.equipment);r.cloud="Saved online";}catch(_){r.cloud="Online save pending";return;}
      if(!active(token))return;
      if(r.contribute&&r.match===null&&r.request!=="Review requested"){
        try{await hooks.request(I.contribution(r.equipment,r.id));r.request="Review requested";}
        catch(_){r.request="Review request not confirmed";}
      }
    }
    async function apply(add){
      const selected=draft.rows.filter(r=>r.selected&&!r.placed),fresh=selected.filter(r=>!r.saved),token=generation;
      if(!selected.length){notice("Select at least one line that has not already been added.");return;}
      if(fresh.some(r=>!r.confirmed||I.validate(effective(r)).length)){notice("Confirm each selected line and complete its dimensions and placement. Uncheck incomplete lines to keep them as drafts.");return;}
      if(selected.reduce((n,r)=>n+r.data.qty,0)>I.LIMITS.quantity){notice("Add at most 100 pieces of equipment in one batch.");return;}
      lock(true);notice("Saving your reviewed equipment…");
      try{
        for(const r of selected){
          if(!active(token))break;
          if(!r.saved){
            r.equipment=r.match===null?I.privateEquipment(r.data,"intake-"+r.id):{...effective(r)};
            delete r.equipment.qty;
            if(r.match!==null)r.data=I.normalize({...r.equipment,qty:r.data.qty,excerpt:r.data.excerpt});
            if(r.match===null)await hooks.saveLocal(r.equipment);
            r.saved=true;
          }
          if(add&&!r.placed){hooks.placeBatch(r.equipment,r.data.qty,r.id);r.placed=true;}
          if(!store())throw new Error("Browser storage is full. Keep this review open; the equipment already added is shown in the layout.");
          if(r.match===null)await syncRow(r,token);
          if(!active(token))break;store();
        }
        if(active(token))notice(add?"Selected equipment added to the layout. Review the per-item online and contribution status below.":"New models saved to My models; matched items remain in the catalogue. Review the per-item status below.");
      }catch(e){notice(e.message||"Could not finish saving. Your review is still available.");}
      finally{busy=false;dialog.setAttribute("aria-busy","false");$("intakeClose").disabled=false;if(active(token))render();}
    }
    async function retry(){
      if(!hooks.owner()){notice("Sign in, then reopen this review to save online or request verification.");return;}
      lock(true);const token=generation;
      try{for(const r of draft.rows.filter(r=>r.saved&&r.match===null)){if(!active(token))break;await syncRow(r,token);if(active(token))store();}notice("Online saves and review requests checked. See each item’s status.");}
      finally{busy=false;dialog.setAttribute("aria-busy","false");$("intakeClose").disabled=false;if(active(token))render();}
    }
    return {open,authChanged(){readController?.abort();generation++;if(dialog.open)dialog.close();draft=null;busy=false;dialog.setAttribute("aria-busy","false");$("intakeClose").disabled=false;}};
  };
})(globalThis);
