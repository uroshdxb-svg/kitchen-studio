/* Document intake is untrusted data. Only this allowlist can become equipment.
   Kept independent of the UI so validation is identical for CSV, local text recognition and edits. */
(function(root){
  "use strict";
  const LIMITS={rows:50,quantity:100,text:60000,fileBytes:10*1024*1024,pages:4};
  const clean=(v,n=160)=>typeof v==="string"?v.trim().slice(0,n):"";
  const key=v=>clean(v).normalize("NFKC").toLowerCase().replace(/\s+/g," ");
  const num=v=>v===null||v===undefined||typeof v==="boolean"||(typeof v!=="string"&&typeof v!=="number")||String(v).trim()===""?null:Number.isFinite(Number(v))?Number(v):null;
  const tri=v=>v===true||v===1||/^(true|yes|y|1)$/i.test(String(v))?true:v===false||v===0||/^(false|no|n|0)$/i.test(String(v))?false:null;
  function url(v){try{const u=new URL(clean(v,1000));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
  function normalize(raw={}){
    const units=key(raw.units||"mm"),factor={mm:1,cm:10,m:1000,in:25.4,inches:25.4}[units];
    const dimension=v=>{const n=num(v);return factor&&n!==null&&n>0&&n*factor<=20000?Math.round(n*factor):null;};
    const qty=raw.qty===undefined||raw.qty===""?1:num(raw.qty),kw=num(raw.kw);
    return {brand:clean(raw.brand),model:clean(raw.model),name:clean(raw.name,240),cat:clean(raw.cat||raw.category),
      w:dimension(raw.w),d:dimension(raw.d),h:dimension(raw.h),units:"mm",
      mount:["floor","top"].includes(raw.mount)?raw.mount:null,
      power:["electric","gas","charcoal","none"].includes(raw.power)?raw.power:null,
      kw:kw!==null&&kw>=0&&kw<=2000?kw:null,elec:clean(raw.elec||raw.electrical)||null,
      water:tri(raw.water),drain:tri(raw.drain),region:clean(raw.region),variant:clean(raw.variant),
      src:url(raw.src),qty:Number.isInteger(qty)&&qty>=1&&qty<=LIMITS.quantity?qty:null,
      excerpt:clean(raw.excerpt,500)};
  }
  function validate(row){
    const errors=[];
    if(!row.brand)errors.push("Enter the manufacturer.");
    if(!row.model)errors.push("Enter the full model or a private reference.");
    for(const f of ["w","d","h"])if(!Number.isFinite(row[f])||row[f]<(f==="h"?20:50)||row[f]>20000)errors.push("Enter "+{w:"width",d:"depth",h:"height"}[f]+" in mm.");
    if(!["floor","top"].includes(row.mount))errors.push("Choose floor or countertop placement.");
    if(!Number.isInteger(row.qty)||row.qty<1||row.qty>LIMITS.quantity)errors.push("Quantity must be a whole number from 1 to 100.");
    return errors;
  }
  function matches(row,catalogue){
    if(!row.brand||!row.model)return [];
    return catalogue.map((equipment,index)=>({equipment,index})).filter(({equipment:e})=>key(e.brand)===key(row.brand)&&key(e.model)===key(row.model)).map(m=>{
      const conflicts=[];
      for(const f of ["w","d","h","kw","water","drain","mount","power"])if(row[f]!==null&&row[f]!==undefined&&row[f]!==""&&row[f]!==m.equipment[f])conflicts.push(f);
      if(row.elec&&key(row.elec)!==key(m.equipment.elec))conflicts.push("electrical supply");
      if(row.region||row.variant)conflicts.push("market / configuration needs confirmation");
      return {...m,conflicts};
    });
  }
  const catalogueKey=e=>JSON.stringify([e.brand,e.model,e.w,e.d,e.h,e.mount,e.power,e.kw,e.elec,e.water,e.drain,e.src]);
  function privateEquipment(row,id){
    if(validate(row).length)throw new Error(validate(row).join(" "));
    const r=normalize(row);
    // Deliberately excludes document excerpts, file names, prices, contact data and quantity.
    const {excerpt,qty,units,...equipment}=r;
    return {...equipment,cid:id,conf:"user",intake:true,verification:"unverified"};
  }
  function contribution(e,id){
    const r=normalize(e),{excerpt,qty,units,...product}=r;
    return {kind:"equipment",message:"Equipment contribution for manufacturer verification: "+r.brand+" "+r.model,
      view:"equipment-intake",context:{schema:"equipment-contribution/v1",submissionId:id,product,consentVersion:"v1",verification:"pending"}};
  }
  function parseDelimited(text,delimiter){
    if(text.length>LIMITS.text)throw new Error("Use a smaller list (up to 60,000 characters).");
    text=text.replace(/^\uFEFF/,"");delimiter=delimiter||(text.split(/\r?\n/)[0].includes("\t")?"\t":",");
    const matrix=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}
      else if(c===delimiter&&!quoted){row.push(cell);cell="";}
      else if((c==="\n"||c==="\r")&&!quoted){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x.trim()))matrix.push(row);row=[];cell="";}
      else cell+=c;
    }
    if(quoted)throw new Error("A quoted cell is unfinished. Check the CSV file.");
    row.push(cell);if(row.some(x=>x.trim()))matrix.push(row);
    if(matrix.length<2)throw new Error("Include a header row and at least one equipment row.");
    const aliases={manufacturer:"brand",description:"name",quantity:"qty",category:"cat",width:"w",depth:"d",height:"h",widthmm:"w",depthmm:"d",heightmm:"h",electrical:"elec",source:"src",sourceurl:"src"};
    const headers=matrix.shift().map(h=>{const k=key(h).replace(/[\s_]/g,"");return aliases[k]||k;});
    if(!headers.includes("brand")||!headers.includes("model"))throw new Error("The table needs Brand and Model columns. Use the sample CSV for column names.");
    if(new Set(headers).size!==headers.length)throw new Error("The table has duplicate column names.");
    if(matrix.length>LIMITS.rows)throw new Error("Import up to 50 equipment lines at a time. Split this list first.");
    return matrix.map((values,i)=>{
      if(values.length!==headers.length)throw new Error("Row "+(i+2)+" has a different number of columns from the header.");
      const raw={};headers.forEach((h,j)=>{if(h!=="__proto__"&&h!=="constructor")raw[h]=values[j];});
      return normalize(raw);
    });
  }
  const connection=(v,yes="yes",no="no")=>v===true?yes:v===false?no:"Unknown";
  function uncertainty(items){
    const counts={power:0,electric:0,gas:0,water:0,drain:0};
    for(const i of items){if(!i.power)counts.power++;if(i.power==="electric"&&i.kw==null)counts.electric++;if(i.power==="gas"&&i.kw==null)counts.gas++;if(i.water==null)counts.water++;if(i.drain==null)counts.drain++;}
    return Object.entries(counts).filter(([,n])=>n).map(([k,n])=>`${n} ${ {power:"energy type",electric:"electrical load",gas:"gas load",water:"water requirement",drain:"drain requirement"}[k]}${n>1?"s":""} unknown`).join("; ");
  }
  root.KS_intake={LIMITS,normalize,validate,matches,catalogueKey,privateEquipment,contribution,parseDelimited,connection,uncertainty,url};
})(globalThis);
