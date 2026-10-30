/* Ruled quotation table geometry. No supplier-specific coordinates or model names. */
(function(root){
  function groups(values){const out=[];for(const n of values){const last=out.at(-1);if(last&&n<=last.b+2)last.b=n;else out.push({a:n,b:n});}return out.map(g=>({...g,c:(g.a+g.b)/2}));}
  function grid(canvas){
    const {width:w,height:h}=canvas,ctx=canvas.getContext('2d',{willReadFrequently:true}),pixels=ctx.getImageData(0,0,w,h).data;
    const dark=(x,y)=>{const i=(y*w+x)*4;return pixels[i]<120&&pixels[i+1]<120&&pixels[i+2]<120&&pixels[i+3]>150;};
    const lines=[];
    for(let y=0;y<h;y++){let run=0,best=0,gap=0;for(let x=0;x<w;x++){if(dark(x,y)){run++;gap=0;}else if(++gap<4)run++;else run=0;if(run>best)best=run;}if(best>w*.5)lines.push(y);}
    const horizontal=groups(lines),bands=[];
    for(let i=0;i<horizontal.length-1;i++){
      const top=horizontal[i].b+2,bottom=horizontal[i+1].a-2;if(bottom-top<10||bottom-top>h*.65)continue;
      const vertical=[];
      for(let x=0;x<w;x++){let n=0,total=0;for(let y=top+2;y<bottom-2;y+=2){total++;if(dark(x,y))n++;}if(total&&n/total>.76)vertical.push(x);}
      const edges=groups(vertical);if(edges.length>=3)bands.push({top,bottom,edges,cells:edges.slice(0,-1).map((e,j)=>({left:e.b+3,right:edges[j+1].a-3,top:top+1,bottom:bottom-1}))});
    }
    return {horizontal,bands};
  }
  function erase(canvas,layout){const ctx=canvas.getContext('2d');ctx.fillStyle='white';for(const y of layout.horizontal)ctx.fillRect(0,y.a-1,canvas.width,y.b-y.a+3);for(const band of layout.bands)for(const x of band.edges)ctx.fillRect(x.a-1,band.top-2,x.b-x.a+3,band.bottom-band.top+4);}
  function words(tsv){return String(tsv||'').split('\n').slice(1).map(l=>l.split('\t')).filter(a=>a[0]==='5'&&a[11]?.trim()).map(a=>({text:a[11].trim(),x:+a[6],y:+a[7],w:+a[8],h:+a[9],confidence:+a[10]}));}
  function cellText(cell,tokens){const selected=tokens.filter(t=>t.x+t.w/2>cell.left&&t.x+t.w/2<cell.right&&t.y+t.h/2>cell.top&&t.y+t.h/2<cell.bottom).sort((a,b)=>a.y-b.y||a.x-b.x);const lines=[];for(const t of selected){let line=lines.find(l=>Math.abs(l.y-(t.y+t.h/2))<Math.max(6,t.h*.65));if(!line){line={y:t.y+t.h/2,words:[]};lines.push(line);}line.words.push(t);}return lines.sort((a,b)=>a.y-b.y).map(l=>l.words.sort((a,b)=>a.x-b.x).map(t=>t.text).join(' ')).join('\n');}
  function header(text){const s=String(text).toLowerCase().replace(/[^a-z]/g,'');if(/^(qty|quantity|noofunits)$/.test(s))return 'qty';if(/^(description|itemdescription|equipmentdescription|equipment|item)$/.test(s))return 'name';if(/^(dimension|dimensions|sizemm|size|dimensionsmm)$/.test(s))return 'dimensions';if(/^(brand|make|manufacturer)$/.test(s))return 'brand';if(/^(model|modelno|modelnumber|modelref)$/.test(s))return 'model';return null;}
  function tables(layout,tokens){
    const out=[];let active=null;
    for(const band of layout.bands){const values=band.cells.map(c=>cellText(c,tokens)),headers=values.map(header);
      if(headers.includes('name')&&headers.filter(Boolean).length>=3){active={headers,columns:band.cells,rows:[]};out.push(active);continue;}
      if(!active)continue;
      if(band.cells.length!==active.columns.length||band.cells.some((c,i)=>Math.abs(c.left-active.columns[i].left)>8)){active=null;continue;}
      const row={};active.headers.forEach((key,i)=>{if(key)row[key]=values[i];});
      if(row.name&&!/^(total|subtotal|vat|terms|delivery|installation labour|discount)\b/i.test(row.name.trim()))active.rows.push({...row,cells:band.cells,headers:active.headers});
    }
    return out.filter(t=>t.rows.length);
  }
  root.KS_layout={grid,erase,words,cellText,header,tables};
})(globalThis);
