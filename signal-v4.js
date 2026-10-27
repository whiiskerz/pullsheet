/* RAWEST SIGNAL 4.0 — beginner-first dashboard, built entirely on existing read-only engines. */
(function(){
'use strict';
const id=n=>document.getElementById(n), core=window.RawestSignalV4Core;
const engine=window.RawestSignalIntelligence, brain=window.RawestSignalBrain;
if(!core||!engine||!id('view-analyze')||!window.RawestSignalExperience)return;
const node=(tag,cls,content)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content!==undefined)el.textContent=String(content);return el;};
const clear=el=>el&&el.replaceChildren();
const num=Number.isFinite,fmt=core.fmt;
let log=null,review=null,filename='',active=null,diagnosis=null,activeIndex=0,health=null;
const wrapper=document.createElement('section');wrapper.id='signalV4';wrapper.className='v4-workspace';wrapper.hidden=true;
wrapper.setAttribute('aria-label','RAWEST SIGNAL 4.0 guided review');
wrapper.innerHTML=[
'<div class="v4-head"><div><span class="signal-eyebrow">SIGNAL 4.0 · THE REAL STORY BEHIND YOUR LOG</span><h2>Your drive, decoded.</h2><p id="v4Source">Only information present in your imported log is shown.</p></div>',
'<div class="v4-head-actions"><button id="v4GuideStart" type="button" class="signal-action">How to use this</button><button id="v4Print" type="button" class="signal-action primary">Print / save PDF</button></div></div>',
'<div class="v4-status" id="v4Status" aria-live="polite"></div>',
'<nav class="v4-nav" aria-label="Review steps"><button type="button" data-v4tab="moments" aria-pressed="true">01 · Moments</button><button type="button" data-v4tab="guide" aria-pressed="false">02 · SIGNAL Guide</button><button type="button" data-v4tab="sensors" aria-pressed="false">03 · Sensors</button><button type="button" data-v4tab="compare" aria-pressed="false">04 · Compare</button><button type="button" data-v4tab="garage" aria-pressed="false">05 · Garage</button><button type="button" data-v4tab="report" aria-pressed="false">06 · Report</button></nav>',
'<section class="v4-page" data-v4page="moments"><div class="v4-grid"><div class="v4-panel"><div class="v4-panel-head"><h3>Tap an event</h3><span id="v4EventCount"></span></div><p class="v4-muted">The app sorts potential concerns first. An alert is something to inspect, not a confirmed engine failure.</p><div class="v4-timeline" id="v4Timeline" role="group" aria-label="Recorded event positions"></div><div class="v4-events" id="v4Events"></div></div><div class="v4-panel v4-event-detail"><div class="v4-panel-head"><h3 id="v4EventTitle">Select a moment</h3><span id="v4EventTag"></span></div><p id="v4EventExplanation"></p><div class="v4-metrics" id="v4Metrics"></div><div id="v4Traces"></div><p class="v4-muted" id="v4ChartCaution"></p><button type="button" class="signal-action" id="v4AskThis">Ask SIGNAL about this moment ↗</button></div></div></section>',
'<section class="v4-page" data-v4page="guide" hidden><div class="v4-panel"><span class="signal-eyebrow">EXPLANATIONS BASED ON YOUR LOG</span><h3>Ask SIGNAL Guide</h3><p class="v4-muted">This is a transparent, offline question guide. It uses recorded evidence and diagnostic checks, not a cloud AI model or invented answers.</p><div class="v4-questions"><button type="button" data-question="What happened?">What happened?</button><button type="button" data-question="Why was the fuel pressure low?">Fuel pressure?</button><button type="button" data-question="What does lambda mean here?">Lambda / AFR?</button><button type="button" data-question="Was there knock?">Knock warning?</button><button type="button" data-question="What should I check next?">What next?</button></div><div class="v4-ask-line"><input id="v4Question" maxlength="160" placeholder="Ask about pressure, lambda, corrections..." aria-label="Question about this log"><button type="button" class="signal-action primary" id="v4Send">Explain</button></div><div class="v4-answer" id="v4Answer" role="status" aria-live="polite"></div></div></section>',
'<section class="v4-page" data-v4page="sensors" hidden><div class="v4-panel"><span class="signal-eyebrow">SETUP ASSISTANT</span><h3>Know what your sensors mean</h3><p class="v4-muted">Suggestions match unique, recognizable header names only. Review before applying. Pressure calibration and units are never guessed, and selecting a column does not verify its scaling.</p><div id="v4Sensors"></div><p class="v4-muted" id="v4SensorNote"></p><button type="button" id="v4FullConfig" class="signal-action">Open full sensor settings ↗</button></div></section>',
'<section class="v4-page" data-v4page="compare" hidden><div class="v4-panel"><span class="signal-eyebrow">CHANGE CHECK</span><h3>Did the next log look different?</h3><p class="v4-muted">Save this log as a baseline, then import a newer log. We compare only overlapping, sufficiently sampled RPM/load areas. This does not prove a tune caused a change.</p><div class="v4-controls"><button id="v4SaveBase" class="signal-action primary" type="button">Save current log as baseline</button><button id="v4ClearBase" class="signal-action" type="button">Clear baseline</button></div><div id="v4Compare"></div></div></section>',
'<section class="v4-page" data-v4page="garage" hidden><div class="v4-panel"><span class="signal-eyebrow">YOUR BUILD</span><h3>Give every log a home.</h3><p class="v4-muted">My Garage already tracks engine, fuel, drivetrain, tune settings and project notes on this device. The log you loaded is also available to Garage screening.</p><div id="v4GarageSummary"></div><button type="button" class="signal-action primary" id="v4OpenGarage">Open my garage ↗</button><p class="v4-muted">Export your Garage backup before changing devices; there is no online account syncing.</p></div></section>',
'<section class="v4-page" data-v4page="report" hidden><div class="v4-panel"><span class="signal-eyebrow">SHARE YOUR FINDINGS</span><h3>A report worth keeping.</h3><p class="v4-muted">The printable report includes real evidence, known limits, and follow-up checks. Use your device print dialog to save as PDF. No file is sent to a server.</p><div class="v4-controls"><button class="signal-action primary" type="button" id="v4PrintAgain">Print / save as PDF</button><button class="signal-action" type="button" id="v4Download">Download standalone HTML report</button></div><div id="v4ReportPreview"></div></div></section>',
'<div class="v4-report-only" id="v4Printable" aria-label="Printable diagnostic report"></div>'
].join('');
const prior=id('signalReview');
if(prior)prior.insertAdjacentElement('afterend',wrapper);else id('results').insertAdjacentElement('beforebegin',wrapper);
function goTab(name){
 wrapper.querySelectorAll('[data-v4tab]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.v4tab===name)));
 wrapper.querySelectorAll('[data-v4page]').forEach(x=>x.hidden=x.dataset.v4page!==name);
 if(name==='compare')drawComparison();
 if(name==='garage')drawGarage();
 if(name==='report')drawReport();
}
wrapper.querySelectorAll('[data-v4tab]').forEach(btn=>btn.addEventListener('click',()=>goTab(btn.dataset.v4tab)));
function openOriginalTab(tabName){
 const btn=document.querySelector('.tabs [data-tab="'+tabName+'"]');
 if(btn){btn.click();window.scrollTo?.({top:0,behavior:'smooth'});}
}
function getQuality(){
 if(!review||review.error)return 'Log analysis not available.';
 const missing=(review.quality||[]).filter(q=>['missing','suspect','unverified'].includes(q.status)).map(q=>q.key);
 return missing.length?missing.length+' data sources need review: '+missing.slice(0,5).join(', ')+(missing.length>5?'…':''):'Available source checks listed below. This is not a safety certification.';
}
function drawStatus(){
 const host=id('v4Status');clear(host);
 const parts=[
  {headline:String(review?.events?.length||0),label:'Recorded events (not diagnoses)'},
  {headline:String(review?.high||0),label:'High-priority items'},
  {headline:review?.time?.verified?'Verified':'Not verified',label:'Elapsed timebase'},
  {headline:String(review?.validPairCount??0),label:'Usable paired lambda samples'}
 ];
 for(const p of parts){const box=node('div','v4-stat');box.append(node('strong','',p.headline),node('span','',p.label));host.append(box);}
 id('v4Source').textContent=filename+' · '+(log?.rowCount||log?.rpm?.length||0)+' samples · '+getQuality();
}
function addMetric(label,value){
 const box=node('div','v4-metric');box.append(node('span','',label),node('strong','',value));id('v4Metrics').append(box);
}
function plot(host,label,values,start,end,color){
 if(!Array.isArray(values))return;
 const samples=[];
 const step=Math.max(1,Math.ceil((end-start+1)/120));
 for(let i=start;i<=end;i+=step)if(num(values[i]))samples.push({i,y:values[i]});
 if(samples.length<3)return;
 const min=Math.min(...samples.map(x=>x.y)),max=Math.max(...samples.map(x=>x.y)),range=max-min||1;
 const row=node('div','v4-trace');row.append(node('div','v4-trace-title',label+' · '+fmt(min,2)+' to '+fmt(max,2)+' (source units)'));
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 500 82');svg.setAttribute('role','img');svg.setAttribute('aria-label',label+' readings for the selected range');
 const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width','2.4');line.setAttribute('stroke-linejoin','round');
 line.setAttribute('points',samples.map(p=>(8+484*(p.i-start)/Math.max(1,end-start)).toFixed(1)+','+(72-60*(p.y-min)/range).toFixed(1)).join(' '));svg.append(line);
 const center=(active.a+active.b)/2;
 const mark=document.createElementNS('http://www.w3.org/2000/svg','line');const x=8+484*(center-start)/Math.max(1,end-start);
 for(const [k,v] of [['x1',x],['x2',x],['y1','0'],['y2','82'],['stroke','#f9cf70'],['stroke-width','1.5'],['stroke-dasharray','5 5']])mark.setAttribute(k,String(v));svg.append(mark);
 row.append(svg);host.append(row);
}
function drawEvent(){
 const host=id('v4Traces');clear(host);clear(id('v4Metrics'));
 if(!active){id('v4EventTitle').textContent='No flagged moments in available channels';id('v4EventExplanation').textContent='There may still be unlogged conditions. Check sensors and full analysis.';id('v4EventTag').textContent='NO EVENT SELECTED';id('v4ChartCaution').textContent='';id('v4AskThis').disabled=true;return;}
 id('v4AskThis').disabled=false;
 id('v4EventTitle').textContent=core.eventLabel(active);
 id('v4EventExplanation').textContent=core.eventSummary(active)+' '+(active.context||'');
 id('v4EventTag').textContent=active.priority+' PRIORITY';
 addMetric('RPM',num(active.rpm)?fmt(active.rpm,0):'Unknown');
 addMetric('Throttle',num(active.tps)?fmt(active.tps,0)+'%':'Unknown');
 addMetric('Recorded rows',(active.a+1)+'–'+(active.b+1));
 addMetric('Elapsed time',review?.time?.verified&&num(active.duration)?fmt(active.duration,2)+' s':'Not verified');
 if(num(active.lambda)&&num(active.target))addMetric('Lambda / target',fmt(active.lambda,3)+' / '+fmt(active.target,3));
 const a=Math.max(0,active.a-35),b=Math.min(log.rpm.length-1,active.b+35);
 plot(host,'Engine RPM',log.rpm,a,b,'#b8a0ff');
 plot(host,'Throttle %',log.tps,a,b,'#79d8d4');
 if(num(active.lambda)||Array.isArray(log.lambda)){
  plot(host,'Lambda measured',log.lambda,a,b,'#ffcc76');
  plot(host,'Lambda commanded',log.targetLambda,a,b,'#bcb5e5');
 }
 if(review?.pressureFactor!==null&&num(review?.pressureFactor)){
  plot(host,'Fuel pressure (verified conversion to PSI)',log.fuelPress?.map(x=>num(x)?x*review.pressureFactor:NaN),a,b,'#ef9cac');
 }
 id('v4ChartCaution').textContent='Gold marker: selected event center. Every trace uses its own vertical scale; do not compare line heights across channels. '+(review?.time?.verified?'Event time based on verified runtime.':'Elapsed seconds are unavailable: the chart uses recorded row order.')+' Verify source units and sensor scaling.';
}
function drawTimeline(){
 const events=core.selectEvents(review,40);const panel=id('v4Events'),track=id('v4Timeline');
 clear(panel);clear(track);id('v4EventCount').textContent=String((review?.events||[]).length)+' found · first '+events.length+' displayed';
 const bar=node('div','v4-track');track.append(bar);
 if(!events.length){panel.append(node('p','v4-muted','No qualifying events were identified in the available channels. Missing data still requires inspection.'));active=null;drawEvent();return;}
 events.forEach((ev,i)=>{
  const chip=node('button','v4-track-pin','');chip.type='button';chip.style.left=Math.max(2,Math.min(98,100*(ev.a+ev.b)/2/Math.max(1,log.rpm.length-1)))+'%';
  chip.title=core.eventLabel(ev)+' · row '+(ev.a+1);
  chip.setAttribute('aria-label',chip.title);chip.classList.toggle('urgent',ev.priority==='HIGH');
  chip.addEventListener('click',()=>select(i));bar.append(chip);
  const btn=node('button','v4-event');btn.type='button';
  btn.append(node('span','v4-event-severity',ev.priority||'REVIEW'));
  const body=node('span','v4-event-words');body.append(node('strong','',core.eventLabel(ev)),node('small','','Rows '+(ev.a+1)+'–'+(ev.b+1)+' · '+(num(ev.rpm)?fmt(ev.rpm,0)+' RPM':'RPM unknown')));
  btn.append(body,node('span','v4-event-arrow','↗'));btn.addEventListener('click',()=>select(i));panel.append(btn);
 });
 function select(i){activeIndex=i;active=events[i];panel.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));bar.querySelectorAll('button').forEach((b,j)=>b.setAttribute('aria-pressed',String(j===i)));try{diagnosis=brain?.diagnose?.(log,review,active)||null;}catch(e){diagnosis=null;}drawEvent();drawAnswer('What happened?');}
 select(0);
}
function drawAnswer(question){
 const area=id('v4Answer');clear(area);const a=core.answer(question,active,diagnosis,review);
 area.append(node('h4','',a.title),node('p','',a.body));
 for(const [title,arr] of [['Recorded evidence',a.evidence],['Checks to consider',a.next]]){
  if(!arr.length)continue;area.append(node('strong','v4-answer-label',title));
  const list=node('ul');arr.forEach(txt=>list.append(node('li','',txt)));area.append(list);
 }
 if(diagnosis?.error)area.append(node('p','v4-warning',diagnosis.error));
 area.append(node('p','v4-muted','Guide does not write tune files, choose fuel/spark corrections or certify safe operation.'));
}
wrapper.querySelectorAll('[data-question]').forEach(btn=>btn.addEventListener('click',()=>{id('v4Question').value=btn.dataset.question;drawAnswer(btn.dataset.question);}));
id('v4Send').addEventListener('click',()=>drawAnswer(id('v4Question').value));
id('v4Question').addEventListener('keydown',e=>{if(e.key==='Enter')drawAnswer(e.target.value);});
id('v4AskThis').addEventListener('click',()=>goTab('guide'));
function drawSensors(){
 const area=id('v4Sensors');clear(area);const suggestions=core.suggestions(log.headers||[]);let count=0;
 for(const sug of suggestions){
  const cfg=id(sug.id);if(!cfg)continue;
  const row=node('div','v4-sensor');
  const info=node('div','v4-sensor-info');info.append(node('strong','',sug.label));
  const chosen=cfg.value!=='auto'&&cfg.selectedOptions.length?cfg.selectedOptions[0].textContent:'Auto-detect / not manually confirmed';
  info.append(node('small','',chosen));row.append(info);
  if(sug.unique){
   const b=node('button','signal-action','Review suggestion');b.type='button';b.title='Review before choosing: '+sug.candidates[0].name;
   b.addEventListener('click',()=>{
    const guess='__INDEX__'+sug.candidates[0].index;
    if(!Array.from(cfg.options).some(x=>x.value===guess)){id('v4SensorNote').textContent='Suggestion is not in the channel selector. Use full settings.';return;}
    const approved=window.confirm('Use "'+sug.candidates[0].name+'" for '+sug.label+'?\n\nThis selects a column only. It does NOT validate sensor units, pressure calibration or correct ECU wiring.');
    if(!approved)return;
    cfg.value=guess;cfg.dispatchEvent(new Event('change',{bubbles:true}));
    id('v4SensorNote').textContent=sug.label+' column selected. Verify units and sensor calibration in full settings.';
    drawSensors();
   });row.append(b);count++;
  }else row.append(node('span','v4-sensor-state',sug.ambiguous?'Multiple matches · choose manually':'Needs manual review'));
  area.append(row);
 }
 id('v4SensorNote').textContent=count+' uniquely named sensor suggestions available. Check the source file and ECU setup before trusting any measurement. Pressure and temperature calibration is not verified by these suggestions.';
}
id('v4FullConfig').addEventListener('click',()=>openOriginalTab('config'));
function drawGarage(){
 const host=id('v4GarageSummary');clear(host);
 let names=[];
 try{const state=JSON.parse(localStorage.getItem('rawest-signal-garage-beta-v1')||'null');names=(state?.builds||[]).map(x=>x?.fields?.name).filter(Boolean).slice(0,25);}catch(e){}
 host.append(node('p','v4-garage-count',names.length?names.length+' saved build'+(names.length===1?'':'s')+' on this device':'No saved builds on this device yet.'));
 if(names.length){const tags=node('div','v4-garage-tags');names.forEach(name=>tags.append(node('span','',String(name).slice(0,70))));host.append(tags);}
}
id('v4OpenGarage').addEventListener('click',()=>{openOriginalTab('ai');id('aiGarageBeta')?.scrollIntoView?.({behavior:'smooth',block:'start'});});
function drawComparison(){
 const area=id('v4Compare');clear(area);
 const base=engine.readBaseline?.();if(!base){area.append(node('p','v4-muted','No baseline saved yet. Choose a log you trust and save it first.'));return;}
 area.append(node('p','v4-muted','Baseline: '+String(base.label||'Saved log').slice(0,100)+' · '+(base.samples||0)+' qualified samples.'));
 try{
  const snap=engine.snapshot?.(log,review,filename);
  if(!snap||snap.error){area.append(node('p','v4-warning',snap?.error||'Snapshot not available.'));return;}
  const cmp=engine.compareSnapshots?.(base,snap),insight=core.compareInsight(cmp);
  area.append(node('p','v4-comparison-status',insight.text));
  if(!cmp?.rows?.length||!cmp.comparable)return;
  const table=node('table','v4-table');
  const tr=node('tr');['RPM region','Before error','After error','Direction','Samples'].forEach(x=>tr.append(node('th','',x)));table.append(tr);
  cmp.rows.slice(0,10).forEach(x=>{const row=node('tr');[
   x.rpm+'–'+(x.rpm+499),fmt(x.before,2)+'%',fmt(x.after,2)+'%',Math.abs(x.delta)<.25?'About the same':x.delta<0?'Closer':'Farther',x.beforeN+' / '+x.afterN
  ].forEach(v=>row.append(node('td','',v)));table.append(row);});area.append(table);
 }catch(err){area.append(node('p','v4-warning','Comparison unavailable: '+err.message));}
}
id('v4SaveBase').addEventListener('click',()=>{
 const snap=engine.snapshot?.(log,review,filename);
 if(!snap||snap.error){id('v4Compare').textContent=snap?.error||'Snapshot unavailable';return;}
 if(!Object.keys(snap.bins||{}).length){id('v4Compare').textContent='No qualified RPM/load bins yet. Log steady, valid, paired lambda samples before saving a comparison baseline.';return;}
 if(!engine.saveBaseline?.(snap)){id('v4Compare').textContent='Browser storage is unavailable. Baseline could not be saved.';return;}
 drawComparison();
});
id('v4ClearBase').addEventListener('click',()=>{engine.clearBaseline?.();drawComparison();});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function reportMarkup(fullDocument=false){
 const issues=core.selectEvents(review,15);
 const q=Array.isArray(review.quality)?review.quality:[];
 const caution=Array.isArray(review.gates)?review.gates:[];
 const title=esc(filename||'Imported log');
 const body='<header><div class="report-kicker">RAWEST PERFORMANCE / SIGNAL 4.0</div><h1>LOG REVIEW <span>REPORT</span></h1><p>'+title+' · '+(log?.rpm?.length||0)+' recorded samples · '+esc(new Date().toLocaleString())+'</p></header>'+
 '<section><h2>The big picture</h2><p>'+esc(getQuality())+'</p><p><b>'+issues.length+' highlighted event(s)</b> (first 15, sorted by priority). '+(review?.time?.verified?'Engine runtime verified.':'Elapsed time unavailable or unverified.')+'</p></section>'+
 '<section><h2>Moments to inspect</h2>'+(issues.map(e=>'<article><b>'+esc(core.eventLabel(e))+'</b><span>'+esc(e.priority||'REVIEW')+' · rows '+(e.a+1)+'–'+(e.b+1)+'</span><p>'+esc(core.eventSummary(e))+'</p></article>').join('')||'<p>No flagged events identified in available channels; this does not prove everything is healthy.</p>')+'</section>'+
 '<section><h2>Channel coverage</h2>'+(q.map(x=>'<p><b>'+esc(x.key)+'</b> · '+esc(x.status)+' · '+esc(x.note)+'</p>').join('')||'<p>No channel review available.</p>')+'</section>'+
 '<section><h2>Cautions and next checks</h2>'+(caution.map(x=>'<p>• '+esc(x)+'</p>').join('')||'<p>There are no specific quality gates in this report. Missing signals may still prevent a meaningful diagnosis.</p>')+
 (review.next||[]).slice(0,8).map(x=>'<p>Next: '+esc(x)+'</p>').join('')+'</section>'+
 '<footer>Local, read-only screening. Neither the presence nor absence of flags certifies a tune, engine, or vehicle safe. No ECU changes or automatic calibration prescriptions.</footer>';
 if(!fullDocument)return body;
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RAWEST SIGNAL 4.0 — '+title+'</title><style>'+
 'body{font-family:Arial,sans-serif;max-width:860px;margin:28px auto;padding:20px;color:#121124;line-height:1.5}header{background:#180f34;color:#fff;padding:30px;border-radius:18px}h1{font-size:34px;letter-spacing:-1px}h1 span{color:#bca4ff}.report-kicker{letter-spacing:.12em;color:#d2bcff;font-size:11px}section{margin:22px 0;padding:18px;border:1px solid #e2dfea;border-radius:14px}h2{font-size:19px}article{padding:14px 0;border-bottom:1px solid #ddd}article b{display:block}article span{font-size:12px;color:#555}footer{padding:20px;font-size:12px;color:#555}@media print{body{margin:0;padding:0}section{break-inside:avoid}}'+
 '</style></head><body>'+body+'</body></html>';
}
function drawReport(){
 const content=reportMarkup(false);id('v4ReportPreview').innerHTML=content;id('v4Printable').innerHTML=content;
}
function doPrint(){goTab('report');window.print();}
id('v4Print').addEventListener('click',doPrint);id('v4PrintAgain').addEventListener('click',doPrint);
id('v4Download').addEventListener('click',()=>{
 const blob=new Blob([reportMarkup(true)],{type:'text/html;charset=utf-8'}),u=URL.createObjectURL(blob),a=node('a');
 a.href=u;a.download='rawest-signal-4-report.html';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);
});
function show(logData,h,file){
 log=logData;health=h;filename=String(file||'Imported log').slice(0,160);
 if(!log||!Array.isArray(log.rpm))return;
 try{review=engine.analyze(log,{pressureUnit:'auto'});}catch(e){review={error:e.message,events:[],quality:[],gates:['Analysis unavailable: '+e.message]};}
 if(!review||review.error){wrapper.hidden=false;id('v4Source').textContent='Review unavailable: '+(review?.error||'Unknown parsing error');return;}
 wrapper.hidden=false;drawStatus();drawTimeline();drawSensors();drawGarage();drawComparison();drawReport();goTab('moments');
}
function clearAll(){wrapper.hidden=true;log=null;review=null;active=null;diagnosis=null;clear(id('v4Events'));clear(id('v4Traces'));}
const original=window.RawestSignalExperience.showResults,originalClear=window.RawestSignalExperience.clearResults;
window.RawestSignalExperience.showResults=function(d,h,f){
 original.apply(this,arguments);
 try{show(d,h,f);}catch(e){console.warn('SIGNAL v4 guided workspace unavailable',e);wrapper.hidden=true;}
};
window.RawestSignalExperience.clearResults=function(){originalClear.apply(this,arguments);clearAll();};
const tour=document.createElement('details');tour.className='v4-onboarding';tour.id='v4Onboarding';
tour.innerHTML='<summary><span>NEW HERE?</span> Your first log, explained in 60 seconds <b>＋</b></summary><div class="v4-onboarding-inner"><h3>Start with what you have.</h3><div class="v4-onboard-steps"><div><b>01</b><strong>Export a real log</strong><p>In your ECU software, save a recorded idle session or drive as a log file.</p></div><div><b>02</b><strong>Drop it into SIGNAL</strong><p>We read the file on your device and explain the measurements and limitations.</p></div><div><b>03</b><strong>Inspect, then verify</strong><p>Tap a flagged moment, see its recorded numbers, and check questionable sensors with your actual ECU setup.</p></div></div><p class="v4-muted">Illustrative instructions only: no example values are treated as real engine data. Need help? Open Sensors after importing.</p><button type="button" class="signal-action primary" id="v4TourUpload">Choose a log ↗</button></div>';
const launch=id('signalLaunchpad');if(launch)launch.insertAdjacentElement('afterend',tour);
id('v4TourUpload')?.addEventListener('click',()=>id('fileInput')?.click());
id('v4GuideStart').addEventListener('click',()=>{tour.open=true;id('v4Onboarding').scrollIntoView?.({behavior:'smooth',block:'start'});});
window.RawestSignalV4={show,clear:clearAll,version:'4.0.0'};
})();
