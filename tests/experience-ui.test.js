'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'signal-experience.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('the experience is wired to the real parser and caches offline',()=>{
 assert.match(html,/signal-experience\.css\?v=3\.3\.0/);
 assert.match(html,/signal-experience\.js\?v=3\.3\.0/);
 assert.match(html,/RawestSignalExperience\?\.showResults\?\.\(d,h,filename\)/);
 assert.match(html,/RawestSignalExperience\?\.clearResults\?\.\(\)/);
 assert.match(sw,/signal-experience\.css\?v=3\.3\.0/);
 assert.match(sw,/signal-experience\.js\?v=3\.3\.0/);
 assert.doesNotThrow(()=>new vm.Script(source));
});
test('new companion flags uncertain channels, explains evidence and can reset',()=>{
 const nodes=new Map();
 class El{
  constructor(tag='div'){
   this.tag=tag;this.listeners={};this.children=[];this.attrs={};this.dataset={};this.hidden=false;this._markup='';this.textContent='';
   const values=new Set();
   this.classList={toggle:(n,force)=>{if(force)values.add(n);else values.delete(n);},contains:n=>values.has(n)};
   Object.defineProperty(this,'id',{get:()=>this._id||'',set:v=>{this._id=v;if(v)nodes.set(v,this)}});
  }
  set innerHTML(value){
   this._markup=value;
   this.choiceButtons=[];this.termButtons=[];
   for(const m of value.matchAll(/id="([^"]+)"/g)){if(!nodes.has(m[1]))new El('node').id=m[1]}
   for(const m of value.matchAll(/data-choice="([^"]+)"/g)){const button=new El('button');button.dataset.choice=m[1];this.choiceButtons.push(button);}
   for(const m of value.matchAll(/data-term="([^"]+)"/g)){const button=new El('button');button.dataset.term=m[1];this.termButtons.push(button);}
  }
  get innerHTML(){return this._markup}
  addEventListener(name,fn){this.listeners[name]=fn}
  click(){this.listeners.click?.()}
  setAttribute(k,v){this.attrs[k]=v}
  append(...items){this.children.push(...items)}
  appendChild(item){this.children.push(item)}
  replaceChildren(...items){this.children=items}
  insertAdjacentElement(where,item){this.children.push(item)}
  querySelector(selector){if(selector==='.signal-launch-top > div:first-child')return new El();if(selector==='.signal-home')return home;return null}
  querySelectorAll(selector){if(selector==='[data-choice]')return this.choiceButtons;if(selector==='[data-term]')return this.termButtons;return []}
  scrollIntoView(){}
 }
 const home=new El('section');
 const analyze=new El('section');analyze.id='view-analyze';
 const results=new El('section');results.id='results';
 const input=new El('input');input.id='fileInput';
 const garage=new El('section');garage.id='aiGarageBeta';
 const tabs=['analyze','history','ai','config','about'].map(name=>{const button=new El('button');button.dataset.tab=name;button.click=function(){this.pressed=(this.pressed||0)+1};return button});
 let currentClipboard='';
 const document={
  body:new El('body'),
  createElement:tag=>new El(tag),
  getElementById:name=>nodes.get(name)||null,
  querySelectorAll:s=>s==='.tabs [data-tab]'?tabs:[],
  querySelector:s=>{const match=s.match(/^\.(?:tabs) \[data-tab="([^"]+)"\]$/);if(match)return tabs.find(t=>t.dataset.tab===match[1]);if(s==='#results .chartPanel')return new El('section');return null}
 };
 const storage=new Map();
 const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
 const window={scrollTo(){},prompt(){},};
 const navigator={clipboard:{writeText:async value=>{currentClipboard=value}}};
 vm.runInNewContext(source,{document,window,navigator,localStorage});
 assert.equal(document.getElementById('signalChoiceExplain').textContent.includes('real log'),true);
 const launch=nodes.get('signalLaunchpad');
 assert.equal(launch.choiceButtons.length,3);
 launch.choiceButtons[1].click();
 assert.equal(nodes.get('signalChoiceGo').textContent.includes('Tune studio'),true);
 nodes.get('signalChoiceGo').click();
 assert.equal(tabs[2].pressed,1);
 nodes.get('signalDetailed').click();
 assert.equal(storage.get('rawest-signal-experience-mode'),'detailed');
 launch.termButtons.find(x=>x.dataset.term==='afr').click();
 assert.match(nodes.get('signalTermText').textContent,/Technical:/);

 const sample={channelWarnings:[]};
 const health={checks:[
  {name:'Fuel pressure',score:100,weight:0,reason:"raw reading exceeds calibration ceiling — numbers can't be trusted"},
  {name:'Knock',score:20,weight:5,reason:'knock activity detected'},
  {name:'Coolant',score:100,weight:10,reason:'186 °F peak'}
 ]};
 window.RawestSignalExperience.showResults(sample,health,'test-drive.log');
 const review=nodes.get('signalReview');
 assert.equal(review.hidden,false);
 assert.match(nodes.get('signalReviewTitle').textContent,/closer look/);
 const points=nodes.get('signalReviewPoints').children;
 assert.equal(points.length,3);
 assert.match(points[0].children[0].textContent,/confirm your sensors/i);
 assert.match(points[1].children[1].textContent,/does not prove detonation/);
 nodes.get('signalCopySummary').click();
 return Promise.resolve().then(()=>{
  assert.match(currentClipboard,/Confirm your sensor channels/);
  assert.match(currentClipboard,/Knock/);
  window.RawestSignalExperience.clearResults();
  assert.equal(review.hidden,true);
 });
});
