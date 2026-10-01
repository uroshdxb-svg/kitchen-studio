/* Kitchen Studio brand: approved flat four-tile logo.
   Shared by the site build, offline app and drawing exports. No external assets. */
(function(root){
"use strict";
const colours={orange:"#F0602F",ink:"#17202A",muted:"#66727F"};
function mark(opts={}){
  const border=opts.border||"none";
  return `<g data-ks-brand="mark">
    <rect width="47" height="47" rx="10" fill="${colours.orange}"/>
    <rect x="53" width="47" height="47" rx="10" fill="${colours.orange}"/>
    <rect y="53" width="47" height="47" rx="10" fill="${colours.ink}" stroke="${border}" stroke-width="1"/>
    <rect x="53" y="53" width="47" height="47" rx="10" fill="${colours.orange}"/>
    <g fill="#FFFFFF"><circle cx="15" cy="15" r="6.5"/><circle cx="32" cy="15" r="6.5"/><circle cx="15" cy="32" r="6.5"/><circle cx="32" cy="32" r="6.5"/></g>
    <g fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M61 23.5H92M10 66H30M76.5 60V70"/>
      <path d="M62 71H91V75C91 83 85 88 76.5 88S62 83 62 75Z"/>
    </g>
  </g>`;
}
function lockup(opts={}){
  const ink=opts.ink||colours.ink,muted=opts.muted||colours.muted,font=opts.font||"Manrope, Helvetica, Arial, sans-serif";
  return `<g data-ks-brand="lockup">${mark(opts)}
    <text x="120" y="48" fill="${ink}" font-family="${font}" font-weight="bold" font-size="48" letter-spacing="-1.2">kitchen studio</text>
    <text x="121" y="82" fill="${muted}" font-family="${font}" font-size="25">Vibe your kitchen</text>
  </g>`;
}
function iconSVG(opts={}){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" ${opts.className?'class="'+opts.className+'" ':''}role="img" aria-label="Kitchen Studio">${mark(opts)}</svg>`;
}
function lockupSVG(opts={}){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 100" width="500" height="100" role="img" aria-label="Kitchen Studio - Vibe your kitchen">${lockup(opts)}</svg>`;
}
root.KS_brand={colours,mark,lockup,iconSVG,lockupSVG,width:500,height:100};
})(typeof window!=="undefined"?window:globalThis);

