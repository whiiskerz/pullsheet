/* RAWEST SIGNAL 4.0.1 — local reference document library.
 * User-supplied text is supplementary context, never ECU evidence.
 * No server, cloud sync, PDF OCR, embedded scripts, or automatic tuning changes.
 */
(function(root){
'use strict';
const KEY='rawest-signal-local-docs-v1';
const MAX_FILE=200*1024,MAX_TOTAL=500*1024,MAX_DOCS=10;
const allowed=/\.(md|markdown|txt|csv|json)$/i;
const storage=()=>{try{return root.localStorage||null;}catch(e){return null;}};
function docs(){
 try{const raw=JSON.parse(storage()?.getItem(KEY)||'[]');
 return Array.isArray(raw)?raw.filter(d=>d&&typeof d.text==='string'&&typeof d.name==='string').slice(0,MAX_DOCS):[];}catch(e){return[];}
}
function persist(all){
 try{const local=storage();if(!local)return {ok:false,error:'Local browser storage unavailable; files were not saved.'};
 local.setItem(KEY,JSON.stringify(all));return{ok:true};}
 catch(e){return{ok:false,error:'Storage is full or unavailable. Remove older references before importing.'};}
}
function sanitizeName(name){return String(name||'Reference').replace(/[\u0000-\u001f]/g,'').slice(0,100);}
function add(name,text){
 if(!allowed.test(String(name||'')))return {ok:false,error:'Use text documents (.txt, .md, .markdown, .csv, .json). PDF extraction is not supported; export your PDF text first.'};
 if(typeof text!=='string'||!text.trim())return{ok:false,error:'This text document is empty.'};
 if(new TextEncoder().encode(text).length>MAX_FILE)return{ok:false,error:'Document too large. Maximum text size is 200 KB.'};
 const current=docs(),safe=sanitizeName(name);
 const cleaned=String(text).replace(/\u0000/g,'').slice(0,MAX_FILE);
 const filtered=current.filter(d=>d.name!==safe);
 if(filtered.length>=MAX_DOCS)return{ok:false,error:'You can save up to 10 reference documents. Remove one before adding another.'};
 const total=filtered.reduce((n,d)=>n+d.text.length,0)+cleaned.length;
 if(total>MAX_TOTAL)return{ok:false,error:'Reference library is full (500 KB total). Remove older documents.'};
 const entry={name:safe,text:cleaned,addedAt:new Date().toISOString()};
 const saved=persist([...filtered,entry]);return saved.ok?{ok:true,entry:{name:entry.name,length:entry.text.length}}:saved;
}
async function addFiles(files){
 const results=[];
 for(const file of Array.from(files||[])){
  if(!file?.name){results.push({ok:false,error:'No file selected'});continue;}
  if(!allowed.test(file.name)){results.push({ok:false,name:file.name,error:'Only text/Markdown/CSV/JSON can be searched. PDF extraction is not supported; export PDF text first.'});continue;}
  if(file.size>MAX_FILE){results.push({ok:false,name:file.name,error:'Maximum 200 KB per document.'});continue;}
  try{results.push({name:file.name,...add(file.name,await file.text())});}
  catch(e){results.push({ok:false,name:file.name,error:'Could not read selected file.'});}
 }
 return results;
}
function remove(name){const after=docs().filter(d=>d.name!==name);return persist(after);}
function clear(){return persist([]);}
const STOP=new Set(['what','this','that','the','and','for','does','with','from','about','have','your','why','how','can','are','was','all','into','when','it','is']);
function terms(query){return [...new Set(String(query||'').toLowerCase().match(/[a-z0-9]{3,}/g)||[])].filter(x=>!STOP.has(x)).slice(0,12);}
function search(query,limit=3){
 const words=terms(query);if(!words.length)return[];
 const hits=[];
 for(const doc of docs()){
  const paras=doc.text.split(/\n\s*\n|\r?\n(?=#{1,4} )/).map(x=>x.trim()).filter(Boolean);
  for(const para of paras){
   const safe=para.slice(0,1200).replace(/\s+/g,' ').trim();
   const lower=safe.toLowerCase();
   const score=words.reduce((n,w)=>n+(lower.includes(w)?1:0),0);
   if(score>=1)hits.push({name:doc.name,excerpt:safe.slice(0,350)+(safe.length>350?'…':''),score});
  }
 }
 return hits.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,Math.min(5,Math.max(1,limit)));
}
root.RawestSignalDocs={version:'4.0.1',docs,add,addFiles,remove,clear,search,MAX_FILE,MAX_TOTAL,MAX_DOCS};
})(typeof window!=='undefined'?window:globalThis);
