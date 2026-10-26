'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../signal-intelligence.js'),'utf8'),context);
const engine=context.RawestSignalIntelligence;
function fixture({variation=0,tps=.1,moving=false,includeTarget=true}={}){
 const headers=['Engine runtime [69]',...(includeTarget?['Idle RPM target [900]']:[]),'MAP [20]','Fuel cut [100]'];
 const d={headers,sourceFormat:'maxxecu',sourceColumns:{lambda:-1,targetLambda:-1,fuelPress:-1},rows:[],rpm:[],tps:[],vss:[],runtime:[],lambda:[],targetLambda:[],coolantF:[],fuelPress:[],knock:[],warnings:[],ethanol:[]};
 for(let i=0;i<320;i++){
  const rpm=820+variation*(i%2?1:-1),time=300+i*.05;
  d.rpm.push(rpm);d.tps.push(tps);d.vss.push(moving?45:0);d.runtime.push(time);
  d.lambda.push(1);d.targetLambda.push(.99);d.coolantF.push(176);
  d.fuelPress.push(405);d.knock.push(0);d.warnings.push(0);d.ethanol.push(6);
  d.rows.push([time,...(includeTarget?[820]:[]),65,0].map(String));
 }
 return d;
}
test('Stable low throttle idle assesses real idle windows without inventing faults',()=>{
 const result=engine.idleDiagnostics(fixture());
 assert.equal(result.qualified,320);
 assert.ok(result.windows>=5);
 assert.equal(result.events.length,0);
 assert.ok(result.notes.some(x=>x.includes('RPM')));
});
test('Significant idle RPM hunting is flagged and graphed as an idle RPM event',()=>{
 const d=fixture({variation:190}),result=engine.idleDiagnostics(d);
 assert.ok(result.events.length>=1);
 assert.equal(result.events[0].kind,'IDLE RPM VARIATION');
 assert.ok(result.events[0].rpmSpread>=300);
 assert.equal(result.events[0].targetRpm,820);
 assert.equal(result.events[0].idle,true);
 assert.ok(result.events[0].duration>=.65);
 assert.equal(engine.forGoal([],d,'idle').length,result.events.length);
});
test('15-19% throttle rich events cannot masquerade as actual idle behavior',()=>{
 const d=fixture({variation:190,tps:18}),result=engine.idleDiagnostics(d);
 assert.equal(result.qualified,0);
 assert.equal(result.events.length,0);
 assert.equal(engine.forGoal([{kind:'RICH',rpm:1350,tps:18,a:0,b:20}],d,'idle').length,0);
});
test('Moving low-throttle samples are excluded from stationary idle screen',()=>{
 const result=engine.idleDiagnostics(fixture({moving:true}));
 assert.equal(result.qualified,0);
});
test('Without independently logged idle target the app never invents idle target RPM',()=>{
 const result=engine.idleDiagnostics(fixture({variation:190,includeTarget:false}));
 assert.equal(result.targetMapped,false);
 assert.ok(result.events.every(x=>Number.isNaN(x.targetRpm)));
});
