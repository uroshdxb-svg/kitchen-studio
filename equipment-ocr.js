/* A disposable worker owns the OCR process, including its child worker and document memory. */
(function(root){
  root.KS_readImage=async function(canvas,{signal,onProgress=()=>{}}={}){
    if(!root.KS_OCR_BASE)throw new Error('Image text recognition is available in the Kitchen Studio webapp. Paste text or enter manually in this edition.');
    if(signal?.aborted)throw new Error('Reading cancelled. Your file is still selected.');
    const layout=KS_layout.grid(canvas);KS_layout.erase(canvas,layout);
    const worker=new Worker(new URL('/app/ocr-worker.js',location.href));let timer,abort;
    try{return await new Promise((resolve,reject)=>{
      const fail=message=>reject(new Error(message));
      abort=()=>fail('Reading cancelled. Your file is still selected.');signal?.addEventListener('abort',abort,{once:true});
      timer=setTimeout(()=>fail('Text recognition took too long. Try a smaller, clearer crop or enter manually.'),90000);
      worker.onerror=()=>fail('Text recognition could not start. Retry or enter manually.');
      worker.onmessage=({data})=>{if(data.type==='progress')onProgress(data.message);else if(data.type==='result')resolve({text:data.text,tables:data.tables||[]});else if(data.type==='error')fail('Text recognition could not finish. Check your connection or try a clearer image.');};
      canvas.toBlob(async blob=>{try{if(!blob)throw Error();const bytes=await blob.arrayBuffer();if(!signal?.aborted)worker.postMessage({bytes,layout,layoutScript:new URL('/app/equipment-layout.js',location.href).href,base:new URL(root.KS_OCR_BASE,location.href).href},[bytes]);}catch(_){fail('The image could not be read. Try another file.');}},'image/png');
    });}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();}
  };
})(globalThis);
