/* RAWEST SIGNAL 4.0.2 — scroll only after a successfully imported log. */
(function(root){
'use strict';
function targetForLog(doc){
 const review=doc?.getElementById?.('signalReview');
 if(review && !review.hidden)return review;
 const panel=doc?.getElementById?.('signalV4');
 if(panel && !panel.hidden)return panel;
 const results=doc?.getElementById?.('results');
 return results&&results.style?.display!=='none'?results:null;
}
function jump(doc=root.document,win=root){
 if(!doc)return false;
 // Allow charts/companion content to render before moving the viewport.
 const run=()=>{
  const target=targetForLog(doc);
  if(!target||typeof target.scrollIntoView!=='function')return;
  const reduce=!!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  try{target.scrollIntoView({behavior:reduce?'instant':'smooth',block:'start'});}
  catch(e){target.scrollIntoView();}
 };
 if(typeof win.requestAnimationFrame==='function'){
  win.requestAnimationFrame(()=>win.requestAnimationFrame(run));
 }else if(typeof win.setTimeout==='function'){win.setTimeout(run,0);}
 else run();
 return true;
}
root.RawestImportFlow={targetForLog,jump,version:'4.0.2'};
})(typeof window!=='undefined'?window:globalThis);
