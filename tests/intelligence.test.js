'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../signal-intelligence.js'),'utf8');
const context={};
vm.runInNewContext(source,context,{filename:'signal-intelligence.js'});
const engine=context.RawestSignalIntelligence;
assert.ok(engine&&typeof engine.analyze==='function','Signal Intelligence engine should expose analyze');

function fakeLog(){
 const headers=['Engine runtime [69]','MAP [20]','Lambda corr A [102]','Lambda corr state [670]','Acc enrichment [106]','Fuel cut [100]'];
 const d={headers,rows:[],sourceColumns:{fuelPress:-1,lambda:2,targetLambda:3,knock:-1,warnings:-1},
  rpm:[],tps:[],runtime:[],lambda:[],targetLambda:[],fuelPress:[],knock:[],warnings:[],ethanol:[]};
 for(let i=0;i<100;i++){
  const lean=i>=40&&i<=48;
  d.rpm.push(2000+i);d.tps.push(90);d.runtime.push(i*.067);
  d.lambda.push(lean?1.09:.88);d.targetLambda.push(.88);
  d.fuelPress.push(405);d.knock.push(0);d.warnings.push(0);d.ethanol.push(5.8);
  d.rows.push([i*.067,97,lean?(i<=45?-10:-6):0,lean?1:0,0,0].map(String));
 }
 return d;
}
test('high-throttle lean with held negative trim is not automatically called normal recovery',()=>{
 const report=engine.analyze(fakeLog(),{pressureUnit:'auto'});
 const e=report.events.find(row=>row.kind==='LEAN');
 assert.ok(e);
 assert.equal(e.negativeWhileLean,true);
 assert.equal(e.trimAppearsHeld,true);
 assert.match(e.context,/LEAN WITH NEGATIVE TRIM HELD/);
 assert.equal(e.priority,'HIGH');
 assert.ok(e.duration>.5&&e.duration<.8);
 assert.ok(report.gates.some(x=>/negative lambda correction/.test(x)));
});
test('pressure remains unverified without explicit units',()=>{
 const report=engine.analyze(fakeLog(),{pressureUnit:'auto'});
 assert.equal(report.pressureFactor,null);
 assert.equal(report.quality.find(q=>q.key==='Fuel pressure units').status,'unverified');
});
test('user-selected kPa produces PSI conversion without implying verified calibration',()=>{
 const report=engine.analyze(fakeLog(),{pressureUnit:'kpa'});
 assert.ok(Math.abs(report.pressureFactor-.1450377377)<1e-8);
 assert.equal(report.quality.find(q=>q.key==='Fuel pressure units').status,'user-selected');
});
