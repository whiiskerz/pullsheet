'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const code=fs.readFileSync(path.join(__dirname,'../signal-intelligence.js'),'utf8');
const ctx={};vm.runInNewContext(code,ctx,{filename:'signal-intelligence.js'});
const engine=ctx.RawestSignalIntelligence;
assert.ok(engine&&typeof engine.detectWotSessions==='function');

function fixture({pressure=false,noTime=false,noSpeed=false,transientOnly=false}={}){
 const n=130,headers=['Engine runtime [69]','MAP [20]','Lambda corr A [102]','Lambda corr state [670]',
 'Acc enrichment [106]','Fuel cut [100]','Lambda [5]','Lambda target [81]','Fuel pressure (kPa) [341]'];
 const d={headers,rows:[],sourceFormat:'maxxecu',sourceColumns:{rpm:0,tps:1,lambda:6,targetLambda:7,fuelPress:8,gear:4},
  rpm:[],tps:[],lambda:[],targetLambda:[],fuelPress:[],runtime:[],vss:[],coolantF:[],ethanol:[],gear:[],knock:[],warnings:[]};
 for(let i=0;i<n;i++){
  const first=i>=10&&i<41,second=i>=65&&i<110,pull=first||second;
  const lateLean=!transientOnly&&i>=72&&i<=82,earlyLean=(i>=11&&i<=14)||(transientOnly&&i>=66&&i<=69);
  const rpm=first?2300+(i-10)*70:second?2400+(i-65)*62:1550;
  const lambda=lateLean||earlyLean?1.09:.87;
  d.rpm.push(rpm);d.tps.push(pull?89:21);d.lambda.push(lambda);d.targetLambda.push(.87);
  d.fuelPress.push(pressure&&i===94?310:405);d.runtime.push(noTime?NaN:i*.07);
  d.vss.push(noSpeed?NaN:55+i*.9);d.coolantF.push(174);d.ethanol.push(6.1);
  d.gear.push(i>=88?4:3);d.knock.push(0);d.warnings.push(0);
  d.rows.push([i*.07,100,0,0,0,0,lambda,.87,405].map(String));
 }
 return d;
}
const time={verified:true,quantum:.07},fuelCut=Array(130).fill(0);
test('Separate contiguous WOT attempts; do not combine driving segments',()=>{
 const sessions=engine.detectWotSessions(fixture(),{time,signals:{fuelCut},pressureInfo:{factor:null,canShowPsi:false}});
 assert.equal(sessions.length,2);
 assert.equal(sessions[0].a,10);assert.equal(sessions[0].b,40);
 assert.equal(sessions[1].a,65);assert.equal(sessions[1].b,109);
 assert.equal(sessions[0].earlyLean,4);assert.equal(sessions[0].lateLean,0);
 assert.ok(sessions[1].lateLean>0);
 assert.ok(Math.abs(sessions[1].duration-3.15)<.01);
 assert.ok(sessions[1].endMph>sessions[1].startMph);
 assert.equal(sessions[1].gearChanges,1);
});
test('No pressure units, no fabricated PSI',()=>{
 const sessions=engine.detectWotSessions(fixture(),{time,signals:{fuelCut},pressureInfo:{factor:null,canShowPsi:false}});
 assert.ok(sessions.every(s=>Number.isNaN(s.pressureMinPsi)));
 assert.ok(sessions.every(s=>s.cautions.some(c=>c.includes('Fuel PSI unavailable'))));
});
test('Verified source kPa converts to PSI but includes regulator-reference caution for pressure drops',()=>{
 const sessions=engine.detectWotSessions(fixture({pressure:true}),{time,signals:{fuelCut},pressureInfo:{factor:.1450377377,canShowPsi:true}});
 const last=sessions[1];
 assert.ok(last.pressureMinPsi>=44&&last.pressureMinPsi<46);
 assert.ok(last.pressureMedianPsi>58&&last.pressureMedianPsi<60);
 assert.ok(last.cautions.some(x=>x.includes('differential-pressure reference')));
});
test('Unknown time and speed stay unknown without invented durations or mph',()=>{
 const d=fixture({noTime:true,noSpeed:true});
 const sessions=engine.detectWotSessions(d,{time:{verified:false},signals:{fuelCut},pressureInfo:null});
 assert.equal(sessions.length,2);
 assert.ok(sessions.every(s=>Number.isNaN(s.duration)));
 assert.ok(sessions.every(s=>Number.isNaN(s.startMph)));
});
test('Brief high throttle fragments are not called full pull sessions',()=>{
 const d=fixture();
 for(let i=10;i<41;i++)if(i>=15)d.tps[i]=15;
 for(let i=65;i<110;i++)d.tps[i]=15;
 const sessions=engine.detectWotSessions(d,{time,signals:{fuelCut},pressureInfo:null});
 assert.equal(sessions.length,0);
});
test('Workflow notes mention actual sessions and late lean rather than only aggregate WOT rows',()=>{
 const d=fixture();
 const wotSessions=engine.detectWotSessions(d,{time,signals:{fuelCut},pressureInfo:{factor:null,canShowPsi:false}});
 const info=engine.workflowInfo(d,{events:[],wotCount:76,wotSessions},'wot');
 assert.ok(info.notes.some(note=>note.includes('2 continuous high-throttle run')));
 assert.ok(info.notes.some(note=>note.includes('>0.5 seconds')));
});
