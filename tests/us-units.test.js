'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../signal-units.js'),'utf8');
function load(){
 const store=new Map();
 const context={localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
 vm.runInNewContext(source,context,{filename:'signal-units.js'});
 return {units:context.RawestSignalUnits,store};
}
const fuel=(header,raw=405)=>({
 headers:['RPM [12]',header],sourceColumns:{fuelPress:1},
 fuelPress:[raw],sourceFormat:'maxxecu'
});
test('Unknown pressure input stays unknown; never assume raw 405 is PSI',()=>{
 const {units}=load(),info=units.describe(fuel('User AIN6 (Fuel Pressure) [341]'));
 assert.equal(info.canShowPsi,false);
 assert.equal(Number.isNaN(info.psi(405)),true);
 assert.match(info.display(405),/PSI unavailable/);
});
test('Manual kPa selection calculates PSI and persists by sensor identity',()=>{
 const {units}=load(),d=fuel('User AIN6 (Fuel Pressure) [341]');
 const header=units.mappedHeader(d,'fuelPress');
 assert.equal(units.save(header,'kpa'),true);
 const info=units.describe(d);
 assert.equal(info.canShowPsi,true);
 assert.equal(info.source,'remembered user selection');
 assert.ok(Math.abs(info.psi(405)-58.74)<.1);
 assert.equal(info.display(405),'58.7 PSI');
});
test('Known source units convert PSI safely and manual selection overrides label',()=>{
 const {units}=load(),d=fuel('Fuel Pressure (bar) [341]',4.1);
 assert.ok(Math.abs(units.describe(d).psi(4.1)-59.47)<.1);
 assert.ok(Math.abs(units.describe(d,'fuelPress','psi').psi(4.1)-4.1)<.01);
});
test('Explicit Holley pressure units are supported without magnitude guessing',()=>{
 const {units}=load();
 const d=fuel('Fuel Pressure',60);d.sourceFormat='holley';d.sourceUnits={fuelPress:'PSI'};
 assert.equal(units.describe(d).display(60),'60.0 PSI');
});
test('Temperature, speed and mass conversions use US units with correct physics inputs',()=>{
 const {units}=load();
 assert.ok(Math.abs(units.fahrenheitFromC(80)-176)<1e-9);
 assert.ok(Math.abs(units.mphFromKmh(100)-62.137)<.01);
 assert.ok(Math.abs(units.kilogramsFromPounds(3650)-1655.6)<.1);
});
test('HTML and service worker load the same versioned converter',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 const htmlVersion=html.match(/signal-units\.js\?v=(\d+\.\d+\.\d+)/)?.[1];
 const swVersion=sw.match(/signal-units\.js\?v=(\d+\.\d+\.\d+)/)?.[1];
 assert.ok(htmlVersion,'US unit script must have a cache-busting version');
 assert.equal(swVersion,htmlVersion,'Service worker and HTML must cache the same units file');
 assert.match(html,/Vehicle weight incl\. driver \(lb\)/);
 assert.match(html,/Drag area, CdA \(ft²\)/);
});
