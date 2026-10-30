/* Runs only inside a disposable worker; all URLs are self-hosted static assets. */
self.onmessage=async({data:{bytes,base,layout,layoutScript}})=>{
  let reader;
  try{
    importScripts(base+'/tesseract.min.js',layoutScript);
    reader=await Tesseract.createWorker('eng',1,{workerPath:base+'/worker.min.js',corePath:base,langPath:base,workerBlobURL:false,
      logger:m=>postMessage({type:'progress',message:m.status==='recognizing text'?'Reading text: '+Math.round(m.progress*100)+'%':'Preparing text recognition…'}),
      errorHandler:()=>postMessage({type:'error'})});
    const hasGrid=layout.bands.some(b=>b.cells.length>=4);
    await reader.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150',tessedit_pageseg_mode:hasGrid?'11':'6'});
    const image=new Uint8Array(bytes),{data}=await reader.recognize(image,{},{text:true,tsv:true});
    const tables=KS_layout.tables(layout,KS_layout.words(data.tsv));
    if(tables.reduce((n,t)=>n+t.rows.length,0)>50)throw new Error('Too many rows');
    for(const table of tables)for(const row of table.rows){
      // Sparse OCR may omit a lone quantity. Read only that cell, never a price column.
      if(!/^\d+$/.test(row.qty||'')){const i=row.headers.indexOf('qty');if(i>=0){const c=row.cells[i];await reader.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:'0123456789'});const result=await reader.recognize(image,{rectangle:{left:c.left,top:c.top,width:c.right-c.left,height:c.bottom-c.top}});row.qty=result.data.text.trim();}}
      delete row.cells;delete row.headers;
    }
    postMessage({type:'result',text:data.text,tables:tables.map(t=>({rows:t.rows}))});
  }catch(_){postMessage({type:'error'});}finally{if(reader)await reader.terminate();}
};
