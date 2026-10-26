'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const directory=path.join(__dirname,'..');
function load(){
 const scope={localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
 for(const name of ['signal-units.js','signal-intelligence.js','signal-brain.js']){
  vm.runInNewContext(fs.readFileSync(path.join(directory,name),'utf8'),scope,{filename:name});
 }
 return scope;
}
function fixture({rows=180,collision=false,holley=false,missingMap=false,withCut=true,withEnrich=true,highRpm=false}={}){
 const headers=['Engine runtime [69]',missingMap?'Manifold gauge pressure':'MAP [20]',
  'Lambda corr A [102]','Lambda corr state [670]','Acc enrichment [106]',
  'Fuel cut [100]','Lambda [5]','Lambda target [81]','User AIN6 (Fuel Pressure) [341]'];
 const d={headers,sourceFormat:holley?'holley':'maxxecu',rows:[],
  sourceColumns:{lambda:collision?7:6,targetLambda:7,fuelPress:8},
  rpm:[],tps:[],runtime:[],lambda:[],targetLambda:[],fuelPress:[],knock:[],warnings:[],ethanol:[],vss:[]};
 for(let i=0;i<rows;i++){
  const lean=i>=30&&i<70,rich=i>=95&&i<120,cut=withCut&&i>=125&&i<135,acc=withEnrich&&i>=35&&i<40;
  const rpm=highRpm?6000:lean?2023:rich?3000:1550,map=lean?97:rich?110:55;
  const actual=lean?1.07:rich?.8:1,target=lean?.88:1;
  d.rpm.push(rpm);d.tps.push(lean?89:rich?28:18);d.runtime.push(i*.07);
  d.lambda.push(actual);d.targetLambda.push(target);d.fuelPress.push(405);d.knock.push(0);d.warnings.push(0);d.ethanol.push(6);d.vss.push(35);
  d.rows.push([i*.07,map,lean?-10:0,lean?1:0,acc?1:0,cut?1:0,actual,target,405].map(String));
 }
 return d;
}
test('Heatmap is observed RPM × MaxxECU MAP, with screened signed deviations and conservative sample threshold',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture();
 const report=si.analyze(d,{pressureUnit:'auto'});
 const map=brain.buildHeatmap(d,report);
 assert.equal(map.error,undefined);
 assert.equal(map.counts.operating,180);
 assert.ok(map.counts.screened<180);
 assert.ok(map.counts.excludedFuelCut>0);
 assert.ok(map.counts.excludedEnrich>0);
 assert.ok(map.counts.excludedTransition>0);
 const leanCell=map.cells.find(c=>c.visible&&c.rpmFrom===2000);
 assert.ok(leanCell,'There should be a real 2000 RPM evidence cell');
 assert.ok(leanCell.medianError>20);
 assert.ok(leanCell.mapPsiaFrom>10&&leanCell.mapPsiaFrom<15);
 assert.ok(map.cells.some(c=>!c.visible));
 assert.ok(!map.note.toLowerCase().includes('correction recommended'));
});
test('Heatmap fails closed if measured lambda is the target channel',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture({collision:true});
 const report=si.analyze(d);
 assert.match(brain.buildHeatmap(d,report).error,/independently mapped/);
});
test('Holley or unverified MAP aliases never become absolute kPa/PSIA',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load();
 for(const d of [fixture({holley:true}),fixture({missingMap:true})]){
  const result=brain.buildHeatmap(d,si.analyze(d));
  assert.match(result.error,/verified standard MaxxECU MAP/);
 }
});
test('Exact boundary samples are counted (e.g. 6000 RPM and exactly 100 kPa)',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture({rows:70,highRpm:true});
 for(let i=0;i<d.rows.length;i++)d.rows[i][1]='100';
 const result=brain.buildHeatmap(d,si.analyze(d),{rpmStep:500,mapStep:20});
 assert.equal(result.counts.operating,70);
 assert.ok(result.cells.some(c=>c.rpmFrom===6000&&c.observed>0));
 assert.ok(result.cells.some(c=>c.mapFrom===90&&c.observed>0));
});
test('Fuel pressure remains PSI-unavailable until the logged pressure unit is verified',()=>{
 const scope=load(),d=fixture(),report=scope.RawestSignalIntelligence.analyze(d);
 const map=scope.RawestSignalBrain.buildHeatmap(d,report);
 assert.equal(map.pressureVerified,false);
 assert.ok(map.cells.every(c=>Number.isNaN(c.minPressurePsi)));
});
test('Diagnostic Brain notes active correction state as raw/undecoded and never calls a negative correction a confirmed cause',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture(),report=si.analyze(d);
 const chosen=report.events.find(x=>x.kind==='LEAN');
 assert.ok(chosen);
 const result=brain.diagnose(d,report,chosen);
 assert.equal(result.error,undefined);
 const feedback=result.hypotheses.find(x=>x.id==='feedback');
 assert.ok(feedback);
 assert.ok(feedback.observed.some(x=>x.includes('raw Lambda corr A')));
 assert.ok(feedback.observed.some(x=>x.includes('NOT decoded')));
 assert.ok(feedback.checks.some(x=>x.includes('never assume')));
 assert.match(result.note,/Rules only/);
 const fuel=result.hypotheses.find(x=>x.id==='fuel-pressure');
 assert.ok(fuel.missing.some(x=>x.includes('original pressure input units')));
});
test('Without independently mapped actual/target, no fueling hypothesis is produced',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture({collision:true});
 const report=si.analyze(d);
 const answer=brain.diagnose(d,report,{kind:'LEAN',rpm:2300,map:100,a:20,b:35});
 assert.match(answer.error,/source validation failed/);
});
test('Screens thousands of samples without mixing sample count and event seconds',()=>{
 const {RawestSignalIntelligence:si,RawestSignalBrain:brain}=load(),d=fixture({rows:7450});
 const result=brain.buildHeatmap(d,si.analyze(d));
 assert.equal(result.counts.operating,7450);
 assert.ok(result.quality.some(x=>x.includes('Sample counts are NOT seconds')));
});
