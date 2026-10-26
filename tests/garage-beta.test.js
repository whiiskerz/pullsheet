'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../garage-beta.js'),'utf8');
function engine(){
 const context={};
 vm.runInNewContext(code,context,{filename:'garage-beta.js'});
 assert.ok(context.RawestGarageBeta);
 return context.RawestGarageBeta;
}
test('Example .610/.615 valve lift vs .560 spring max is a high-priority stop and requires verification',()=>{
 const g=engine(),a=g.analyzeBuild(g.demo(),null,null);
 const alert=a.issues.find(x=>x.severity==='stop'&&x.title.includes('exceeds'));
 assert.ok(alert);
 assert.match(alert.explanation,/0\.615/);
 assert.match(alert.explanation,/0\.560/);
 assert.match(alert.explanation,/0\.055/);
 assert.equal(a.plan.gated,true);
 assert.ok(a.issues.find(x=>x.title.includes('trunnions')));
 assert.ok(a.issues.find(x=>x.title.includes('Piston-to-valve')));
});
test('Valve lift from lobe lift uses installed rocker ratio; missing ratio cannot produce false spring clearance',()=>{
 const g=engine();
 const unknown=g.analyzeHardware({camBasis:'lobe',camInt:'.360',camExh:'.365',springMaxLift:'.600'});
 assert.ok(Number.isNaN(unknown.actual));
 assert.ok(unknown.checks.find(x=>x.title.includes('Lobe lift entered without rocker ratio')));
 const known=g.analyzeHardware({camBasis:'lobe',camInt:'.360',camExh:'.365',installedRatio:'1.7',springMaxLift:'.600'});
 assert.ok(Math.abs(known.actual-.6205)<.00001);
 assert.ok(known.checks.some(x=>x.severity==='stop'));
});
test('Cam-card valve lift is scaled only when card and installed rocker ratios are known',()=>{
 const g=engine(),h=g.analyzeHardware({camBasis:'valve',camInt:'.600',camExh:'.610',camCardRatio:'1.7',installedRatio:'1.8',springMaxLift:'.625'});
 assert.ok(h.actual>.645);
 assert.ok(h.checks.some(x=>x.severity==='stop'));
 const uncertain=g.analyzeHardware({camBasis:'valve',camInt:'.600',camCardRatio:'1.7',springMaxLift:'.625'});
 assert.ok(uncertain.checks.some(x=>x.title.includes('rocker ratio')));
});
test('Lift rating alone is not clearance: measure installed height and actual coil bind',()=>{
 const g=engine();
 const h=g.analyzeHardware({camBasis:'valve',camInt:'.610',springMaxLift:'.700',springInstalledHeight:'1.8',springBindHeight:'1.16',retainerSeal:'.65'});
 const stops=h.checks.filter(x=>x.severity==='stop');
 assert.equal(stops.length,2);
 assert.ok(stops.some(x=>x.title.includes('coil bind')));
 assert.ok(stops.some(x=>x.title.includes('Retainer')));
 assert.ok(stops.find(x=>x.title.includes('coil bind')).explanation.includes('0.030'));
});
test('Physical clearance margin does not claim spring compatibility from a catalog lift rating',()=>{
 const g=engine();
 const h=g.analyzeHardware({camBasis:'valve',camInt:'.553',springMaxLift:'.660',springInstalledHeight:'1.8',springBindHeight:'1.1',retainerSeal:'.75',seatPressure:150,openPressure:375,rockerType:'upgraded',ptvChecked:'measured',springPart:'Mfr 1234'});
 assert.equal(h.checks.filter(x=>x.severity==='stop').length,0);
 assert.ok(h.checks.some(x=>x.title.includes('Calculated spring coil-bind')));
 assert.ok(h.checks.some(x=>x.title.includes('Advertised lift')));
 assert.ok(!h.checks.some(x=>x.title.includes('trunnions')));
});
test('Missing spring information produces verification needed, not an invented safe rating',()=>{
 const g=engine();
 const h=g.analyzeHardware({camBasis:'valve',camInt:'.610',camExh:'.620'});
 assert.equal(h.checks.some(x=>x.title.includes('Cannot confirm')),true);
 assert.equal(h.checks.some(x=>x.severity==='stop'),false);
});
test('Log-aware power planning gates new power on high-load lean data',()=>{
 const g=engine(),d={rpm:[2000,2200,2500],tps:[90,90,90],runtime:[1,2,3],sourceColumns:{}};
 const fake={analyze:()=>({
  n:3,events:[{kind:'LEAN',priority:'HIGH',highLoad:true,rpm:2200,a:0,b:2}],
  high:1,wotCount:3,wotSessions:[],
  pressureFactor:null,pressureInfo:{canShowPsi:false},
  quality:[{key:'Timebase',status:'present'}]
 })};
 const a=g.analyzeBuild({name:'Turbo project',engine:'LS',aspiration:'turbo',goalWhp:'650',currentWhp:'400',transmission:'8HP70',pumps:'525 pump',injectors:'200lb'},d,fake);
 assert.equal(a.logReport.available,true);
 assert.equal(a.logReport.lean,1);
 assert.equal(a.plan.gated,true);
 assert.ok(a.issues.some(x=>x.severity==='stop'&&x.title.includes('High-load lean')));
 assert.ok(a.plan.options.some(x=>x.title.includes('Forced-induction')));
 assert.ok(a.plan.options.every(x=>!x.explanation.includes('add 10 degrees of ignition')));
});
test('No loaded log does not block saving a build or fabricate a dyno result',()=>{
 const g=engine();
 const a=g.analyzeBuild({name:'NA project',aspiration:'na',goalWhp:'420'},null,null);
 assert.equal(a.logReport.available,false);
 assert.ok(a.plan.options.some(x=>x.title.includes('Naturally aspirated')));
 assert.ok(a.plan.options.some(x=>x.title.includes('Fuel-system')));
 assert.equal(a.plan.baseline,null);
});
test('Raw and malformed fields are sanitized, whitelisted and bounded for backup import',()=>{
 const g=engine();
 const b=g.cleanBuild({id:'test-1',fields:{name:'<script>ignored</script>',camInt:'.610',springMaxLift:'.560',fakePassword:'should-not-persist',year:3000,budget:'bogus'},snapshots:[{savedAt:'today',samples:22,events:1}]});
 assert.ok(b);
 assert.ok(!('fakePassword' in b.fields));
 assert.ok(!('year' in b.fields));
 assert.ok(!('budget' in b.fields));
 assert.equal(b.fields.camInt,'0.61');
 assert.equal(b.fields.springMaxLift,'0.56');
 assert.ok(b.fields.name.includes('script')); // encoded via textContent; never injected as HTML
});
test('Local build storage roundtrips multiple profiles and at most 12 snapshot summaries',()=>{
 const g=engine(),storage=new Map(),browser={
  setItem:(key,value)=>storage.set(key,value),
  getItem:key=>storage.get(key)||null
 };
 const a=g.cleanBuild({id:'a',fields:{name:'Black sedan',engine:'LS',camInt:'.553'},snapshots:Array.from({length:17},(_,i)=>({savedAt:'Day '+i,samples:i,eventCount:i}))});
 const b=g.cleanBuild({id:'b',fields:{name:'Turbo project',aspiration:'turbo',goalWhp:'650'}});
 assert.equal(a.snapshots.length,12);
 assert.equal(g.saveStorage(browser,[a,b],'b').ok,true);
 const read=g.readStorage(browser);
 assert.equal(read.builds.length,2);
 assert.equal(read.activeId,'b');
 assert.equal(read.builds[0].snapshots.length,12);
 assert.equal(read.builds[1].fields.goalWhp,'650');
});
test('Browser storage blocked: returns actionable backup warning instead of claiming build saved',()=>{
 const g=engine();
 const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(g.readStorage(broken).builds.length,0);
 const saved=g.saveStorage(broken,[],'');
 assert.equal(saved.ok,false);
 assert.ok(saved.error.includes('Export'));
});
