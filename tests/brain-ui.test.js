'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
class Node{
 constructor(tag){
  this.tag=tag;this.children=[];this.parent=null;this.attrs={};this.className='';this.textContent='';
  this.value='';this.style={cssText:'',setProperty(key,value){this[key]=value}};
  this.classList={add:value=>this.className+=(this.className?' ':'')+value};
 }
 append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;if(this.tag==='select'&&n.tag==='option'&&this.children.length===1)this.value=n.value;}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(key,handler){this['on'+key]=handler;}
}
function find(root,pred){
 const out=[];const visit=node=>{if(pred(node))out.push(node);for(const child of node.children)visit(child)};
 visit(root);return out;
}
function fixture(){
 const n=130;
 const headers=['Engine runtime [69]','MAP [20]','Lambda corr A [102]','Lambda corr state [670]','Acc enrichment [106]','Fuel cut [100]','Lambda [5]','Lambda target [81]','User AIN6 (Fuel Pressure) [341]'];
 const d={headers,sourceColumns:{lambda:6,targetLambda:7,fuelPress:8},rows:[],rpm:[],tps:[],runtime:[],lambda:[],targetLambda:[],fuelPress:[],knock:[],warnings:[],vss:[],ethanol:[]};
 for(let i=0;i<n;i++){
  const lean=i>=20&&i<58,lambda=lean?1.1:1,t=lean?.88:1;
  d.rpm.push(lean?2023:1550);d.tps.push(lean?90:18);d.runtime.push(i*.07);
  d.lambda.push(lambda);d.targetLambda.push(t);d.fuelPress.push(405);d.knock.push(0);d.warnings.push(0);d.vss.push(0);d.ethanol.push(5.8);
  d.rows.push([i*.07,lean?97:55,lean?-10:0,lean?1:0,0,0,lambda,t,405].map(String));
 }
 return d;
}
function harness(){
 const context={window:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},document:{
  createElement:tag=>new Node(tag),createElementNS:(_ns,tag)=>new Node(tag)
 }};
 for(const file of ['signal-units.js','signal-intelligence.js','signal-brain.js']){
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
 }
 return context;
}
test('Brain renders 2D evidence cells with selectable logged sample details and hypotheses',()=>{
 const h=harness(),host=new Node('main'),d=fixture(),report=h.window.RawestSignalIntelligence.analyze(d);
 h.window.RawestSignalBrain.render(host,d,{report,goal:'wot'});
 assert.equal(find(host,x=>x.className==='signal-brain').length,1);
 assert.equal(find(host,x=>x.className==='signal-brain-heatmap').length,1);
 assert.ok(find(host,x=>x.className==='signal-brain-cell').length>0);
 const cells=find(host,x=>x.className==='signal-brain-cell');
 const supported=cells.find(x=>x.textContent.includes('%'));
 assert.ok(supported,'At least one bin should be supported by screened observations');
 supported.onclick();
 assert.ok(find(host,x=>x.tag==='h4').some(x=>x.textContent.includes('OBSERVED OPERATING CELL')));
 assert.ok(find(host,x=>x.tag==='p').some(x=>x.textContent.includes('screened')));
 assert.ok(find(host,x=>x.tag==='summary').some(x=>x.textContent.includes('Closed-loop feedback')));
});
test('3D mode creates only observed evidence pillars; no invented active table cells',()=>{
 const h=harness(),host=new Node('main'),d=fixture();
 h.window.RawestSignalBrain.render(host,d,{goal:'wot'});
 const sel=find(host,x=>x.tag==='select');
 assert.equal(sel.length,4,'RPM, MAP, view mode, and event selection');
 sel[2].value='3d';sel[2].onchange();
 const svg=find(host,x=>x.tag==='svg');
 assert.equal(svg.length,1);
 const pillars=find(svg[0],x=>x.tag==='polygon');
 assert.ok(pillars.length>0);
 assert.ok(find(host,x=>x.tag==='p').some(x=>x.textContent.includes('never')||x.textContent.includes('NOT ECU-ready')));
 const t=find(svg[0],x=>x.tag==='title');
 assert.ok(t.every(x=>x.textContent.includes('median')));
});
test('Missing MAP still permits diagnosis without inventing a map or crashing the inspector',()=>{
 const h=harness(),d=fixture(),host=new Node('main');d.headers[1]='Custom gauge pressure';
 h.window.RawestSignalBrain.render(host,d,{goal:'wot'});
 assert.ok(find(host,x=>x.tag==='p').some(x=>x.textContent.includes('verified standard MaxxECU MAP')));
 assert.ok(find(host,x=>x.tag==='h3').some(x=>x.textContent.includes('DIAGNOSTIC BRAIN')));
});
test('Site loads Signal Brain prior to AI tuner and versions it in offline cache',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 const version=html.match(/signal-brain\.js\?v=(\d+\.\d+\.\d+)/)?.[1];
 assert.ok(version);
 assert.ok(html.indexOf('signal-brain.js?v='+version)<html.indexOf('ai-tuner.js?v='+version));
 assert.ok(sw.includes("'./signal-brain.js?v="+version+"'"));
 assert.match(html,/\.signal-brain-heatmap/);
});
