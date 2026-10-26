'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

class Node{
 constructor(tag){
  this.tag=tag;this.children=[];this.parent=null;this.className='';this.value='';this.textContent='';this.attrs={};this.style={cssText:''};
 }
 append(...children){
  for(const e of children){this.children.push(e);e.parent=this;if(this.tag==='select'&&e.tag==='option'&&this.children.length===1)this.value=e.value;}
 }
 prepend(...children){this.children.unshift(...children);for(const e of children)e.parent=this;}
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(k,v){this.attrs[k]=v;}
}
function find(root,predicate){
 const nodes=[];const search=e=>{if(predicate(e))nodes.push(e);for(const child of e.children)search(child)};
 search(root);return nodes;
}
function harness(){
 const document={createElement:tag=>new Node(tag)};
 const window={};
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 const context={window,document,localStorage};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../signal-units.js'),'utf8'),context);
 window.RawestSignalIntelligence={
  analyze:()=>({events:[{kind:'LEAN',a:10,b:19,rpm:2023,map:96.7}],entries:{map:{method:'MaxxECU ID',name:'MAP [20]'}}}),
  forGoal:(events)=>events
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../calibration-intelligence.js'),'utf8'),context);
 return {document,window};
}
const settings=new Map([
 ['RPM Axis',['1000 2000 3000']],
 ['MAP Axis',['50 100 150']],
 ['Table Values',['11 12 13 21 22 23 31 32 33']],
 ['Knock enable',['1']],['Rev limiter',['6500']]
]);
test('Calibration panel shows only exact imported values and a versioned v3 inspector',()=>{
 const {window}=harness(),host=new Node('section');
 window.RawestCalibrationIntelligence.render(host,{name:'rev1.MaxxECU-save',entries:5,settings},null,null,'wot');
 assert.equal(find(host,x=>x.className==='signal-calibration-intelligence').length,1);
 assert.ok(find(host,x=>x.tag==='h3').some(x=>x.textContent.includes('v3.0')));
 assert.ok(find(host,x=>x.className==='signal-cal-tab').some(x=>x.textContent==='Protection settings'));
});
test('Human-confirmed axis picks show real surrounding cells in PSIA and never interpolate',()=>{
 const {window}=harness(),host=new Node('section');
 const original={name:'rev1.MaxxECU-save',entries:5,settings};
 window.RawestCalibrationIntelligence.render(host,original,null,{rpm:[2023],sourceColumns:{}},'wot');
 const tableTab=find(host,x=>x.className==='signal-cal-tab'&&x.textContent==='Verified table crosswalk')[0];
 tableTab.onclick();
 for(const [index,name] of [[0,'RPM Axis'],[1,'MAP Axis'],[2,'Table Values']]){
  const fields=find(host,x=>x.tag==='select');
  fields[index].value=name;fields[index].onchange();
 }
 let fields=find(host,x=>x.tag==='select');
 fields[3].value='kpa-absolute';fields[3].onchange();
 fields=find(host,x=>x.tag==='select');
 fields[4].value='rpm-rows';fields[4].onchange();
 const checkbox=find(host,x=>x.tag==='input'&&x.type==='checkbox')[0];
 checkbox.checked=true;checkbox.onchange();
 const matches=find(host,x=>x.className==='signal-cal-match');
 assert.equal(matches.length,1);
 const table=find(host,x=>x.className==='signal-cal-cell-table');
 assert.equal(table.length,1);
 const values=find(table[0],x=>x.tag==='td').map(x=>x.textContent);
 assert.ok(values.includes('21')&&values.includes('22')&&values.includes('31')&&values.includes('32'));
 assert.ok(values.includes('14.50'),'100 kPa absolute should display as about 14.50 PSIA');
 const evidence=find(host,x=>x.tag==='p').map(x=>x.textContent).join(' ');
 assert.match(evidence,/No interpolation/);
});
test('Selecting a different original tune invalidates prior manual axis confirmation',()=>{
 const {window}=harness(),host=new Node('section');
 const original={name:'rev1',entries:5,settings};
 window.RawestCalibrationIntelligence.render(host,original,null,null,'wot');
 find(host,x=>x.className==='signal-cal-tab'&&x.textContent==='Verified table crosswalk')[0].onclick();
 const input=find(host,x=>x.tag==='input'&&x.type==='checkbox')[0];input.checked=true;input.onchange();
 const second={name:'rev2',entries:5,settings:new Map(settings)};
 window.RawestCalibrationIntelligence.render(host,second,null,null,'wot');
 find(host,x=>x.className==='signal-cal-tab'&&x.textContent==='Verified table crosswalk')[0].onclick();
 assert.equal(find(host,x=>x.tag==='input'&&x.type==='checkbox')[0].checked,false);
});
test('HTML loads v3 script before AI tuner integration and retains original tune import UI',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.ok(html.includes('id="aiTuneInput"'));
 assert.ok(html.includes('id="aiCompareInput"'));
 const c=html.indexOf('calibration-intelligence.js?v=3.0.0');
 const a=html.indexOf('ai-tuner.js?v=3.0.0');
 assert.ok(c>=0&&a>c,'calibration intelligence must load before tuner script');
 assert.ok(html.includes('id="aiCalibrationIntelligence"'));
});
