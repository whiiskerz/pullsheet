'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const directory=path.join(__dirname,'..');

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.attrs={};this.className='';this.textContent='';
  this.style={cssText:'',setProperty:(k,v)=>{this.style[k]=v}};}
 append(...children){
  for(const c of children){this.children.push(c);c.parent=this;
   if(this.tag==='select'&&c.tag==='option'&&this.value===undefined)this.value=c.value;}
 }
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(k,v){this.attrs[k]=v;}
 querySelectorAll(selector){
  return collect(this,e=>selector==='button.signal-event-choice'&&e.tag==='button'&&e.className==='signal-event-choice');
 }
 querySelector(selector){return collect(this,e=>selector.startsWith('.')&&e.className===selector.slice(1))[0]||null;}
 scrollIntoView(){}
}
function collect(root,predicate){
 const found=[];const visit=e=>{if(predicate(e))found.push(e);for(const c of e.children)visit(c)};visit(root);return found;
}
function fixture(){
 const headers=['Engine runtime [69]','MAP [20]','Lambda corr A [102]','Lambda corr state [670]',
  'Acc enrichment [106]','Fuel cut [100]','Lambda [5]','Lambda target [81]','Fuel pressure (kPa) [341]'];
 const d={headers,sourceColumns:{lambda:6,targetLambda:7,fuelPress:8,gear:2},rows:[],
  rpm:[],tps:[],runtime:[],lambda:[],targetLambda:[],vss:[],fuelPress:[],
  gear:[],knock:[],warnings:[],coolantF:[],ethanol:[]};
 for(let i=0;i<95;i++){
  const pull=i>=10&&i<55,lean=i>=20&&i<=26;
  const lambda=lean?1.09:.87;
  d.rpm.push(pull?2300+i*45:1300);d.tps.push(pull?90:13);
  d.runtime.push(i*.05);d.lambda.push(lambda);d.targetLambda.push(.87);
  d.vss.push(40+i*.7);d.fuelPress.push(405);d.gear.push(3);
  d.knock.push(0);d.warnings.push(0);d.coolantF.push(176);d.ethanol.push(6);
  d.rows.push([i*.05,97,0,0,0,0,lambda,.87,405].map(String));
 }
 return d;
}
test('WOT Pull panel is attached to page and can open its AFR graph',()=>{
 const body=new Element('body'),document={createElement:tag=>new Element(tag)};
 const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
 let charts=0,destroyed=0;
 function Chart(canvas){
  let node=canvas,attached=false;
  while(node){if(node===body)attached=true;node=node.parent;}
  assert.ok(attached,'Chart must be attached before initialization');
  charts++;this.destroy=()=>{destroyed++};
 }
 const window={Chart};const context={window,document,localStorage};
 vm.runInNewContext(fs.readFileSync(path.join(directory,'signal-units.js'),'utf8'),context);
 vm.runInNewContext(fs.readFileSync(path.join(directory,'signal-intelligence.js'),'utf8'),context);
 const host=new Element('main');body.append(host);
 window.RawestSignalIntelligence.render(host,fixture(),{goal:'wot',pressureUnit:'auto'});
 assert.equal(collect(host,e=>e.className==='signal-intelligence').length,1,'Panel must mount');
 assert.equal(collect(host,e=>e.className==='signal-pull-card').length,1);
 assert.equal(collect(host,e=>e.tag==='button'&&e.textContent.includes('Export Pull Sessions')).length,1);
 const inspect=collect(host,e=>e.tag==='button'&&e.textContent.includes('Inspect this pull'));
 assert.equal(inspect.length,1);
 assert.ok(charts>=1,'Default event graph should render');
 const before=charts;inspect[0].onclick();
 assert.equal(charts,before+1);
 assert.equal(destroyed,1,'Previous chart must be destroyed');
 const titles=collect(host,e=>e.tag==='h4').map(e=>e.textContent);
 assert.ok(titles.some(t=>t.includes('PULL INSPECTOR')));
});
