/* RAWEST SIGNAL Intelligence v2.6.0
   Deterministic, local-only diagnostics. Nothing writes an ECU calibration.
   A signal is never called "correcting" merely because a throttle moves. */
(function(root){
'use strict';
const numeric=v=>v===null||v===undefined||v===''?NaN:Number(v);
const ok=Number.isFinite;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2;};
const format=(v,d=1)=>ok(v)?Number(v).toFixed(d):'—';
const spec={
 map:{id:'20',names:['MAP','Manifold absolute pressure','Manifold pressure']},
 correction:{id:'102',names:['Lambda corr A','Lambda correction A','Closed loop lambda correction','Closed-loop lambda correction']},
 correctionState:{id:'670',names:['Lambda corr state','Lambda correction state']},
 acceleration:{id:'106',names:['Acc enrichment','Acceleration enrichment','Accel enrichment']},
 accelerationCorrection:{id:'928',names:['Acceleration correction']},
 fuelCut:{id:'100',names:['Fuel cut','Decel fuel cut','Deceleration fuel cut']},
 fuelCutReason:{id:'584',names:['Fuel cut reason']},
 knockCorrection:{id:'479',names:['Knock correction']},
 pressure:{id:'499',names:['Primary fuel pressure']},
 sampleTime:{id:'69',names:['Engine runtime']}
};
function normalized(s){return String(s||'').replace(/\[\d+\]\s*$/,'').trim().toLowerCase().replace(/[\s_\-]+/g,' ');}
function resolve(d,name){
 const headers=d.headers||[],def=spec[name];if(!def)return {index:-1,name:'not recognized'};
 const matches=[];
 for(let i=0;i<headers.length;i++){
  const h=String(headers[i]),idMatch=h.match(/\[(\d+)\]\s*$/);
  if(d.sourceFormat!=='holley'&&idMatch&&idMatch[1]===def.id)matches.push({index:i,name:h,method:'MaxxECU ID'});
 }
 if(matches.length===1)return matches[0];if(matches.length>1)return {index:-1,name:'ambiguous ID'};
 const accepted=def.names.map(normalized);
 for(let i=0;i<headers.length;i++)if(accepted.includes(normalized(headers[i])))matches.push({index:i,name:headers[i],method:'exact alias'});
 return matches.length===1?matches[0]:{index:-1,name:matches.length?'ambiguous alias':'not logged'};
}
function read(d,entry){
 if(entry.index<0||!Array.isArray(d.rows))return [];
 return d.rows.map(row=>numeric(row[entry.index]));
}
function timebase(d){
 const r=resolve(d,'sampleTime');
 if(d.sourceFormat==='holley'||r.index<0||!Array.isArray(d.runtime)||d.runtime.length<3)return {verified:false,why:'No verified seconds timebase; sample counts are not durations'};
 const t=d.runtime,steps=[];
 for(let i=1;i<t.length;i++){
  if(!ok(t[i])||!ok(t[i-1])||t[i]<t[i-1]-0.00001)return {verified:false,why:'Runtime resets or contains invalid values'};
  const step=t[i]-t[i-1];if(step>0.00001)steps.push(step);
 }
 const quantum=median(steps);
 if(!ok(quantum)||quantum<=0||quantum>5)return {verified:false,why:'Could not validate runtime clock increments'};
 return {verified:true,quantum,why:'MaxxECU Engine runtime [69], seconds (quantized)'};
}
function analyze(d,options){
 options=options||{};
 if(!d||!Array.isArray(d.rpm))return {error:'Load an ECU log before opening Signal Intelligence.'};
 const n=d.rpm.length,entries={};
 for(const name of Object.keys(spec))entries[name]=resolve(d,name);
 const signals={};
 for(const name of Object.keys(entries))signals[name]=read(d,entries[name]);
 const correctionValues=(signals.correction||[]).filter(ok);
 const correctionObservedEdge=correctionValues.length>=25?Math.max(...correctionValues.map(Math.abs)):NaN;
 const get=(k,i)=>{const a=signals[k];return Array.isArray(a)&&i>=0&&i<a.length?a[i]:NaN;};
 const dv=(k,i)=>{const a=d[k];return Array.isArray(a)&&i>=0&&i<a.length?a[i]:NaN;};
 const time=timebase(d);
 const unitHeader=d.sourceColumns&&d.sourceColumns.fuelPress>=0?d.headers[d.sourceColumns.fuelPress]:'';
 let pressureUnit=(options.pressureUnit||'auto').toLowerCase();
 if(pressureUnit==='auto'){
  const fromName=String(unitHeader||'').match(/[\[(](kpa|bar|psi)[\])]/i);
  pressureUnit=fromName?fromName[1].toLowerCase():'unknown';
 }
 const pressureFactor=pressureUnit==='kpa'?.1450377377:pressureUnit==='bar'?14.5037738:pressureUnit==='psi'?1:null;
 const pressures=(d.fuelPress||[]).filter((v,i)=>ok(v)&&dv('rpm',i)>800&&dv('tps',i)>=15&&v>0);
 const pressureBaseline=pressures.length>=25?median(pressures):NaN;
 const pressureAt=i=>dv('fuelPress',i);
 const timeSpan=(a,b)=>time.verified&&ok(dv('runtime',a))&&ok(dv('runtime',b))
  ?Math.max(0,dv('runtime',b)-dv('runtime',a))+time.quantum:NaN;
 const validLambda=i=>ok(dv('lambda',i))&&ok(dv('targetLambda',i))&&dv('lambda',i)>.5&&dv('lambda',i)<1.5&&dv('targetLambda',i)>.5&&dv('targetLambda',i)<1.5;
 const deviation=i=>validLambda(i)?dv('lambda',i)/dv('targetLambda',i)-1:NaN;
 const eligible=i=>dv('rpm',i)>800&&dv('tps',i)>=15;
 const events=[];
 function windowStats(a,b){
  const lo=Math.max(0,a-5),hi=Math.min(n-1,b+5),tps=[],maps=[];
  for(let j=lo;j<=hi;j++){if(ok(dv('tps',j)))tps.push(dv('tps',j));if(ok(get('map',j)))maps.push(get('map',j));}
  const swing=x=>x.length?Math.max(...x)-Math.min(...x):NaN;
  return {tpsSwing:swing(tps),mapSwing:swing(maps)};
 }
 function recoveryIndex(end){
  for(let k=end+1;k<=Math.min(n-1,end+20);k++){
   if(!eligible(k))break;
   if(time.verified&&dv('runtime',k)-dv('runtime',end)>1)break;
   if(ok(deviation(k))&&Math.abs(deviation(k))<=.05)return k;
  }
  return -1;
 }
 function emit(kind,a,b){
  const count=b-a+1;if(count<3)return;
  const center=Math.floor((a+b)/2),duration=timeSpan(a,b),stats=windowStats(a,b);
  const transient=(ok(stats.tpsSwing)&&stats.tpsSwing>=8)||(ok(stats.mapSwing)&&stats.mapSwing>=15);
  const recovered=recoveryIndex(b)>=0;
  const fuelCut=Array.from({length:count},(_,j)=>get('fuelCut',a+j)).some(v=>ok(v)&&v>0);
  const enrich=Array.from({length:count},(_,j)=>get('acceleration',a+j)).some(v=>ok(v)&&v>0);
  const correcting=Array.from({length:count},(_,j)=>get('correction',a+j)).some(v=>ok(v)&&Math.abs(v)>0.01);
  const correctionState=Array.from({length:count},(_,j)=>get('correctionState',a+j)).some(v=>ok(v)&&v!==0);
  const edgeReadings=Array.from({length:count},(_,j)=>get('correction',a+j)).filter(v=>ok(v)&&ok(correctionObservedEdge)&&correctionObservedEdge>=3&&Math.abs(v)>=correctionObservedEdge-.15);
  const possibleCorrectionLimit=edgeReadings.length>=Math.max(3,Math.ceil(count*.25));
  const samples=[];
  for(let j=a;j<=b;j++)if(ok(deviation(j)))samples.push(deviation(j));
  const peakError=samples.length?Math.max(...samples.map(Math.abs))*100:NaN;
  const rpm=dv('rpm',center),tps=dv('tps',center),map=get('map',center);
  const stable=time.verified&&duration>=1&&ok(stats.tpsSwing)&&stats.tpsSwing<5&&(!ok(stats.mapSwing)||stats.mapSwing<10);
  const highLoad=(ok(tps)&&tps>=65)||(ok(map)&&map>=120);
  let context='DURATION/LOAD UNVERIFIED';
  if(kind==='KNOCK' || kind==='ECU WARNING')context='Verify channel meaning and investigate protection';
  else if(fuelCut)context='FUEL CUT FLAG ACTIVE — mixture may not represent normal combustion';
  else if(possibleCorrectionLimit&&ok(duration)&&duration>=.7)context='POSSIBLE CORRECTION LIMIT — sustained deviation near observed trim endpoint; verify configured limits';
  else if(stable)context='STEADY-LOAD DEVIATION — inspect closed-loop and calibration context';
  else if(transient&&recovered&&ok(duration)&&duration>=1)context='PROLONGED TRANSIENT + RECOVERY — verify enrichment and correction response';
  else if(transient&&recovered)context='TRANSIENT + RECOVERY — possible normal ECU response, verify corrections';
  else if(transient)context='THROTTLE/LOAD TRANSITION — recovery and correction need review';
  else if(recovered)context='RETURNED TO TARGET — verify time and control state';
  if(enrich)context+='; acceleration enrichment channel active';
  if(correctionState)context+='; lambda correction state nonzero';
  if(correcting)context+='; lambda correction A changed from zero (unit unverified)';
  let score=kind==='KNOCK'||kind==='ECU WARNING'?85:kind==='LEAN'?42:20;
  score+=Math.min(24,ok(peakError)?peakError*.8:0);
  if(highLoad)score+=22;
  if(stable)score+=15;
  if(kind==='LEAN'&&transient&&!recovered)score+=8;
  if(possibleCorrectionLimit&&!fuelCut)score+=20;
  if(possibleCorrectionLimit&&ok(duration)&&duration>=1)score+=10;
  if(fuelCut)score-=30;
  if(transient&&recovered&&!highLoad&&!possibleCorrectionLimit)score-=18;
  if(kind==='RICH'&&transient&&recovered&&!possibleCorrectionLimit)score-=8;
  score=Math.max(0,Math.min(100,Math.round(score)));
  const priority=score>=75?'HIGH':score>=45?'REVIEW':'CONTEXT';
  const confidence=time.verified&&entries.map.index>=0&&validLambda(center)?'medium':'limited';
  events.push({kind,a,b,count,duration,rpm,tps,map,lambda:dv('lambda',center),target:dv('targetLambda',center),
   pressure:pressureAt(center),peakError,transient,recovered,fuelCut,enrich,correcting,correctionState,
   context,score,priority,confidence,highLoad,possibleCorrectionLimit,correctionObservedEdge});
 }
 const masks=[
  {kind:'LEAN',test:i=>eligible(i)&&ok(deviation(i))&&deviation(i)>.10},
  {kind:'RICH',test:i=>eligible(i)&&ok(deviation(i))&&deviation(i)<-.10},
  {kind:'KNOCK',test:i=>dv('rpm',i)>800&&dv('knock',i)>0},
  {kind:'ECU WARNING',test:i=>dv('rpm',i)>800&&dv('warnings',i)>0}
 ];
 for(const m of masks){
  let start=-1;
  for(let i=0;i<=n;i++){
   const yes=i<n&&m.test(i);
   if(yes&&start<0)start=i;
   if(!yes&&start>=0){emit(m.kind,start,i-1);start=-1;}
  }
 }
 // Relative pressure anomaly only. Differential-vs-absolute reference is unknown.
 if(ok(pressureBaseline)&&pressureBaseline>0&&Array.isArray(d.fuelPress)){
  let a=-1;
  for(let i=0;i<=n;i++){
   const press=i<n?pressureAt(i):NaN;
   const yes=i<n&&ok(press)&&press>0&&press<pressureBaseline*.8&&dv('rpm',i)>=1500&&dv('tps',i)>=30&&!(ok(get('fuelCut',i))&&get('fuelCut',i)>0);
   if(yes&&a<0)a=i;
   if(!yes&&a>=0){
    if(i-a>=3){
     const b=i-1,c=Math.floor((a+b)/2),ratio=pressureAt(c)/pressureBaseline;
     const score=Math.round(Math.min(100,75+Math.max(0,(.8-ratio)*45)));
     events.push({kind:'PRESSURE DIP',a,b,count:i-a,duration:timeSpan(a,b),rpm:dv('rpm',c),tps:dv('tps',c),
      map:get('map',c),pressure:pressureAt(c),peakError:NaN,score,priority:'HIGH',confidence:'limited',
      context:'Fuel pressure below 80% of the log running median ('+format(pressureBaseline)+ ' raw). Check engine/load state, sensor, units and manifold-referenced regulator before judging pump health.'});
    }
    a=-1;
   }
  }
 }
 events.sort((a,b)=>b.score-a.score||b.count-a.count||a.a-b.a);
 const quality=[
  {key:'Wideband',status:d.lambda?.some(ok)&&d.targetLambda?.some(ok)?'present':'missing',note:'Actual + target lambda'},
  {key:'RPM / TPS',status:d.rpm?.some(ok)&&d.tps?.some(ok)?'present':'missing',note:'Operating condition'},
  {key:'MAP / load',status:entries.map.index>=0?'present':'missing',note:entries.map.name},
  {key:'Timebase',status:time.verified?'present':'unverified',note:time.why},
  {key:'Lambda correction',status:entries.correction.index>=0?'present':'missing',note:entries.correction.name},
  {key:'Correction state',status:entries.correctionState.index>=0?'present':'missing',note:entries.correctionState.name},
  {key:'Acceleration enrichment',status:entries.acceleration.index>=0?'present':'missing',note:entries.acceleration.name},
  {key:'Fuel cut',status:entries.fuelCut.index>=0?'present':'missing',note:entries.fuelCut.name},
  {key:'Fuel pressure units',status:pressureFactor!==null?(options.pressureUnit&&options.pressureUnit!=='auto'?'user-selected':'header-labeled'):'unverified',note:pressureFactor!==null?pressureUnit:'Select original unit above; sensor calibration still needs checking'},
  {key:'Knock indicator',status:d.knock?.some(ok)?'present':'missing',note:'Raw indicator; verify meaning'}
 ];
 const next=[];
 if(!time.verified)next.push('Log a channel with verified elapsed seconds (MaxxECU Engine runtime).');
 if(entries.correction.index<0)next.push('Log Lambda corr A and Lambda corr state, or map their equivalents.');
 if(entries.acceleration.index<0)next.push('Log Acc enrichment to distinguish acceleration fueling.');
 if(entries.fuelCut.index<0)next.push('Log Fuel cut to distinguish overrun and cut events.');
 if(entries.map.index<0)next.push('Log MAP / manifold load alongside TPS and RPM.');
 if(pressureFactor===null)next.push('Verify the fuel-pressure channel unit in MTune before interpreting PSI.');
 if(!d.knock?.some(ok))next.push('Log a verified knock-detection or correction channel.');
 if(events.some(e=>e.kind==='LEAN'&&e.highLoad))next.push('Review high-load lean episodes, correction limits and pressure response before more loaded testing.');
 if(events.some(e=>e.possibleCorrectionLimit))next.push('Check configured MaxxECU lambda-correction limits and when closed-loop correction is enabled. Observed trim endpoints are not proof of a configured clamp.');
 if(!next.length)next.push('Repeat a comparable warmed-up steady-state log; compare correction behavior at matched RPM and MAP.');
 return {version:'2.6.0',n,source:d.sourceFormat==='holley'?'Holley CSV':'MaxxECU log',time,quality,entries,signals,
  pressureUnit,pressureFactor,pressureBaseline,events,next,high:events.filter(e=>e.priority==='HIGH').length,
  limitation:'Screening tool, not a calibration decision. Sample runs, ECU state flags, and pressure anomalies require sensor, unit and load verification.'};
}
// Before/after comparison uses matched RPM+MAP cells and records sample coverage.
// It intentionally does not compare entire-drive means or claim that a tune change caused an improvement.
const BASELINE_KEY='rawest-signal-baseline-2026';
function fingerprint(d){
 const a=d.rpm||[],t=d.runtime||[];
 return [a.length,a[0],a[a.length-1],t[0],t[t.length-1]].join('|');
}
function snapshot(d,result,label){
 const rpm=d.rpm||[],tps=d.tps||[],lambda=d.lambda||[],target=d.targetLambda||[];
 const maps=result.signals.map||[],cuts=result.signals.fuelCut||[],enrich=result.signals.acceleration||[];
 if(!maps.length)return {error:'MAP is missing. Matched RPM/load comparisons require a verified MAP channel.'};
 const buckets=new Map(),es=(d.ethanol||[]).filter(Number.isFinite);
 for(let i=2;i<rpm.length-2;i++){
  if(![rpm[i],tps[i],lambda[i],target[i],maps[i]].every(ok)||rpm[i]<800||tps[i]<15||lambda[i]<=.5||lambda[i]>=1.5||target[i]<=.5||target[i]>=1.5)continue;
  if(Math.abs((tps[i+2]??tps[i])-(tps[i-2]??tps[i]))>=5)continue;
  if(ok(maps[i+2])&&ok(maps[i-2])&&Math.abs(maps[i+2]-maps[i-2])>=10)continue;
  if(ok(cuts[i])&&cuts[i]>0)continue;
  if(ok(enrich[i])&&enrich[i]>0)continue;
  const r=Math.floor(rpm[i]/500)*500,m=Math.floor(maps[i]/20)*20;
  const key=r+'|'+m,b=buckets.get(key)||{rpm:r,map:m,count:0,sum:0};
  b.count++;b.sum+=(lambda[i]/target[i]-1)*100;buckets.set(key,b);
 }
 const bins={};for(const [key,b] of buckets)if(b.count>=15)bins[key]={rpm:b.rpm,map:b.map,count:b.count,error:b.sum/b.count};
 return {label:String(label||'Baseline log'),fingerprint:fingerprint(d),savedAt:new Date().toISOString(),ethanol:median(es),bins,
  samples:Object.values(bins).reduce((a,b)=>a+b.count,0)};
}
function compareSnapshots(base,current){
 if(base.error||current.error)return {error:base.error||current.error};
 if(base.fingerprint===current.fingerprint)return {error:'This appears to be the same log. Load the follow-up log for comparison.'};
 const ethanolGap=ok(base.ethanol)&&ok(current.ethanol)?Math.abs(base.ethanol-current.ethanol):NaN;
 const rows=[];
 for(const [key,b] of Object.entries(base.bins||{})){
  const a=current.bins[key];if(!a)continue;
  rows.push({rpm:b.rpm,map:b.map,before:b.error,after:a.error,delta:Math.abs(a.error)-Math.abs(b.error),beforeN:b.count,afterN:a.count});
 }
 rows.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 return {rows,ethanolGap,comparable:rows.length>0&&(!ok(ethanolGap)||ethanolGap<=10),
  note:'Descriptive matched-bin comparison only; fuel trims, temperature, correction state, and drive conditions may differ. No table change is implied.'};
}
function readBaseline(){
 try{const stored=JSON.parse(localStorage.getItem(BASELINE_KEY)||'null');return stored&&stored.bins?stored:null;}catch(e){return null;}
}
function saveBaseline(base){
 try{localStorage.setItem(BASELINE_KEY,JSON.stringify(base));return true;}catch(e){return false;}
}
function clearBaseline(){try{localStorage.removeItem(BASELINE_KEY);}catch(e){}}
function renderComparison(area,d,result){
 const panel=element('details');panel.style.cssText='margin:20px 0;padding:12px;border:1px solid var(--line);border-radius:12px';
 panel.append(element('summary','BEFORE / AFTER · compare matched RPM + MAP'));
 const desc=element('p','Save the current log as your baseline, then import the follow-up log. Only overlapping steady-ish RPM/MAP bins with at least 15 samples on EACH log are compared. Baseline stays in this browser until cleared.');
 desc.style.fontSize='12px';panel.append(desc);
 const controls=element('div');controls.style.cssText='display:flex;gap:8px;flex-wrap:wrap';
 const set=element('button','Use this log as baseline','ps-btn');set.type='button';
 const clear=element('button','Clear baseline','ps-btn secondary');clear.type='button';
 controls.append(set,clear);panel.append(controls);
 const status=element('p');panel.append(status);
 const output=element('div');output.style.cssText='overflow:auto';panel.append(output);
 const current=snapshot(d,result,typeof lastFilename!=='undefined'?lastFilename:'Current log');
 const draw=()=>{
  output.replaceChildren();const baseline=readBaseline();
  if(!baseline){status.textContent='No baseline saved yet.';return;}
  status.textContent='Baseline saved '+new Date(baseline.savedAt).toLocaleString()+' · '+baseline.samples+' valid comparison samples in '+Object.keys(baseline.bins).length+' bins.';
  const comparison=compareSnapshots(baseline,current);
  if(comparison.error){output.append(element('p',comparison.error));return;}
  if(!comparison.comparable){
   output.append(element('p',comparison.rows.length===0?'No matched bins with enough steady samples on BOTH logs. Log comparable RPM and MAP conditions.':'Ethanol differs by '+format(comparison.ethanolGap)+' percentage points. Fueling comparison is confounded; do not interpret changes as calibration improvement.'));
   return;
  }
  const note=element('p','Matched load areas: '+comparison.rows.length+' · '+(ok(comparison.ethanolGap)?'ethanol difference '+format(comparison.ethanolGap)+' percentage points · ':'')+comparison.note);
  note.style.fontSize='12px';output.append(note);
  const table=element('table');table.style.cssText='width:100%;font-size:12px;border-collapse:collapse';
  const head=element('tr');
  for(const label of ['RPM bin','MAP bin','Before error','After error','Shift toward target','Sample coverage']){
   const th=element('th',label);th.style.cssText='padding:6px;text-align:left;border-bottom:1px solid var(--line)';head.append(th);
  }
  table.append(head);
  for(const b of comparison.rows.slice(0,15)){
   const tr=element('tr');
   const vals=[b.rpm+'–'+(b.rpm+499),b.map+'–'+(b.map+19)+' kPa',
    format(b.before,2)+'%',format(b.after,2)+'%',(b.delta<0?'closer ':'farther ')+format(Math.abs(b.delta),2)+' pp',
    b.beforeN+' / '+b.afterN];
   for(const v of vals){const td=element('td',v);td.style.cssText='padding:6px;border-bottom:1px solid var(--line)';tr.append(td);}
   table.append(tr);
  }
  output.append(table);
 };
 set.onclick=()=>{
  if(current.error){status.textContent=current.error;return;}
  if(!Object.keys(current.bins).length){status.textContent='No comparable steady-state bins with enough samples. Capture a suitable log first.';return;}
  if(!saveBaseline(current)){status.textContent='Could not save the baseline in this browser (storage may be unavailable).';return;}
  draw();
 };
 clear.onclick=()=>{clearBaseline();draw();};
 draw();area.append(panel);
}
function element(tag,text,cls){
 const n=document.createElement(tag);
 if(text!==undefined&&text!==null)n.textContent=String(text);
 if(cls)n.className=cls;
 return n;
}
function render(host,d,opts){
 if(!host)return;
 const result=analyze(d,opts),area=element('section');
 area.className='signal-intelligence';
 area.style.cssText='margin:24px 0;padding:18px;border:1px solid var(--line);border-radius:16px;background:var(--panel2);color:var(--text)';
 const title=element('h3','SIGNAL INTELLIGENCE · v2.6.0');
 title.style.margin='0 0 6px';area.append(title);
 if(result.error){area.append(element('p',result.error));host.append(area);return;}
 area.append(element('p',result.source+' · '+result.n.toLocaleString()+' rows · '+result.events.length+' multi-sample events · '+result.high+' higher-priority findings. Nothing here changes ECU settings.'));
 const metrics=element('div');metrics.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
 for(const item of result.quality){
  const c=element('span',item.key+': '+item.status);
  c.title=item.note;c.style.cssText='padding:6px 9px;border:1px solid var(--line);border-radius:9px;font-size:12px;'+(item.status==='missing'||item.status==='unverified'?'opacity:.65':'');
  metrics.append(c);
 }
 area.append(metrics);
 const paragraph=element('p','Prioritized by relative severity, observed load, persistence and control context—not simply sample count. An ECU correction channel being nonzero does not prove the mixture was safely corrected.');
 paragraph.style.cssText='font-size:12px;opacity:.85';area.append(paragraph);
 const controls=element('div');controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:12px 0';
 const filter=element('select');filter.setAttribute('aria-label','Filter diagnostic findings');
 for(const [value,label] of [['all','All events'],['HIGH','Higher priority'],['LEAN','Lean'],['RICH','Rich'],['PRESSURE DIP','Fuel pressure'],['KNOCK','Knock'],['ECU WARNING','ECU warnings'],['transient','Throttle/load transitions'],['steady','Steady-load']]){
  const o=element('option',label);o.value=value;filter.append(o);
 }
 controls.append(filter);
 const exportButton=element('button','Export findings CSV','ps-btn secondary');
 exportButton.type='button';controls.append(exportButton);
 area.append(controls);
 renderComparison(area,d,result);
 const list=element('div');area.append(list);
 const detail=element('div');detail.style.cssText='margin:15px 0 0';area.append(detail);
 function selectEvent(e){
  detail.replaceChildren();
  const h=element('h4','EVENT INSPECTOR — rows '+(e.a+1)+'–'+(e.b+1));detail.append(h);
  if(e.possibleCorrectionLimit)detail.append(element('p','Correction signal repeatedly approached the observed absolute extreme ('+format(e.correctionObservedEdge,1)+' raw). Verify the actual correction limit and sign convention in MTune; this alone is not proof the ECU is maxed out.'));
  const facts=element('p',e.context+' | '+e.count+' samples'+(ok(e.duration)?' | approximately '+format(e.duration,2)+' seconds':' | duration unverified')+' | '+e.confidence+' confidence');
  facts.style.cssText='line-height:1.6;font-size:13px';detail.append(facts);
  const table=element('table');table.style.cssText='width:100%;font-size:11px;display:block;overflow:auto;border-collapse:collapse';
  const columns=['Row','RPM','TPS %','MAP','AFR actual','AFR target','Fuel pressure','Lambda corr A','Acc enrich','Fuel cut'];
  const th=element('tr');for(const k of columns){const cell=element('th',k);cell.style.cssText='padding:6px;text-align:left;border-bottom:1px solid var(--line)';th.append(cell);}table.append(th);
  const lo=Math.max(0,e.a-5),hi=Math.min(result.n-1,e.b+5),stride=Math.max(1,Math.ceil((hi-lo+1)/35));
  for(let i=lo;i<=hi;i+=stride){
   const g=k=>Array.isArray(d[k])?d[k][i]:NaN,s=k=>result.signals[k]?.[i];
   const vals=[i+1,format(g('rpm'),0),format(g('tps')),format(s('map')),format(g('lambda')*14.7,2),format(g('targetLambda')*14.7,2),
    ok(g('fuelPress'))?format(g('fuelPress')*(result.pressureFactor||1))+(result.pressureFactor!==null?' psi':' raw'):'—',
    format(s('correction')),format(s('acceleration')),format(s('fuelCut'),0)];
   const tr=element('tr');if(i>=e.a&&i<=e.b)tr.style.background='rgba(255,180,70,.09)';
   for(const v of vals){const td=element('td',v);td.style.cssText='padding:5px;border-bottom:1px solid var(--line)';tr.append(td);}table.append(tr);
  }
  detail.append(table);
  detail.append(element('p','Rows shown around the event (subsampled when necessary). AFR is gasoline-equivalent. MAP and control-channel units must be verified against the ECU setup.'));
 }
 function draw(){
  list.replaceChildren();detail.replaceChildren();
  const v=filter.value;
  const events=result.events.filter(e=>v==='all'||v===e.priority||v===e.kind||(v==='transient'&&e.transient)||(v==='steady'&&e.context?.startsWith('STEADY-LOAD')));
  const shown=events.slice(0,25);
  list.append(element('p',events.length+' matching events · showing '+shown.length));
  if(!shown.length)list.append(element('p','No events match this filter. That is not proof the engine is safe.'));
  for(const e of shown){
   const b=element('button');b.type='button';b.style.cssText='display:block;width:100%;text-align:left;margin:7px 0;padding:12px;border-radius:11px;border:1px solid var(--line);background:var(--panel);color:var(--text);cursor:pointer';
   const head=element('strong',e.priority+' · '+e.kind+' · '+e.score+'/100 review score');
   b.append(head);
   const desc=[e.count+' rows',ok(e.duration)?'~'+format(e.duration,2)+'s':'time unverified',format(e.rpm,0)+' RPM',format(e.tps)+'% TPS',ok(e.peakError)?format(e.peakError)+'% peak AFR deviation':null].filter(Boolean).join(' · ');
   const sub=element('div',desc);sub.style.cssText='font-size:12px;margin:5px 0';b.append(sub);
   const why=element('div',e.context);why.style.cssText='font-size:12px;opacity:.8';b.append(why);
   b.onclick=()=>selectEvent(e);list.append(b);
  }
  if(shown.length)selectEvent(shown[0]);
 }
 filter.onchange=draw;
 exportButton.onclick=()=>{
  const columns=['kind','priority','score','first_row','last_row','samples','seconds_approx','rpm','tps','map','peak_error_pct','context'];
  const escape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const body=[columns.join(',')].concat(result.events.map(e=>[e.kind,e.priority,e.score,e.a+1,e.b+1,e.count,ok(e.duration)?format(e.duration,2):'',format(e.rpm),format(e.tps),format(e.map),format(e.peakError),e.context].map(escape).join(','))).join('\n');
  const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'})),a=element('a');a.href=url;a.download='rawest-signal-findings.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 draw();
 const coach=element('details');coach.style.marginTop='18px';const sum=element('summary','NEXT LOG COACH · '+result.next.length+' checks');coach.append(sum);
 const ul=element('ul');for(const item of result.next)ul.append(element('li',item));coach.append(ul);
 coach.append(element('p',result.limitation));area.append(coach);
 host.append(area);
}
root.RawestSignalIntelligence={analyze,render,version:'2.6.0'};
})(typeof window!=='undefined'?window:globalThis);
