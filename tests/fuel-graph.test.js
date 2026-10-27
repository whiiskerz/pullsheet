'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'signal-fuel-graph.js'),'utf8');
const c={};vm.runInNewContext(source,c);const engine=c.RawestSignalFuelGraph;
const repeated=(a,n=16)=>Array.from({length:n},()=>a);
test('lambda default when a flex-fuel log has lambda but no literal target AFR',()=>{
 const d={lambda:repeated(.84),targetLambda:repeated(.80),afr:[],targetAfr:[],stoichAfr:[]};
 const v=engine.choose(d);
 assert.equal(v.mode,'lambda');
 assert.equal(v.available.lambda,true);
 assert.equal(v.available.afr,false);
 assert.equal(v.actual[0],.84);
 assert.equal(v.target[0],.80);
});
test('clicking AFR without verified target leaves lambda visible and shows explanation',()=>{
 const d={lambda:repeated(.87),targetLambda:repeated(.82),afr:repeated(13),targetAfr:[]};
 const v=engine.choose(d,'afr');
 assert.equal(v.mode,'lambda');
 assert.match(v.notice,/Target AFR is not available/);
});
test('flex-fuel conversion uses logged stoichiometric AFR, never fixed 14.7',()=>{
 const d={lambda:[.8,.81,.82],targetLambda:[.77,.78,.79],stoichAfr:[10,10.5,11],targetAfr:[]};
 const v=engine.choose(d,'afr');
 assert.equal(v.mode,'afr');
 assert.ok(Math.abs(v.actual[0]-8)<1e-10);
 assert.ok(Math.abs(v.target[1]-8.19)<1e-10);
 assert.match(v.source,/logged stoichiometric AFR/);
});
test('logged actual and target AFR pairs are supported without lambda',()=>{
 const d={afr:repeated(12.2),targetAfr:repeated(12.0)};
 assert.equal(engine.choose(d).mode,'afr');
 assert.equal(engine.choose(d).target[0],12);
});
test('missing, colliding, or non-numeric channels cannot create a fake target',()=>{
 const collision={lambda:repeated(.87),targetLambda:repeated(.87),channelWarnings:['Measured lambda and target lambda both use Lambda [5]']};
 assert.equal(engine.choose(collision).mode,'none');
 const phantom={lambda:repeated(NaN),targetLambda:repeated(NaN),afr:[],targetAfr:[]};
 assert.equal(engine.choose(phantom).available.lambda,false);
 assert.equal(engine.choose(phantom).available.afr,false);
});
test('released HTML loads safe graph helper and explicitly presents fuel unit modes',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/signal-fuel-graph\.js\?v=4\.0\.1/);
 assert.match(html,/fuelModeControls/);
 assert.match(html,/fuelGraphNote/);
 assert.match(html,/graphSeries/);
});
