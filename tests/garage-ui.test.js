'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

class Element{
 constructor(tag){
  this.tag=tag;this.children=[];this.parent=null;this.className='';this.textContent='';
  this.attrs={};this.handlers={};this.value='';this.style={cssText:''};
 }
 append(...children){
  for(const node of children){
   this.children.push(node);node.parent=this;
   if(this.tag==='select'&&node.tag==='option'&&this.children.length===1)this.value=node.value;
  }
 }
 replaceChildren(...children){this.children=[];this.append(...children);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(event,handler){this.handlers[event]=handler;}
 dispatch(event){if(this.handlers[event])this.handlers[event]();}
 focus(){this.focused=true;}
 click(){if(typeof this.onclick==='function')this.onclick();}
}
function find(root,predicate){
 const nodes=[];const visit=e=>{if(predicate(e))nodes.push(e);for(const node of e.children)visit(node)};
 visit(root);return nodes;
}
function setup(){
 const data=new Map();
 const localStorage={
  getItem:key=>data.get(key)||null,
  setItem:(key,value)=>data.set(key,value),
  removeItem:key=>data.delete(key)
 };
 const window={localStorage,confirm:()=>true};
 const context={window,document:{createElement:tag=>new Element(tag)},localStorage};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../garage-beta.js'),'utf8'),context,{filename:'garage-beta.js'});
 return {window,localStorage,garage:window.RawestGarageBeta,data,context};
}
function button(host,label){
 const found=find(host,x=>x.tag==='button'&&x.textContent===label);
 assert.equal(found.length,1,'Expected button '+label);
 return found[0];
}
function input(host,name){
 const found=find(host,x=>x.name===name);
 assert.equal(found.length,1,'Expected build field '+name);
 return found[0];
}
test('Create and save build; refresh browser; load stored specs without losing cam/spring data',()=>{
 const h=setup(),host=new Element('main');
 let controller=h.garage.mount(host,()=>null);
 assert.ok(find(host,x=>x.className==='garage-form').length);
 assert.equal(find(host,x=>x.className==='garage-section').length,6);
 assert.equal(find(host,x=>x.name).length,h.garage.FIELDS.length);
 for(const [field,value] of [['name','Track LS'],['camInt','.610'],['camExh','.615'],['springMaxLift','.560'],['engine','4.8 LS'],['transmission','8HP70']]){
  const node=input(host,field);node.value=value;node.dispatch('input');
 }
 assert.ok(find(host,x=>x.tag==='strong'&&x.textContent.includes('Valve lift exceeds')).length);
 button(host,'Save build').click();
 assert.equal(controller.getSaved().length,1);
 assert.equal(controller.getActive().fields.camExh,'0.615');
 assert.ok(find(host,x=>x.tag==='p'&&x.textContent.includes('Build saved locally')).length);
 const host2=new Element('main');controller=h.garage.mount(host2,()=>null);
 assert.equal(controller.getSaved().length,1);
 assert.equal(input(host2,'name').value,'Track LS');
 assert.equal(input(host2,'springMaxLift').value,'0.56');
 assert.equal(controller.analysis().plan.gated,true);
});
test('Multiple build profiles: new, save, switch, and edit independently',()=>{
 const h=setup(),host=new Element('main'),ui=h.garage.mount(host,()=>null);
 const name=input(host,'name');name.value='NA sedan';name.dispatch('input');button(host,'Save build').click();
 button(host,'New build').click();
 name.value='Turbo coupe';name.dispatch('input');
 const asp=input(host,'aspiration');asp.value='turbo';asp.dispatch('change');
 button(host,'Save build').click();
 assert.equal(ui.getSaved().length,2);
 const first=ui.getSaved().find(x=>x.fields.name==='NA sedan');
 const chooser=find(host,x=>x.tag==='select'&&x.attrs['aria-label']==='Choose saved vehicle build')[0];
 chooser.value=first.id;chooser.onchange();
 assert.equal(input(host,'name').value,'NA sedan');
 assert.notEqual(input(host,'aspiration').value,'turbo');
});
test('Demo button shows hypothetical mismatch without overwriting saved real build',()=>{
 const h=setup(),host=new Element('main'),ui=h.garage.mount(host,()=>null);
 input(host,'name').value='My real car';input(host,'name').dispatch('input');button(host,'Save build').click();
 button(host,'Try .610 / .560 demo').click();
 assert.equal(input(host,'springMaxLift').value,'.560');
 assert.equal(input(host,'camExh').value,'.615');
 assert.equal(ui.getSaved().length,1);
 assert.equal(ui.getSaved()[0].fields.name,'My real car');
 assert.ok(ui.analysis().issues.some(x=>x.severity==='stop'));
});
test('Live log snapshot saves compact metadata without raw CSV data',()=>{
 const h=setup(),host=new Element('main');
 const log={rpm:[800,1100,2200],tps:[0,10,90],runtime:[1,2,3],sourceColumns:{}};
 let calls=0;
 h.window.RawestSignalIntelligence={analyze:()=>{calls++;return {
  n:3,events:[{kind:'LEAN',highLoad:true,priority:'HIGH',rpm:2200,a:2,b:2}],
  high:1,wotCount:1,wotSessions:[],pressureFactor:null,pressureInfo:{canShowPsi:false},quality:[]
 }}};
 const controller=h.garage.mount(host,()=>log);
 const field=input(host,'name');field.value='Garage 4.8';field.dispatch('input');button(host,'Save build').click();
 button(host,'Save log snapshot').click();
 assert.equal(controller.getActive().snapshots.length,1);
 assert.equal(controller.getActive().snapshots[0].samples,3);
 assert.equal(controller.getActive().snapshots[0].highPriority,1);
 assert.equal(calls,1,'Identical log identity should reuse cached analysis across form redraw and save.');
 const stored=h.data.get('rawest-signal-garage-beta-v1');
 assert.ok(stored);
 assert.ok(!stored.includes('"rpm":['),'Raw log rows must never be stored in Garage backup');
});
test('JSON backup import UI enforces file size and supported schema before overwrite',async()=>{
 const h=setup(),host=new Element('main'),controller=h.garage.mount(host,()=>null);
 const imported={format:'rawest-signal-garage-backup-v1',version:1,builds:[
  {id:'imported',fields:{name:'Imported LS',engine:'LS',springMaxLift:'.660'}}
 ],activeId:'imported'};
 const file=find(host,x=>x.tag==='input'&&x.type==='file')[0];
 file.files=[{size:50,text:async()=>JSON.stringify(imported)}];
 await file.onchange();
 assert.equal(controller.getSaved().length,1);
 assert.equal(input(host,'name').value,'Imported LS');
 assert.equal(input(host,'springMaxLift').value,'0.66');
});
test('UI uses textContent for potentially hostile imported build names',async()=>{
 const h=setup(),host=new Element('main'),controller=h.garage.mount(host,()=>null);
 const backup={format:'rawest-signal-garage-backup-v1',version:1,builds:[
  {id:'one',fields:{name:'<img src=x onerror=alert(1)>'}}
 ],activeId:'one'};
 const file=find(host,x=>x.tag==='input'&&x.type==='file')[0];
 file.files=[{size:200,text:async()=>JSON.stringify(backup)}];await file.onchange();
 assert.equal(controller.getSaved()[0].fields.name,'<img src=x onerror=alert(1)>');
 assert.equal(find(host,x=>x.tag==='img').length,0,'No HTML is created from imported strings');
});
