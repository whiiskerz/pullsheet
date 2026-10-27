'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.join(__dirname,'..');
const flow=fs.readFileSync(path.join(base,'signal-import-flow.js'),'utf8');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
function mount(){
 const scrolled=[],review={hidden:false,scrollIntoView:opts=>scrolled.push({target:'review',opts})};
 const v4={hidden:false,scrollIntoView:opts=>scrolled.push({target:'v4',opts})};
 const results={style:{display:'block'},scrollIntoView:opts=>scrolled.push({target:'results',opts})};
 const nodes={signalReview:review,signalV4:v4,results};
 const doc={getElementById:key=>nodes[key]||null};
 const frames=[];
 const win={document:doc,requestAnimationFrame:fn=>{frames.push(fn);},matchMedia:()=>({matches:false})};
 const ctx={window:win};vm.runInNewContext(flow,ctx);
 return {flow:win.RawestImportFlow,doc,win,nodes,frames,scrolled,draw:()=>{while(frames.length)frames.shift()();}};
}
test('only a successfully finished import schedules scrolling, not render toggles',()=>{
 const m=mount();
 assert.match(html,/render\(parsed,lastFilename\);[\s\S]*?saveHistory\(parsed,lastFilename\);[\s\S]*?RawestImportFlow\?\.jump\?\.\(\)/);
 assert.equal((html.match(/RawestImportFlow\?\.jump\?\.\(\)/g)||[]).length,1);
 assert.equal(m.flow.jump(m.doc,m.win),true);
 assert.equal(m.scrolled.length,0,'scroll only after paint frames');
 m.draw();
 assert.equal(m.scrolled.length,1);
 assert.equal(m.scrolled[0].target,'review','prefer plain-English summary before charts');
 assert.equal(m.scrolled[0].opts.block,'start');
});
test('unavailable plain-English view falls back to v4 and then rendered results',()=>{
 const m=mount();
 m.nodes.signalReview.hidden=true;
 m.flow.jump(m.doc,m.win);m.draw();
 assert.equal(m.scrolled[0].target,'v4');
 m.nodes.signalV4.hidden=true;
 m.flow.jump(m.doc,m.win);m.draw();
 assert.equal(m.scrolled[1].target,'results');
 m.nodes.results.style.display='none';
 assert.equal(m.flow.targetForLog(m.doc),null);
});
test('respects reduced-motion and does not scroll before there are results',()=>{
 const m=mount();
 m.win.matchMedia=()=>({matches:true});
 m.nodes.signalReview.hidden=true;m.nodes.signalV4.hidden=true;m.nodes.results.style.display='none';
 m.flow.jump(m.doc,m.win);m.draw();assert.equal(m.scrolled.length,0);
 m.nodes.results.style.display='block';
 m.flow.jump(m.doc,m.win);m.draw();assert.equal(m.scrolled.length,1);
 assert.equal(m.scrolled[0].opts.behavior,'instant');
});
test('docs are routable, searchable Markdown articles and navigation remains offline-cacheable',()=>{
 const doc=fs.readFileSync(path.join(base,'docs/index.html'),'utf8');
 const worker=fs.readFileSync(path.join(base,'sw.js'),'utf8');
 const ui=fs.readFileSync(path.join(base,'docs/wiki.js'),'utf8');
 const catalogText=fs.readFileSync(path.join(base,'docs/catalog.js'),'utf8');
 const context={window:{}};vm.runInNewContext(catalogText,context);
 const pages=context.window.RAWEST_DOCS_CATALOG;
 assert.ok(Array.isArray(pages)&&pages.length>=14);
 assert.equal(new Set(pages.map(p=>p.slug)).size,pages.length);
 for(const page of pages){
  const src=fs.readFileSync(path.join(base,'docs/pages',page.slug+'.md'),'utf8');
  assert.ok(src.startsWith('# '),'Markdown needs first-level heading: '+page.slug);
  assert.ok(worker.includes('./docs/pages/'+page.slug+'.md'),'Offline cache must include '+page.slug);
 }
 assert.match(doc,/wikiSearchInput/);
 assert.match(doc,/sidebarNav/);
 assert.match(ui,/hashchange/);
 assert.match(ui,/fetchText/);
 assert.match(ui,/navigator\.clipboard\.writeText/);
 assert.match(ui,/edit\/main\/docs\/pages/);
 assert.doesNotThrow(()=>new vm.Script(ui));
});
