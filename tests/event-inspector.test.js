'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'../signal-intelligence.js'),'utf8');

class Element{
 constructor(tag){
  this.tag=tag;this.children=[];this.parent=null;this.attrs={};
  this.style={cssText:'',setProperty:(key,value,priority)=>{this.style[key]=value;this.style[key+'Priority']=priority}};
  this.textContent='';this.className='';
 }
 append(...items){
  for(const item of items){
   this.children.push(item);item.parent=this;
   if(this.tag==='select'&&item.tag==='option'&&this.value===undefined)this.value=item.value;
  }
 }
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(key,value){this.attrs[key]=value;}
 querySelectorAll(selector){
  const found=[];const scan=element=>{
   for(const child of element.children){
    if(selector==='button.signal-event-choice'&&child.tag==='button'&&child.className==='signal-event-choice')found.push(child);
    scan(child);
   }
  };
  scan(this);return found;
 }
}
function find(element,predicate){
 const found=[];const scan=e=>{if(predicate(e))found.push(e);for(const child of e.children)scan(child)};
 scan(element);return found;
}
function logFixture(){
 const headers=['Engine runtime [69]','MAP [20]','Lambda corr A [102]','Lambda corr state [670]',
  'Acc enrichment [106]','Fuel cut [100]','Lambda [5]','Lambda target [81]'];
 const d={headers,rows:[],sourceColumns:{fuelPress:-1,lambda:6,targetLambda:7,knock:-1,warnings:-1},
  rpm:[],tps:[],runtime:[],lambda:[],targetLambda:[],fuelPress:[],knock:[],warnings:[],ethanol:[]};
 for(let i=0;i<100;i++){
  const lean=(i>=40&&i<=48)||(i>=65&&i<=70);
  d.rpm.push(2000+i);d.tps.push(90);d.runtime.push(i*.067);
  d.lambda.push(lean?1.09:.88);d.targetLambda.push(.88);
  d.fuelPress.push(405);d.knock.push(0);d.warnings.push(0);d.ethanol.push(5.8);
  d.rows.push([i*.067,97,lean?-10:0,lean?1:0,0,0,lean?1.09:.88,.88].map(String));
 }
 return d;
}
test('Event inspector charts render only after mounting and switching events disposes old chart',()=>{
 const body=new Element('body'),document={createElement:tag=>new Element(tag)};
 let created=0,destroyed=0,lastConfig=null;
 function Chart(canvas,config){
  let current=canvas,mounted=false;
  while(current){if(current===body)mounted=true;current=current.parent;}
  assert.equal(mounted,true,'Chart.js canvas must already be attached to document');
  created++;lastConfig=config;this.destroy=()=>{destroyed++};
 }
 const window={Chart};
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 const context={document,window,localStorage};
 vm.runInNewContext(code,context,{filename:'signal-intelligence.js'});
 const root=new Element('main');body.append(root);
 window.RawestSignalIntelligence.render(root,logFixture(),{pressureUnit:'auto'});
 const buttons=find(root,e=>e.className==='signal-event-choice');
 const charts=find(root,e=>e.className==='signal-event-chart');
 const samples=find(root,e=>e.className==='signal-event-samples');
 assert.equal(buttons.length,2);
 assert.equal(charts.length,1);
 assert.equal(samples.length,1,'Raw sample rows should be in collapsible details');
 assert.equal(created,1);
 assert.equal(charts[0].children[0].style.height,'100%');
 assert.equal(charts[0].children[0].style.heightPriority,'important');
 assert.ok(lastConfig.data.datasets[0].pointRadius.some(v=>v>0),'Flagged samples should be visibly marked');
 buttons[1].onclick();
 assert.equal(created,2);
 assert.equal(destroyed,1);
 assert.equal(buttons[0].attrs['aria-pressed'],'false');
 assert.equal(buttons[1].attrs['aria-pressed'],'true');
});
test('Chart and sample table styles are scoped against global canvas rules',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/\.signal-event-chart\s*>\s*canvas\s*\{/);
 assert.match(html,/height:100%\s*!important/);
 assert.match(html,/@media\(max-width:600px\)\s*\{[\s\S]*?\.signal-event-chart\s*\{height:235px/);
});
