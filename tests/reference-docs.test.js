'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(base,'signal-docs-library.js'),'utf8');
function setup(){
 const map=new Map(),storage={getItem:key=>map.get(key)||null,setItem:(key,val)=>map.set(key,val)};
 const ctx={localStorage:storage,TextEncoder,Date};
 vm.runInNewContext(source,ctx);
 return {library:ctx.RawestSignalDocs,map};
}
test('reference docs stay in browser storage and can be searched by recorded question',()=>{
 const {library,map}=setup();
 assert.equal(library.add('maxxecu-notes.txt','Fuel pressure must be calibrated to the correct analog input range.').ok,true);
 assert.equal(library.docs().length,1);
 assert.ok(Array.from(map.keys()).some(key=>key.includes('local-docs')));
 const matches=library.search('Why did fuel pressure change?');
 assert.equal(matches.length,1);
 assert.match(matches[0].excerpt,/analog input/);
 assert.equal(matches[0].name,'maxxecu-notes.txt');
});
test('PDF and unsupported formats are rejected rather than silently treated as parsed',()=>{
 const {library}=setup();
 const pdf=library.add('manual.pdf','Some extracted text');
 assert.equal(pdf.ok,false);
 assert.match(pdf.error,/PDF extraction/);
 assert.equal(library.docs().length,0);
});
test('size limits and user-controlled deletion work',()=>{
 const {library}=setup();
 assert.equal(library.add('too-large.md','x'.repeat(205000)).ok,false);
 library.add('guide.md','Knock correction is not a confirmed detonation diagnosis.');
 assert.equal(library.remove('guide.md').ok,true);
 assert.equal(library.docs().length,0);
});
test('document search only returns relevant snippets, never pretends they are ECU data',()=>{
 const {library}=setup();
 library.add('note.md','Coolant sensor reference point.\n\nBattery charging checks are separate.');
 assert.equal(library.search('fuel rail').length,0);
 const hit=library.search('battery voltage');
 assert.equal(hit.length,1);
 assert.match(hit[0].excerpt,/Battery charging/);
});
test('public help center and documents view are present',()=>{
 const html=fs.readFileSync(path.join(base,'docs/index.html'),'utf8');
 const script=fs.readFileSync(path.join(base,'signal-v4.js'),'utf8');
 assert.match(html,/Add manuals and reference documents/);
 assert.match(html,/PDF text extraction/);
 assert.match(script,/v4DocUpload/);
 assert.match(script,/RawestSignalDocs/);
});
