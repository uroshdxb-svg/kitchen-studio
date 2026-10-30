/* Runs only inside a disposable worker; all URLs are self-hosted static assets. */
self.onmessage=async({data:{bytes,base}})=>{
  let reader;
  try{
    importScripts(base+'/tesseract.min.js');
    reader=await Tesseract.createWorker('eng',1,{workerPath:base+'/worker.min.js',corePath:base,langPath:base,workerBlobURL:false,
      logger:m=>postMessage({type:'progress',message:m.status==='recognizing text'?'Reading text: '+Math.round(m.progress*100)+'%':'Preparing text recognition…'}),
      errorHandler:()=>postMessage({type:'error'})});
    await reader.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150'});
    const {data}=await reader.recognize(new Uint8Array(bytes));postMessage({type:'result',text:data.text});
  }catch(_){postMessage({type:'error'});}finally{if(reader)await reader.terminate();}
};
