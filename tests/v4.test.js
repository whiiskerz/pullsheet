'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const load=p=>fs.readFileSync(path.join(root,p),'utf8');
const sandbox={};
vm.runInNewContext(load('signal-v4-core.js'),sandbox,{filename:'signal-v4-core.js'});
const core=sandbox.RawestSignalV4Core;
test('v4 helpers are loadable in a browser-like script context',()=>{
 assert.equal(core.version,'4.0.0');
 assert.equal(typeof core.answer,'function');
 assert.doesNotThrow(()=>new vm.Script(load('signal-v4.js')));
});
test('events come from real engine findings, not fabricated scores',()=>{
 const findings=[{a:8,b:11,kind:'LEAN',priority:'REVIEW',score:50,rpm:2800},{a:40,b:45,kind:'KNOCK',priority:'HIGH',score:88,rpm:4900},{kind:'INVALID'}];
 const ranked=core.selectEvents({events:findings});
 assert.equal(ranked.length,2);
 assert.equal(ranked[0].kind,'KNOCK');
 assert.match(core.eventSummary(ranked[0]),/Rows 41/);
 assert.equal(core.selectEvents({events:[]}).length,0);
});
test('sensor hints are exact-name, unique-only suggestions (never validated calibrations)',()=>{
 const headers=['RPM [1]','Lambda [53]','Lambda target [81]','Lambda [12]','Primary fuel pressure [499]','TPS [41]','My special boost sensor [999]'];
 const s=core.suggestions(headers);
 assert.equal(s.find(x=>x.id==='cfgRPM').unique,true);
 assert.equal(s.find(x=>x.id==='cfgLambda').ambiguous,true);
 assert.equal(s.find(x=>x.id==='cfgTargetLambda').candidates.length,1);
 assert.equal(s.find(x=>x.id==='cfgFuel').unique,true);
 assert.ok(s.every(x=>x.candidates.every(c=>headers[c.index]===c.name)));
 assert.equal(core.suggestions(['User AIN6 (Fuel Press) [345]']).find(x=>x.id==='cfgFuel').unique,false);
});
test('SIGNAL Guide includes recorded evidence, refuses unsupported diagnoses',()=>{
 const event={a:20,b:27,kind:'PRESSURE DIP',rpm:4000,tps:65,priority:'HIGH',duration:0.24};
 const hypotheses=[{id:'relative-drop',title:'Relative pressure anomaly',observed:['Pressure fell under logged load.'],missing:['Verify pressure sensor.'],checks:['Verify units and regulator reference.']}];
 const report={gates:['Pressure units missing']};
 const out=core.answer('Why pressure low?',event,{hypotheses},report);
 assert.match(out.body,/hypothesis, not a confirmed cause/);
 assert.equal(out.evidence[0],'Pressure fell under logged load.');
 assert.match(out.next[0],/Verify units/);
 assert.match(core.answer('my boost controller',event,{hypotheses:[]},report).body,/does not establish a specific diagnosis/);
 assert.match(core.answer('why',null,null,null).body,/actual log/);
});
test('before after never claims proof and distinguishes incomparable conditions',()=>{
 let out=core.compareInsight({rows:[{delta:-1},{delta:.8}],ethanolGap:12});
 assert.equal(out.status,'unknown');
 assert.match(out.text,/Do not call/);
 out=core.compareInsight({rows:[{delta:-2},{delta:-1},{delta:0}],ethanolGap:3});
 assert.equal(out.status,'closer');
 assert.match(out.text,/cannot prove/);
 out=core.compareInsight({rows:[{delta:-2}],ethanolGap:NaN});
 assert.equal(out.status,'limited');
});
test('v4 files are actually loaded by HTML, cached offline and version-aligned',()=>{
 const html=load('index.html'),worker=load('sw.js'),manifest=JSON.parse(load('manifest.json'));
 for(const f of ['signal-v4.js','signal-v4-core.js','signal-v4.css','signal-fuel-graph.js','signal-docs-library.js']){
  assert.ok(html.includes(f+'?v=4.0.2'),f+' missing from HTML');
  assert.ok(worker.includes(f+'?v=4.0.2'),f+' missing from offline cache');
 }
 assert.match(html,/RAWEST SIGNAL v4\.0\.2/);
 assert.match(manifest.name,/v4\.0\.2/);
 const ui=load('signal-v4.js');
 for(const feature of ['v4Timeline','v4Question','v4Sensors','v4Compare','v4OpenGarage','v4Printable','v4Onboarding']){
  assert.ok(ui.includes(feature),feature+' UI missing');
 }
 assert.match(ui,/window\.RawestSignalExperience\.showResults=function/);
 assert.ok(html.includes('href="./docs/"'));
 assert.ok(worker.includes('./docs/index.html'));
});
