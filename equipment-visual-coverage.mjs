// Build-time inventory. An individual model is not a claim of manufacturer CAD
// or user approval. Newly added catalogue rows enter the backlog automatically.
export function visualCoverage(rows,registry,symbolOf,references,families){
 const detailed=new Set(['oven','fridge','range','fryer','pasta','ss:hood','ss:rack']);
 const labels={'model-specific':'Individual model','category-detailed':'Detailed family','category-basic':'Basic family','generic':'Placeholder'};
 const counts=Object.fromEntries(Object.keys(labels).map(k=>[k,0])),seen=new Set(),ids=new Set();
 for(const e of registry.entries){if(ids.has(e.id))throw new Error('Duplicate equipment model ID: '+e.id);ids.add(e.id);if(!references[e.id]?.source||!references[e.id]?.file)throw new Error('Missing manufacturer reference: '+e.id);}
 const items=rows.map((r,index)=>{const it={kind:'eq',brand:r[0],model:r[1],cat:r[2],name:r[3],w:r[4],d:r[5],h:r[6],mount:r[7]},model=registry.identify(it),mixer=registry.mixerFamily(it),family=families?.identify(it),symbol=symbolOf(it),status=model?'model-specific':mixer||family||detailed.has(symbol)?'category-detailed':symbol==='generic'?'generic':'category-basic';
  if(model){if(seen.has(model.id))throw new Error('Ambiguous catalogue match: '+model.id);seen.add(model.id);}counts[status]++;
  return {...it,index,category:it.cat,symbol,status,visualModel:model?.id||null,family:model?.family||mixer||family||symbol,reference:model?references[model.id].source:null};
 });
 for(const id of ids)if(!seen.has(id))throw new Error('Equipment model has no catalogue match: '+id);
 return {total:items.length,counts,labels,items};
}
