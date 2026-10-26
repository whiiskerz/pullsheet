'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../calibration-intelligence.js'),'utf8'),root);
const engine=root.RawestCalibrationIntelligence;
const base=new Map([
 ['VE RPM axis',['1000, 2000, 3000']],
 ['VE absolute MAP axis',['50 100 150']],
 ['VE numeric cells',['11,12,13,21,22,23,31,32,33']],
 ['Knock enable',['1']],['Rev limiter',['6500']],['Another raw setting',['d29ya2Q=']]
]);
const cfg={
 rpmKey:'VE RPM axis',loadKey:'VE absolute MAP axis',valuesKey:'VE numeric cells',
 loadUnit:'kpa-absolute',layout:'rpm-rows',confirmed:true
};
const source={method:'MaxxECU ID',name:'MAP [20]'};

test('A verified row-major calibration shows only the four surrounding stored cells',()=>{
 const table=engine.verifyTable(base,cfg);
 assert.equal(table.cellCount,9);
 const match=engine.mapEvent(table,{rpm:2023,map:96.7},source);
 assert.equal(match.cells.length,4);
 assert.equal(JSON.stringify(match.cells.map(x=>x.value)),JSON.stringify([21,22,31,32]));
 assert.ok(match.note.includes('No interpolation'));
});
test('Load-major indexing produces different cells in the same verified RPM/MAP neighborhood',()=>{
 const loadMajor=engine.verifyTable(base,{...cfg,layout:'load-rows'});
 const match=engine.mapEvent(loadMajor,{rpm:2023,map:96.7},source);
 assert.equal(JSON.stringify(match.cells.map(x=>x.value)),JSON.stringify([12,22,13,23]));
});
test('No manual verification, no table lookup',()=>{
 const table=engine.verifyTable(base,{...cfg,confirmed:false});
 assert.match(table.error,/Confirm you personally verified/);
});
test('Duplicate setting names are never silently reduced to a single table axis',()=>{
 const duplicate=new Map(base);duplicate.set('VE RPM axis',['1000,2000,3000','1000,2000,3000']);
 assert.match(engine.verifyTable(duplicate,cfg).error,/Repeated or ambiguous/);
});
test('Bad numeric encodings, non-monotonic axes and wrong cell counts fail closed',()=>{
 const encoded=new Map(base);encoded.set('VE numeric cells',['base64ZZ+']);
 assert.match(engine.verifyTable(encoded,cfg).error,/plain numeric/);
 const shorter=new Map(base);shorter.set('VE numeric cells',['1 2 3 4 5']);
 assert.match(engine.verifyTable(shorter,cfg).error,/Expected 3 × 3/);
 const reversed=new Map(base);reversed.set('VE RPM axis',['3000,2000,1000']);
 assert.match(engine.verifyTable(reversed,cfg).error,/strictly increasing/);
});
test('Event axes outside mapped table bounds are withheld, not extrapolated',()=>{
 const table=engine.verifyTable(base,cfg);
 assert.match(engine.mapEvent(table,{rpm:6500,map:120},source).error,/outside/);
 assert.match(engine.mapEvent(table,{rpm:2023,map:500},source).error,/outside/);
});
test('MAP is accepted only from exact MaxxECU MAP [20] channel ID',()=>{
 const table=engine.verifyTable(base,cfg);
 assert.match(engine.mapEvent(table,{rpm:2023,map:96.7},{method:'exact alias',name:'MAP'}).error,/not independently verified/);
 assert.match(engine.mapEvent(table,{rpm:2023,map:96.7},{method:'MaxxECU ID',name:'MAP [21]'}).error,/not independently verified/);
});
test('Revision audit distinguishes added, removed and changed exact keys',()=>{
 const compared=new Map(base);compared.set('Rev limiter',['6400']);compared.delete('Knock enable');compared.set('New MAP scalar',['9']);
 const diff=engine.diffSettings({settings:base},{settings:compared});
 assert.equal(diff.length,3);
 const limit=diff.find(x=>x.key==='Rev limiter');
 assert.equal(limit.category,'CHANGED');
 assert.equal(limit.delta,-100);
 assert.equal(limit.attention,'protection');
 assert.equal(diff.find(x=>x.key==='Knock enable').category,'REMOVED');
 assert.equal(diff.find(x=>x.key==='New MAP scalar').category,'ADDED');
});
test('Protection telemetry never fabricates sensor PSI or infers ECU safety',()=>{
 const d={headers:['RPM [12]','User AIN6 (Fuel Pressure) [341]'],sourceColumns:{rpm:0,fuelPress:1,knock:-1,warnings:-1},
  rpm:[900,1900,2600],tps:[2,50,85],fuelPress:[410,400,390],coolantF:[176,181,189]};
 const report=engine.protectionEvidence(d);
 assert.equal(report.minFuelPsi,null);
 assert.equal(report.maxCoolantF,189);
 assert.equal(report.knockCount,null);
 assert.ok(report.notes.some(x=>x.includes('PSI unavailable')));
});
test('Holley or unrecognized MAP aliases cannot satisfy verified MaxxECU table requirement',()=>{
 const table=engine.verifyTable(base,cfg);
 assert.match(engine.mapEvent(table,{rpm:2000,map:100},{method:'exact alias',name:'MAP [20]'}).error,/not independently verified/);
});
