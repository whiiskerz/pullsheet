'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const code=fs.readFileSync(path.join(__dirname,'../signal-intelligence.js'),'utf8');
const runtime={};
vm.runInNewContext(code,runtime,{filename:'signal-intelligence.js'});
const engine=runtime.RawestSignalIntelligence;

const event=(kind,rpm,tps,a,b,more={})=>({kind,rpm,tps,a,b,...more});
const sampleEvents=[
 event('LEAN',2023,89,10,18,{highLoad:true}),
 event('RICH',1450,20,20,30,{transient:true}),
 event('KNOCK',2200,82,35,39),
 event('ECU WARNING',2000,75,50,55),
 event('LEAN',850,5,66,77)
];
const d={
 rpm:Array.from({length:100},()=>1800),
 tps:Array.from({length:100},()=>20),
 vss:Array.from({length:100},()=>90),
 launches:[{startTime:12.5,time30:7.5}],
 sourceColumns:{vss:4,brakeSwitch:10},
 ethanol:Array.from({length:100},()=>6)
};
// The knock is at a measured stop; unrelated lean events are not automatically launch events.
d.vss[37]=1;d.vss[52]=70;
test('Launch workflow excludes ordinary fueling spikes without verified near-stop context',()=>{
 const focused=engine.forGoal(sampleEvents,d,'launch');
 assert.equal(focused.length,1);
 assert.equal(focused[0].kind,'KNOCK');
});
test('Spark workflow uses only knock and warning evidence',()=>{
 const focused=engine.forGoal(sampleEvents,d,'spark');
 assert.equal(focused.length,2);
 assert.ok(focused.every(e=>e.kind==='KNOCK'||e.kind==='ECU WARNING'));
});
test('WOT workflow retains high-throttle events, not light-throttle richness',()=>{
 const focused=engine.forGoal(sampleEvents,d,'wot');
 assert.equal(focused.length,2);
 assert.ok(!focused.includes(sampleEvents[1]));
});
test('Flex workflow keeps all diagnostic findings',()=>{
 assert.equal(engine.forGoal(sampleEvents,d,'flex').length,5);
});
test('Launch information distinguishes speed-derived start from actual launch activation',()=>{
 const result={events:sampleEvents,wotCount:0};
 const info=engine.workflowInfo(d,result,'launch');
 assert.ok(info.notes.some(x=>x.includes('NOT prove')));
 assert.ok(info.notes.some(x=>x.includes('standing-start candidate')));
});
test('Switching logs triggers refreshed Explorer and clears stale report',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../ai-tuner.js'),'utf8');
 const a=source.indexOf('let studioLogIdentity=null;');
 const b=source.indexOf('\nwindow.pullsheetAI=',a);
 assert.ok(a>=0&&b>a);
 const stale={count:0,replaceChildren(){this.count++}};
 const findings={count:0,replaceChildren(){this.count++}};
 let refreshed=0,rendered=0;
 let calibrationRefreshes=0;
 const onChanged=new Function('
 const one={rpm:[1000]};
 onChanged(one);onChanged(one);onChanged({rpm:[1100]});onChanged(null);
 assert.equal(stale.count,3);
 assert.equal(findings.count,3);
 assert.equal(refreshed,4);
 assert.equal(rendered,4);
 assert.equal(calibrationRefreshes,4);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/window\.pullsheetAI\?\.onLogChanged\?\.\(d\)/);
 assert.match(html,/window\.pullsheetAI\?\.onLogChanged\?\.\(null\)/);
});
,'refreshStudio','renderEvents','renderCalibrationIntelligence',
  source.slice(a,b)+'\nreturn onLogChanged;')(
   id=>id==='aiPlanResult'?stale:id==='aiFindings'?findings:null,
   ()=>refreshed++,()=>rendered++,()=>calibrationRefreshes++);
 const one={rpm:[1000]};
 onChanged(one);onChanged(one);onChanged({rpm:[1100]});onChanged(null);
 assert.equal(stale.count,3);
 assert.equal(findings.count,3);
 assert.equal(refreshed,4);
 assert.equal(rendered,4);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/window\.pullsheetAI\?\.onLogChanged\?\.\(d\)/);
 assert.match(html,/window\.pullsheetAI\?\.onLogChanged\?\.\(null\)/);
});
