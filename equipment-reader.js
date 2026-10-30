/* Deterministic document parsing. OCR text is only a draft, never verified specifications. */
(function(root){
  const I=root.KS_intake;
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const field=(text,labels)=>{const m=text.match(new RegExp('(?:^|\\n)\\s*(?:'+labels+')\\s*[:=]\\s*([^\\n]+)','i'));return m?m[1].trim():'';};
  function blocks(text){
    if(text.length>I.LIMITS.text)throw new Error('Use up to 60,000 characters at a time.');
    const result=[];let lines=[],seen=new Set(),gap=false;
    const flush=()=>{if(lines.join('').trim())result.push(lines.join('\n'));lines=[];seen=new Set();};
    for(const line of text.replace(/\r/g,'').split('\n')){
      if(!line.trim()){gap=true;continue;}
      const match=line.match(/^\s*(brand|manufacturer|model(?:\s*(?:number|no\.?))?|reference|description|equipment|name|qty|quantity|width|depth|height|w|d|h|placement|mount|power|energy type|electrical load|gas load|kw|water|drain|units|dimensions?)(?:\s*\([^)]*\))?\s*[:=]/i);
      const label=match?match[1].toLowerCase().replace(/manufacturer/,'brand').replace(/^model.*/,'model'):null;
      if(lines.length&&((label&&seen.has(label))||(gap&&!label)||(gap&&label==='brand')))flush();
      lines.push(line);if(label)seen.add(label);gap=false;
    }
    flush();
    if(result.length>I.LIMITS.rows)throw new Error('Review up to 50 equipment blocks at a time. Split this text first.');
    return result;
  }
  function parseText(text,catalogue=[]){
    const chunks=blocks(text);
    if(!chunks.length)throw new Error('No readable text found. Try a clearer crop or enter the equipment manually.');
    return chunks.map(chunk=>{
      const raw={brand:field(chunk,'brand|manufacturer'),model:field(chunk,'model(?:\\s*(?:number|no\\.?))?|reference'),name:field(chunk,'description|equipment|name'),qty:field(chunk,'qty|quantity')||1};
      // Only a complete brand AND model appearing with boundaries can suggest an identity.
      // Never bring catalogue dimensions/utilities into a user-supplied row automatically.
      if(!raw.brand||!raw.model){
        const hits=catalogue.filter(e=>e.brand&&e.model&&[e.brand,e.model].every(v=>new RegExp('(?:^|[^\\p{L}\\p{N}])'+escape(v)+'(?=$|[^\\p{L}\\p{N}./_-])','iu').test(chunk)));
        const identities=[...new Map(hits.map(e=>[e.brand+'\0'+e.model,e])).values()];
        if(identities.length===1){const e=identities[0];if(!raw.brand)raw.brand=e.brand;if(!raw.model)raw.model=e.model;if(!raw.name)raw.name=e.name;}
      }
      const units=field(chunk,'units');
      // Shipping and packing measurements must not become installed dimensions.
      const dims=chunk.split('\n').filter(l=>!/shipping|packing|packaged|carton|pallet/i.test(l)).join('\n');
      for(const [axis,label] of [['w','width'],['d','depth'],['h','height']]){
        const m=dims.match(new RegExp('(?:^|\\n)\\s*(?:'+label+'|'+axis+')(?:\\s*\\((mm|cm|m|in|inches)\\))?\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)\\s*(mm|cm|m|inches|in)?\\s*$','im'));
        if(m){const u=(m[3]||m[1]||units).toLowerCase(),factor={mm:1,cm:10,m:1000,in:25.4,inches:25.4}[u];if(factor)raw[axis]=Number(m[2])*factor;}
      }
      const group=dims.match(/(?:dimensions?\s*)?\(?\s*(w(?:idth)?|d(?:epth)?|h(?:eight)?)\s*[x×]\s*(w(?:idth)?|d(?:epth)?|h(?:eight)?)\s*[x×]\s*(w(?:idth)?|d(?:epth)?|h(?:eight)?)\s*\)?\s*[:=]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|inches|in|m)\b/i);
      if(group&&new Set(group.slice(1,4).map(s=>s[0].toLowerCase())).size===3){const f={mm:1,cm:10,m:1000,in:25.4,inches:25.4}[group[7].toLowerCase()];for(let i=1;i<=3;i++)raw[group[i][0].toLowerCase()]=Number(group[i+3])*f;}
      const mount=field(chunk,'mount|placement').toLowerCase();raw.mount=/^(floor|floor standing)$/.test(mount)?'floor':/^(top|countertop|counter top)$/.test(mount)?'top':null;
      const power=field(chunk,'power|energy type').toLowerCase();if(['electric','gas','charcoal','none'].includes(power))raw.power=power;
      const kw=field(chunk,'kw|electrical load|gas load');if(/^\d+(?:\.\d+)?\s*(?:kw)?$/i.test(kw))raw.kw=parseFloat(kw);
      for(const f of ['water','drain']){const v=field(chunk,f+'(?: required)?');if(/^(yes|no|true|false)$/i.test(v))raw[f]=v;}
      // Do not retain raw OCR text, prices, contact information or document excerpts in drafts.
      return I.normalize(raw);
    });
  }
  root.KS_reader={parseText,blocks};
})(globalThis);
