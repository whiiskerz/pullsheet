'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

class Element{
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.attrs={};this.style={};
  this.className='';this.value='';this.textContent='';this.hidden=false;}
 append(...children){for(const node of children){this.children.push(node);node.parent=this;
  if(this.tag==='select'&&node.tag==='option'&&this.children.length===1)this.value=node.value;}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(event,fn){this.handlers[event]=fn;}
 dispatch(event){this.handlers[event]?.({target:this});}
 scrollIntoView(){}
 focus(){}
 click(){this.onclick?.();}
}
function find(root,test){
 const matches=[],walk=e=>{if(test(e))matches.push(e);for(const child of e.children)walk(child)};
 walk(root);return matches;
}
function scenario(){
 const items=new Map(),context={localStorage:{
  getItem:key=>items.get(key)||null,setItem:(key,v)=>items.set(key,v),removeItem:key=>items.delete(key)
 },document:{createElement:tag=>new Element(tag)},confirm:()=>true};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../garage-beta.js'),'utf8'),context);
 const garage=context.RawestGarageBeta,root=new Element('main');
 const controller=garage.mount(root,()=>null);
 const button=label=>find(root,e=>e.tag==='button'&&e.textContent===label)[0];
 const input=id=>find(root,e=>e.tag==='input'&&e.id==='garage-'+id)[0]||
  find(root,e=>e.tag==='select'&&e.id==='garage-'+id)[0];
 return {garage,root,controller,button,input,items};
}
test('Easy mode initially reveals only car basics and preserves all details for Detailed mode',()=>{
 const {root,button,input}=scenario();
 assert.equal(find(root,e=>e.className==='garage-mode-button').length,2);
 assert.equal(find(root,e=>e.className==='garage-section'&&!e.hidden).length,2);
 assert.equal(input('name').parent.hidden,false);
 assert.equal(input('springInstalledHeight').parent.hidden,true);
 button('Detailed specs · intermediate').click();
 assert.equal(find(root,e=>e.className==='garage-section'&&!e.hidden).length,6);
 assert.equal(input('springInstalledHeight').parent.hidden,false);
 button('Easy setup · beginner').click();
 assert.equal(input('springInstalledHeight').parent.hidden,true);
});
test('Beginner stepper keeps entered fields and makes a .610/.560 mismatch obvious',()=>{
 const {root,button,input,controller}=scenario();
 input('name').value='LS sedan';input('name').dispatch('input');
 button('2 · Cam + springs').click();
 assert.equal(find(root,e=>e.className==='garage-section'&&!e.hidden).length,2);
 for(const [id,value] of [['camInt','.610'],['camExh','.615'],['springMaxLift','.560']]){
  const field=input(id);field.value=value;field.dispatch('input');
 }
 const verdict=find(root,e=>e.className.includes('garage-quick-result'))[0];
 assert.ok(find(verdict,e=>e.tag==='h4'&&e.textContent==='CHECK THIS BEFORE ADDING POWER').length);
 assert.equal(controller.analysis().totals.stop,1);
 button('3 · Power goals').click();
 input('goalWhp').value='500';input('goalWhp').dispatch('input');
 button('Save build').click();
 button('Detailed specs · intermediate').click();
 assert.equal(input('camInt').value,'.610');
 assert.equal(input('springMaxLift').value,'.560');
 assert.equal(controller.getSaved().length,1);
 assert.equal(controller.getSaved()[0].fields.goalWhp,'500');
});
test('Lobe lift in Easy mode reveals required rocker ratio field',()=>{
 const {root,button,input}=scenario();
 button('2 · Cam + springs').click();
 assert.equal(input('installedRatio').parent.hidden,true);
 const basis=input('camBasis');basis.value='lobe';basis.dispatch('change');
 assert.equal(input('installedRatio').parent.hidden,false);
});
test('Unknown spring/cam data says more verification is needed; never displays an unearned safe approval',()=>{
 const {root,controller}=scenario();
 const verdict=find(root,e=>e.className.includes('garage-quick-result'))[0];
 assert.ok(find(verdict,e=>e.tag==='h4'&&/START WITH YOUR CAM/.test(e.textContent)).length);
 assert.ok(Number.isNaN(controller.analysis().hardware.actual));
});
