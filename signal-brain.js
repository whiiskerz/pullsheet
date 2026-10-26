/* RAWEST SIGNAL v3.2.0 — Diagnostic Brain + Evidence Heatmaps
 * Deterministic on-device evidence review. Never writes tunes, recommends raw
 * VE/spark deltas, decodes undocumented control states or extrapolates tables.
 * Heatmaps are measured log occupancy, NOT verified active ECU table cells.
 */
(function(root){
'use strict';
const finite=Number.isFinite;
const val=(a,i)=>Array.isArray(a)&&i>=0&&i<a.length&&finite(a[i])?a[i]:NaN;
const fmt=(n,d=1)=>finite(n)?n.toFixed(d):'—';
const median=(a)=>{
 if(!a.length)return NaN;const s=[...a].sort((a,b)=>a-b);
 const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;
};
const MAP_PSI=0.14503773773020923;
const clean=s=>String(s||'').trim();
const isMaxxMap=(log,result)=>{
 const entry=result?.entries?.map;
 if(log?.sourceFormat==='holley'||entry?.method!=='MaxxECU ID'||!/^\s*MAP\s*\[20\]\s*$/i.test(clean(entry.name)))return false;
 return Number.isInteger(entry.index)&&entry.index>=0&&clean(log.headers?.[entry.index])===clean(entry.name);
};
const hasIndependentLambda=log=>{
 const actual=log?.sourceColumns?.lambda,target=log?.sourceColumns?.targetLambda;
 return Number.isInteger(actual)&&Number.isInteger(target)&&actual>=0&&target>=0&&actual!==target
  &&!!log.headers?.[actual]&&!!log.headers?.[target]
  &&!/target|command|desired|setpoint/i.test(log.headers[actual]);
};
function buildHeatmap(log,result,options={}){
 const rpmStep=[250,500,1000].includes(Number(options.rpmStep))?Number(options.rpmStep):500;
 const mapStep=[10,20,30].includes(Number(options.mapStep))?Number(options.mapStep):20;
 const minEvidence=8;
 if(!log||!Array.isArray(log.rpm)||!result)return {error:'Load a MaxxECU log to build the evidence heatmap.'};
 if(!isMaxxMap(log,result))return {error:'A verified standard MaxxECU MAP [20] channel is required. Holley and custom MAP units are not inferred.'};
 if(!hasIndependentLambda(log))return {error:'Measured lambda and target lambda must be independently mapped to different channels. Heatmap analysis is blocked.'};
 const mapValues=result.signals?.map||[],fuelCut=result.signals?.fuelCut||[],accel=result.signals?.acceleration||[];
 const n=log.rpm.length,stepMin=500,mapMin=10;
 let maxRpm=2000,maxMap=70,validMapSamples=0;
 for(let i=0;i<n;i++){
  const r=val(log.rpm,i),m=val(mapValues,i),t=val(log.tps,i);
  if(!finite(r)||!finite(m)||!finite(t)||r<800||r>10000||m<10||m>350||t<15)continue;
  maxRpm=Math.max(maxRpm,r);maxMap=Math.max(maxMap,m);validMapSamples++;
 }
 if(validMapSamples===0)return {error:'No usable operating samples with verified RPM, throttle and absolute MAP. Do not display invented map regions.'};
 const rpmUpper=Math.min(10500,Math.max(2500,Math.ceil((maxRpm+.001)/rpmStep)*rpmStep));
 const mapUpper=Math.min(360,Math.max(80,Math.ceil((maxMap+.001)/mapStep)*mapStep));
 const rpmBins=Math.ceil((rpmUpper-stepMin)/rpmStep),mapBins=Math.ceil((mapUpper-mapMin)/mapStep);
 const cells=Array.from({length:rpmBins*mapBins},(_,id)=>({
  id,ri:Math.floor(id/mapBins),mi:id%mapBins,observed:0,paired:0,eligible:0,sum:0,errors:[],
  lean:0,rich:0,peakLean:-Infinity,pressureMinPsi:Infinity,filtered:{fuelCut:0,enrichment:0,transition:0,lambda:0}
 }));
 const counts={operating:0,independentLambda:0,screened:0,excludedFuelCut:0,excludedEnrich:0,excludedTransition:0,excludedLambda:0,skippedOutside:0};
 const pressureFactor=result.pressureInfo?.factor??null;
 for(let i=0;i<n;i++){
  const r=val(log.rpm,i),m=val(mapValues,i),t=val(log.tps,i);
  if(!finite(r)||!finite(m)||!finite(t)||r<800||t<15||m<mapMin||m>=mapUpper||r<stepMin||r>=rpmUpper){
   if(finite(r)&&finite(m)&&r>=800&&t>=15)counts.skippedOutside++;
   continue;
  }
  const ri=Math.floor((r-stepMin)/rpmStep),mi=Math.floor((m-mapMin)/mapStep);
  if(ri<0||ri>=rpmBins||mi<0||mi>=mapBins)continue;
  const cell=cells[ri*mapBins+mi];cell.observed++;counts.operating++;
  const actual=val(log.lambda,i),target=val(log.targetLambda,i);
  if(!finite(actual)||!finite(target)||actual<=.5||actual>=1.5||target<=.5||target>=1.5){
   cell.filtered.lambda++;counts.excludedLambda++;continue;
  }
  cell.paired++;counts.independentLambda++;
  const cut=val(fuelCut,i);
  if(finite(cut)&&cut>0){cell.filtered.fuelCut++;counts.excludedFuelCut++;continue;}
  const enrich=val(accel,i);
  if(finite(enrich)&&enrich>0){cell.filtered.enrichment++;counts.excludedEnrich++;continue;}
  // Compare nearby samples, not just a single TPS derivative.
  // This screens observed transients; it never establishes true steady-state.
  const lo=Math.max(0,i-2),hi=Math.min(n-1,i+2);
  let tmin=Infinity,tmax=-Infinity,mmin=Infinity,mmax=-Infinity;
  for(let j=lo;j<=hi;j++){
   const tj=val(log.tps,j),mj=val(mapValues,j);
   if(finite(tj)){tmin=Math.min(tmin,tj);tmax=Math.max(tmax,tj);}
   if(finite(mj)){mmin=Math.min(mmin,mj);mmax=Math.max(mmax,mj);}
  }
  if(tmax-tmin>=5||mmax-mmin>=10){cell.filtered.transition++;counts.excludedTransition++;continue;}
  const error=(actual/target-1)*100;
  cell.eligible++;cell.sum+=error;cell.errors.push(error);
  counts.screened++;
  if(error>10){cell.lean++;cell.peakLean=Math.max(cell.peakLean,error);}
  if(error< -10)cell.rich++;
  const p=val(log.fuelPress,i);
  if(pressureFactor!==null&&finite(p)&&p>0)cell.pressureMinPsi=Math.min(cell.pressureMinPsi,p*pressureFactor);
 }
 let adequate=0;
 for(const c of cells){
  c.rpmFrom=stepMin+c.ri*rpmStep;c.rpmTo=c.rpmFrom+rpmStep;
  c.mapFrom=mapMin+c.mi*mapStep;c.mapTo=c.mapFrom+mapStep;
  c.mapPsiaFrom=c.mapFrom*MAP_PSI;c.mapPsiaTo=c.mapTo*MAP_PSI;
  c.meanError=c.eligible?c.sum/c.eligible:NaN;
  c.medianError=c.eligible?median(c.errors):NaN;
  c.visible=c.eligible>=minEvidence;
  c.maxLean=c.lean?c.peakLean:NaN;
  c.minPressurePsi=c.pressureMinPsi!==Infinity?c.pressureMinPsi:NaN;
  delete c.sum;delete c.peakLean;delete c.pressureMinPsi;delete c.errors;
  if(c.visible)adequate++;
 }
 const quality=[
  'Absolute MAP is based on standard MaxxECU MAP [20], displayed in PSIA.',
  'RPM ≥800 and TPS ≥15% only. Key-off, idle and low-throttle operation are not covered.',
  'Lambda is actual/target ratio; signed % indicates measured lean (+) or rich (−). No VE or ignition correction is computed.',
  'Cells with fewer than 8 screened sample readings are shown as insufficient evidence.',
  result.entries?.acceleration?.index<0?'Acceleration enrichment was not logged; enrichment exclusion is incomplete.':'Logged acceleration-enrichment-positive samples are excluded.',
  result.entries?.fuelCut?.index<0?'Fuel-cut state was not logged; overrun exclusion is incomplete.':'Logged fuel-cut-positive samples are excluded.',
  'Short TPS/MAP windows reduce obvious transitions but do not verify true steady state, closed-loop state, or repeatable load.',
  'Sample counts are NOT seconds of engine operation. Logged sampling frequency may vary.',
  'The 3D height scales the absolute magnitude of the observed median lambda deviation. It does not show active ECU VE values or an interpolated fuel surface.'
 ];
 return {source:'MaxxECU MAP [20]',rpmStep,mapStep,rpmMin:stepMin,mapMin,rpmBins,mapBins,cells,counts,adequate,minEvidence,quality,
  pressureVerified:pressureFactor!==null,
  note:'Observed RPM × absolute MAP evidence only; this is NOT a calibration VE table and does not prove active tune-cell lookup.'};
}
function summarizeEvent(log,result,event){
 const a=Math.max(0,Math.min(log.rpm.length-1,Number(event?.a)||0));
 const b=Math.max(a,Math.min(log.rpm.length-1,Number(event?.b)||a));
 const values=result.signals||{},low=Math.max(0,a-5),high=Math.min(log.rpm.length-1,b+5);
 const collect=(k)=>{const a=[];for(let i=low;i<=high;i++){const v=val(values[k],i);if(finite(v))a.push(v);}return a;};
 const tps=[],maps=[],press=[],correction=[],cut=[],enrich=[],corrState=[];
 for(let i=low;i<=high;i++){
  const t=val(log.tps,i),m=val(values.map,i),p=val(log.fuelPress,i),c=val(values.correction,i),f=val(values.fuelCut,i),
   en=val(values.acceleration,i),state=val(values.correctionState,i);
  if(finite(t))tps.push(t);if(finite(m))maps.push(m);if(finite(p)&&p>0)press.push(p);
  if(finite(c))correction.push(c);if(finite(f))cut.push(f);
  if(finite(en))enrich.push(en);if(finite(state))corrState.push(state);
 }
 const span=x=>x.length?Math.max(...x)-Math.min(...x):NaN;
 const pressureFactor=result.pressureInfo?.factor??null;
 const pressurePsi=pressureFactor!==null?press.map(v=>v*pressureFactor):[];
 const duration=finite(event?.duration)&&result.time?.verified?event.duration:NaN;
 const trimHeld=correction.length>=3&&correction.some((v,i)=>i>=2&&Math.abs(v-correction[i-1])<.051&&Math.abs(v-correction[i-2])<.051);
 const negativeLean=event.kind==='LEAN'&&correction.some(v=>v<-.5);
 const accelLogged=result.entries?.acceleration?.index>=0;
 const cutLogged=result.entries?.fuelCut?.index>=0;
 const pressVerified=pressureFactor!==null;
 const stable=finite(span(tps))&&span(tps)<5&&finite(span(maps))&&span(maps)<10;
 const throttleChange=finite(span(tps))&&span(tps)>=8,loadChange=finite(span(maps))&&span(maps)>=15;
 const enrichActive=enrich.some(v=>v>0),cutActive=cut.some(v=>v>0);
 const baseline=median(pressurePsi),minP=pressurePsi.length?Math.min(...pressurePsi):NaN;
 const pressureFall=pressVerified&&finite(baseline)&&baseline>0?100*(baseline-minP)/baseline:NaN;
 return {a,b,rows:b-a+1,kind:event.kind,duration,rpm:event.rpm,tps:event.tps,
  measuredLambda:event.lambda,targetLambda:event.target,rpmValid:finite(event.rpm),loadValid:finite(event.map)&&isMaxxMap(log,result),
  mapPsia:finite(event.map)&&isMaxxMap(log,result)?event.map*MAP_PSI:NaN,
  throttleSwing:span(tps),mapSwingKpa:span(maps),throttleChange,loadChange,steadyLike:stable,
  enrichmentAvailable:accelLogged,enrichmentActive:enrichActive,
  fuelCutAvailable:cutLogged,fuelCutActive:cutActive,
  correctionAvailable:result.entries?.correction?.index>=0,correctionStateAvailable:result.entries?.correctionState?.index>=0,
  correctionMin:correction.length?Math.min(...correction):NaN,correctionMax:correction.length?Math.max(...correction):NaN,
  correctionHeldPossible:trimHeld,negativeTrimDuringLean:negativeLean,correctionStateRawDistinct:[...new Set(corrState)].slice(0,8),
  pressureVerified:pressVerified,minPressurePsi:minP,medianPressurePsi:baseline,relativePressureDropPct:pressureFall,
  timeVerified:finite(duration),lambdaIndependent:hasIndependentLambda(log)};
}
function hypothesis(id,title,observed,missing,contrary,checks){
 return {id,title,observed,missing,contrary,checks,status:observed.length?'POSSIBLE — EVIDENCE TO REVIEW':'UNCONFIRMED — NEEDS EVIDENCE'};
}
function diagnose(log,result,event){
 if(!log||!result||!event)return {error:'Select an observed event first.'};
 const ctx=summarizeEvent(log,result,event);
 const h=[],global=[];
 const lean=event.kind==='LEAN',rich=event.kind==='RICH',fueling=lean||rich;
 const duration=ctx.timeVerified?'~'+fmt(ctx.duration,2)+'s':'duration unverified';
 global.push('Rows '+(ctx.a+1)+'–'+(ctx.b+1)+' · '+(finite(ctx.rpm)?fmt(ctx.rpm,0)+' RPM':'RPM unverified')+' · '+duration+'.');
 if(fueling&&!ctx.lambdaIndependent){
  return {error:'Measured/target lambda source validation failed. No fueling hypotheses will be generated.',context:ctx};
 }
 if(fueling){
  const transientEvidence=[];
  const transientContra=[];
  if(ctx.throttleChange)transientEvidence.push('TPS changed '+fmt(ctx.throttleSwing)+' percentage points across the event window.');
  if(ctx.loadChange&&ctx.loadValid)transientEvidence.push('Absolute MAP changed '+fmt(ctx.mapSwingKpa*MAP_PSI,2)+' PSIA.');
  if(ctx.enrichmentActive)transientEvidence.push('Acceleration-enrichment channel is positive in the event window (meaning/units unverified).');
  if(ctx.steadyLike)transientContra.push('TPS and MAP remained relatively stable in the sampled neighborhood.');
  h.push(hypothesis('transient','Transient fueling / sensor transport delay',
   transientEvidence,
   [ctx.enrichmentAvailable?'Verify configured acceleration-enrichment strategy and ECU control state.':'Log acceleration enrichment and its control state.',
    'Compare commanded vs measured lambda with throttle and intake/load at the same recorded timestamps; verify wideband transport delay.'],
   transientContra,[
    'Compare a warmed-up steady, repeatable section in the same RPM/PSIA region.',
    'Verify accelerator/throttle, MAP and wideband sensor response timing before blaming VE cells.'
   ]));
  const trimObserved=[],trimContra=[];
  if(ctx.negativeTrimDuringLean)trimObserved.push('Lean reading overlaps a negative raw Lambda corr A value.');
  if(ctx.correctionHeldPossible)trimObserved.push('Several adjacent Lambda corr A samples are nearly unchanged; trim may be held.');
  if(ctx.correctionStateAvailable)trimObserved.push('Raw correction-state codes logged: '+(ctx.correctionStateRawDistinct.join(', ')||'none readable')+'. Codes are NOT decoded.');
  if(!ctx.correctionAvailable)trimContra.push('No lambda-correction channel is mapped.');
  h.push(hypothesis('feedback','Closed-loop feedback state / held correction',
   trimObserved,
   [ctx.correctionStateAvailable?'Decode the logged state code from the matching MTune firmware/settings.':'Log Lambda corr state alongside Lambda corr A.',
    'Inspect lambda-control enable, transient hold/off behavior, reactivation delay and configured limits in the genuine calibration.'],
   trimContra,['Separate active feedback from a previously held correction; never assume a negative trim is actively subtracting fuel.']));
  const pressureObserved=[],pressureContra=[];
  if(ctx.pressureVerified&&finite(ctx.relativePressureDropPct)&&ctx.relativePressureDropPct>10)
   pressureObserved.push('Fuel pressure fell '+fmt(ctx.relativePressureDropPct,1)+'% beneath the local window median ('+fmt(ctx.minPressurePsi,1)+' PSI minimum).');
  if(ctx.pressureVerified&&finite(ctx.relativePressureDropPct)&&ctx.relativePressureDropPct<=5)
   pressureContra.push('No large fuel-pressure decline appeared in this short window; this does not rule out a differential-pressure issue.');
  h.push(hypothesis('fuel-pressure','Fuel delivery / injector differential pressure',
   pressureObserved,
   [ctx.pressureVerified?'Verify pressure sensor location, regulator reference and pressure expected at this MAP.':'Confirm original pressure input units and sensor scaling so the app can show valid PSI.',
    'Log injector duty, pump commands, battery voltage and regulator-referenced fuel pressure at the event.'],
   pressureContra,['Do not diagnose a pump from rail pressure magnitude without MAP/regulator context.']));
  const baseObserved=[],baseContra=[];
  if(ctx.steadyLike&&ctx.timeVerified&&ctx.duration>=.65&&!ctx.fuelCutActive&&!ctx.enrichmentActive)
   baseObserved.push('A sustained deviation occurred while TPS/MAP were relatively stable and logged fuel-cut/enrichment flags were not active.');
  if(ctx.throttleChange||ctx.loadChange)baseContra.push('The event overlaps a throttle/load transition; log data is not a stable VE-table sample.');
  if(ctx.fuelCutActive)baseContra.push('Fuel-cut flag active; lambda does not represent normal combustion fueling.');
  h.push(hypothesis('base-fueling','Steady operating-region calibration or airflow-model mismatch',
   baseObserved,
   ['Load the actual MTune calibration, identify the active strategy, verify axes and fuel/ignition corrections.',
    'Repeat comparable warmed-up RPM and MAP samples with sensor validation.'],
   baseContra,['Only inspect genuine table regions; no percentage fuel correction is calculated from the observed AFR error.']));
 }else if(event.kind==='PRESSURE DIP'){
  h.push(hypothesis('relative-drop','Relative fuel-pressure drop',
   ['Pressure screening flagged multiple running samples below the log median, not necessarily below an ECU safety limit.'],
   ['Verify pressure-unit scaling in PSI, differential regulator reference, sensor placement and commanded pump state.'],
   ['Vehicle load and regulator command may explain some absolute-pressure variation.'],
   ['Inspect pressure response and ECU protection state before further loaded testing.']));
 }else if(event.kind==='KNOCK'||event.kind==='ECU WARNING'){
  h.push(hypothesis('protection-state','ECU indication and protection response',
   ['A positive logged '+event.kind.toLowerCase()+' signal was observed; its units/bitmask and meaning are unverified.'],
   ['Verify sensor health, configured trigger thresholds, ignition timing, protection mode, and the ECU warning decoding.'],
   [],['Check the actual MTune protection configuration before interpreting or ignoring the event.']));
 }else if(event.idle){
  h.push(hypothesis('idle-control','Idle control vs accessory/load variation',
   ['A low-throttle RPM instability window was detected.'],
   ['Log the actual idle target, idle-control state, spark/air corrections, clutch or gear state, coolant °F and accessory load.'],
   [],['Do not infer VE/spark changes from idle RPM variation alone.']));
 }else{
  h.push(hypothesis('context','Review event operating context',[],[
   'Confirm channel mapping, elapsed time, sensor scaling and the logged ECU control state.'],[],
   ['Inspect the raw event sample table before changing the calibration.']));
 }
 const required=['Wideband actual and target channels independent: '+(ctx.lambdaIndependent?'yes':'NO'),
  'Standard MaxxECU MAP verified: '+(ctx.loadValid?'yes':'not verified'),
  'Event seconds verified: '+(ctx.timeVerified?'yes':'not verified'),
  'Fuel pressure PSI verified: '+(ctx.pressureVerified?'yes':'not verified'),
  'Fuel cut state logged: '+(ctx.fuelCutAvailable?'yes':'not logged'),
  'Acceleration enrichment logged: '+(ctx.enrichmentAvailable?'yes':'not logged'),
  'Lambda correction state logged: '+(ctx.correctionStateAvailable?'yes, raw codes only':'not logged')];
 return {context:ctx,event,summary:global,hypotheses:h,required,
  note:'Rules only, not a trained tuning AI or probability estimate. Hypotheses are alternatives, not confirmed root causes. No fuel/spark/boost adjustments or ECU writes.'};
}
function el(tag,value,cls){
 const e=document.createElement(tag);if(value!==undefined&&value!==null)e.textContent=String(value);
 if(cls)e.className=cls;return e;
}
function safeDownload(textContent,filename,mime){
 const url=URL.createObjectURL(new Blob([textContent],{type:mime||'text/plain;charset=utf-8'}));
 const a=el('a');a.href=url;a.download=filename;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function render(host,log,options={}){
 if(!host)return;
 host.replaceChildren();
 const area=el('section');area.className='signal-brain';
 area.append(el('h3','SIGNAL BRAIN + RPM / MAP EVIDENCE · v3.1'));
 area.append(el('p','Local-only evidence map and explainable hypothesis checker. Shows measured samples, NOT ECU-ready VE, ignition or fuel corrections.','signal-brain-muted'));
 if(!log||!Array.isArray(log.rpm)){
  area.append(el('p','Load a MaxxECU datalog to build a traceable evidence map and diagnose logged events.'));host.append(area);return;
 }
 const report=options.report||root.RawestSignalIntelligence?.analyze(log,{pressureUnit:options.pressureUnit||'auto'});
 if(!report||report.error){area.append(el('p',report?.error||'Signal Intelligence is unavailable.'));host.append(area);return;}
 const top=el('div');top.className='signal-brain-toolbar';
 const rpmChoice=el('select'),mapChoice=el('select'),modeChoice=el('select');
 for(const [v,label] of [['250','250 RPM cells'],['500','500 RPM cells'],['1000','1,000 RPM cells']]){
  const option=el('option',label);option.value=v;rpmChoice.append(option);
 }
 rpmChoice.value='500';
 for(const [v,label] of [['10','10 kPa source bins'],['20','20 kPa source bins'],['30','30 kPa source bins']]){
  const option=el('option',label);option.value=v;mapChoice.append(option);
 }
 mapChoice.value='20';
 for(const [v,label] of [['2d','2D coverage + signed AFR error'],['3d','3D observed-cell evidence pillars']]){
  const option=el('option',label);option.value=v;modeChoice.append(option);
 }
 modeChoice.value='2d';
 const wrapLabel=(label,control)=>{const group=el('label',label,'signal-brain-control');group.append(control);return group;};
 top.append(wrapLabel('RPM grid',rpmChoice),wrapLabel('Absolute MAP grid (display PSIA)',mapChoice),wrapLabel('Display',modeChoice));
 const exportHeat=el('button','Export evidence cells CSV','ps-btn secondary');
 exportHeat.type='button';top.append(exportHeat);
 area.append(top);
 const headline=el('div');headline.className='signal-brain-stats';area.append(headline);
 const surface=el('div');surface.className='signal-brain-surface';area.append(surface);
 const inspector=el('div');inspector.className='signal-brain-inspector';area.append(inspector);
 const legend=el('p','Warm/red = measured lean vs target; cool/blue = rich. Uncolored cells have insufficient screened samples. 3D pillar height represents ABSOLUTE median deviation; it does not interpolate unobserved cells.','signal-brain-muted');
 area.append(legend);
 const brain=el('section');brain.className='signal-brain-diagnostic';area.append(brain);
 const caution=el('p','MAP must be the exact MaxxECU MAP [20] channel; a nonstandard or Holley input is rejected rather than guessed. Read-only: no ECU/table writes.','signal-brain-muted');area.append(caution);
 host.append(area);
 let map=null,selection=null;
 function showCell(c){
  selection=c;inspector.replaceChildren();
  inspector.append(el('h4','OBSERVED OPERATING CELL · '+c.rpmFrom.toLocaleString()+'–'+c.rpmTo.toLocaleString()+' RPM / '+fmt(c.mapPsiaFrom,2)+'–'+fmt(c.mapPsiaTo,2)+' PSIA'));
  const p=el('p','Observed '+c.observed+' samples · '+c.paired+' valid lambda pairs · '+c.eligible+' screened for obvious cut/enrichment/transient conditions.');inspector.append(p);
  if(c.visible){
   inspector.append(el('p','Median actual/target deviation '+fmt(c.medianError,2)+'% ('+(c.medianError>0?'leaner than target':c.medianError<0?'richer than target':'at target')+'). Mean '+fmt(c.meanError,2)+'%. '+c.lean+' >10% lean and '+c.rich+' >10% rich readings.'));
  }else inspector.append(el('p','Insufficient evidence: fewer than '+map.minEvidence+' screened samples. No fueling-error color or inference.'));
  inspector.append(el('p','Screened exclusions in this cell: '+c.filtered.fuelCut+' fuel-cut, '+c.filtered.enrichment+' acceleration-enrichment, '+c.filtered.transition+' throttle/load transitions, '+c.filtered.lambda+' invalid lambda pairs.'));
  inspector.append(el('p','Minimum observed pressure in screened samples: '+(map.pressureVerified&&finite(c.minPressurePsi)?fmt(c.minPressurePsi,1)+' PSI':'PSI unavailable / no valid screened pressure')+'. Not differential regulator pressure.'));
  inspector.append(el('p','This grid does not prove which VE/ignition table or cell was active. Genuine MTune table lookup requires separately validated axes, blending and ECU strategy.'));
 }
 const hue=(v)=>{
  if(!finite(v))return '#434752';
  if(v>=10)return '#a64135';if(v>=4)return '#955742';if(v>=1)return '#77634b';
  if(v<=-10)return '#346c9b';if(v<=-4)return '#436c8b';if(v<=-1)return '#506879';
  return '#555e60';
 };
 function svgEl(name,attrs={}){
  const node=document.createElementNS('http://www.w3.org/2000/svg',name);
  for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));
  return node;
 }
 function draw2d(){
  const scroll=el('div');scroll.className='signal-brain-grid-scroll';
  const table=el('table');table.className='signal-brain-heatmap';
  const tr=el('tr');tr.append(el('th','RPM ↓ / MAP PSIA →'));
  for(let m=0;m<map.mapBins;m++){
   const a=(map.mapMin+m*map.mapStep)*MAP_PSI,b=(map.mapMin+(m+1)*map.mapStep)*MAP_PSI;
   tr.append(el('th',fmt(a,1)+'–'+fmt(b,1)));
  }
  table.append(tr);
  for(let r=0;r<map.rpmBins;r++){
   const row=el('tr');row.append(el('th',(map.rpmMin+r*map.rpmStep).toLocaleString()+'–'+(map.rpmMin+(r+1)*map.rpmStep).toLocaleString()));
   for(let m=0;m<map.mapBins;m++){
    const c=map.cells[r*map.mapBins+m],td=el('td'),button=el('button');
    button.type='button';button.className='signal-brain-cell';button.style.backgroundColor=c.visible?hue(c.medianError):'transparent';
    button.title=c.rpmFrom+' RPM, '+fmt(c.mapPsiaFrom,1)+' PSIA; '+c.observed+' observed / '+c.eligible+' screened samples'+(c.visible?', median '+fmt(c.medianError,2)+'%':' — insufficient evidence');
    button.textContent=c.visible?fmt(c.medianError,1)+'%':c.observed?String(c.observed)+'·':'';
    button.setAttribute('aria-label',button.title);
    if(selection?.id===c.id)button.setAttribute('aria-pressed','true');
    button.onclick=()=>{showCell(c);drawGrid();};
    td.append(button);row.append(td);
   }
   table.append(row);
  }
  scroll.append(table);surface.append(scroll);
 }
 function draw3d(){
  // Isometric SVG *pillars*, one per actually observed cell. Unobserved regions
  // are never triangulated or blended into a false continuous tune surface.
  const svg=svgEl('svg',{viewBox:'0 0 1050 480',role:'img','aria-label':'3D perspective of measured RPM and absolute MAP cell deviations'});
  svg.classList.add('signal-brain-isometric');
  const originX=120,originY=320,sx=Math.min(30,680/Math.max(1,map.rpmBins)),sy=Math.min(27,300/Math.max(1,map.mapBins));
  const coords=(r,m,z)=>({x:originX+r*sx+m*sy*.72,y:originY-r*sx*.35+m*sy*.55-z});
  const addPolygon=(points,color,cell)=>{
   const p=svgEl('polygon',{points:points.map(q=>q.x+','+q.y).join(' '),fill:color,stroke:'#171b22','stroke-width':'.7'});
   const tag=svgEl('title');tag.textContent=cell.rpmFrom+' RPM / '+fmt(cell.mapPsiaFrom,1)+' PSIA: '+fmt(cell.medianError,2)+'% median; '+cell.eligible+' samples';
   p.append(tag);svg.append(p);
   p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',tag.textContent);
   p.addEventListener('click',()=>{showCell(cell);});
   p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showCell(cell);}});
  };
  const cells=map.cells.filter(c=>c.visible).sort((a,b)=>(a.ri+a.mi)-(b.ri+b.mi));
  const height=(c)=>Math.min(72,Math.abs(c.medianError)*4);
  for(const c of cells){
   const r=c.ri,m=c.mi,h=height(c);
   const c00=coords(r,m,0),c10=coords(r+.9,m,0),c11=coords(r+.9,m+.9,0),c01=coords(r,m+.9,0);
   const t00=coords(r,m,h),t10=coords(r+.9,m,h),t11=coords(r+.9,m+.9,h),t01=coords(r,m+.9,h);
   const base=hue(c.medianError);
   addPolygon([c00,c10,t10,t00],base,c);
   addPolygon([c10,c11,t11,t10],base,c);
   addPolygon([t00,t10,t11,t01],base,c);
  }
  const axis=svgEl('text',{x:'8',y:'460',fill:'#bdc5cf','font-size':'14'});
  axis.textContent='Observed cells only · pillar height = |median AFR deviation %| · RPM / absolute MAP axes';
  svg.append(axis);surface.append(svg);
  const caption=el('p','Rotate/view is fixed isometric. Select a colored pillar or use 2D grid for exact cell inspection. Gaps mean no adequately screened observations.','signal-brain-muted');surface.append(caption);
 }
 function drawGrid(){
  surface.replaceChildren();
  if(!map||map.error){
   surface.append(el('p',map?.error||'Heatmap unavailable.'));inspector.replaceChildren();return;
  }
  if(modeChoice.value==='3d')draw3d();else draw2d();
 }
 function build(){
  map=buildHeatmap(log,report,{rpmStep:+rpmChoice.value,mapStep:+mapChoice.value});
  selection=null;headline.replaceChildren();inspector.replaceChildren();
  if(map.error){drawGrid();return;}
  for(const [name,v] of [
   ['Operating samples',map.counts.operating],['Screened mixture samples',map.counts.screened],
   ['Evidence-backed cells',map.adequate],['Transition/cut/enrichment exclusions',map.counts.excludedTransition+map.counts.excludedFuelCut+map.counts.excludedEnrich]
  ]){
   const stat=el('div');stat.append(el('strong',Number(v).toLocaleString()));stat.append(el('span',name));headline.append(stat);
  }
  drawGrid();
  const notes=el('details');notes.className='signal-brain-quality';notes.append(el('summary','Method, missing channels and restrictions'));
  const ul=el('ul');for(const note of map.quality)ul.append(el('li',note));notes.append(ul);inspector.append(notes);
 }
 exportHeat.onclick=()=>{
  if(!map||map.error)return;
  const columns=['rpm_from','rpm_to','map_from_psia','map_to_psia','observed_samples','valid_lambda_pairs',
   'screened_samples','median_actual_target_deviation_pct_if_supported','mean_actual_target_deviation_pct_if_supported',
   'lean_samples_over_10pct','rich_samples_over_10pct','minimum_fuel_psi_if_verified','excluded_fuel_cut',
   'excluded_accel_enrichment','excluded_transient','excluded_invalid_lambda','evidence_status'];
  const rows=map.cells.filter(c=>c.observed).map(c=>[
   c.rpmFrom,c.rpmTo,fmt(c.mapPsiaFrom,3),fmt(c.mapPsiaTo,3),c.observed,c.paired,c.eligible,
   c.visible?fmt(c.medianError,3):'',c.visible?fmt(c.meanError,3):'',c.lean,c.rich,
   map.pressureVerified&&finite(c.minPressurePsi)?fmt(c.minPressurePsi,2):'',
   c.filtered.fuelCut,c.filtered.enrichment,c.filtered.transition,c.filtered.lambda,
   c.visible?'screened observations':'insufficient evidence'
  ].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));
  safeDownload([columns.join(','),...rows].join('\n'),'rawest-signal-observed-rpm-map-evidence.csv','text/csv;charset=utf-8');
 };
 rpmChoice.onchange=build;mapChoice.onchange=build;modeChoice.onchange=drawGrid;
 build();
 function drawBrain(){
  brain.replaceChildren();brain.append(el('h3','DIAGNOSTIC BRAIN · evidence-linked hypotheses'));
  const all=report.events||[],focused=root.RawestSignalIntelligence?.forGoal?.(all,log,options.goal||'wot')||all;
  const possibilities=focused.length?focused:all;
  const intro=el('p','Select an event for observed evidence, competing causes, missing channels and suggested verification. These are deterministic rules, not probabilities or an autonomous tuner.','signal-brain-muted');
  brain.append(intro);
  if(!possibilities.length){
   brain.append(el('p','No qualifying event runs. This does not establish that the engine is safe or properly calibrated.'));return;
  }
  const select=el('select');
  select.setAttribute('aria-label','Choose event for Diagnostic Brain');
  for(const [i,e] of possibilities.slice(0,80).entries()){
   const item=el('option',(i+1)+'. '+e.kind+' · rows '+(e.a+1)+'–'+(e.b+1)+' · '+fmt(e.rpm,0)+' RPM');
   item.value=String(i);select.append(item);
  }
  brain.append(select);
  const inspect=el('div');inspect.className='signal-brain-hypotheses';brain.append(inspect);
  const exportButton=el('button','Export selected event evidence (.json)','ps-btn secondary');
  exportButton.type='button';brain.append(exportButton);
  let shown=null;
  function refresh(){
   inspect.replaceChildren();
   const chosen=possibilities[+select.value||0];if(!chosen)return;
   shown=diagnose(log,report,chosen);
   if(shown.error){inspect.append(el('p',shown.error));return;}
   const summary=el('div');summary.className='signal-brain-event';
   for(const p of shown.summary)summary.append(el('p',p));
   inspect.append(summary);
   const facts=el('details');facts.append(el('summary','Evidence quality · '+shown.required.length+' checks'));
   const ul=el('ul');for(const item of shown.required)ul.append(el('li',item));facts.append(ul);inspect.append(facts);
   for(const h of shown.hypotheses){
    const card=el('details');card.className='signal-brain-hypothesis';
    const heading=el('summary',h.title+' · '+h.status);card.append(heading);
    const group=(title,entries)=>{
     const div=el('div');div.append(el('strong',title));
     const list=el('ul');for(const item of entries)list.append(el('li',item));
     div.append(list);card.append(div);
    };
    group('Observed evidence',h.observed.length?h.observed:['No direct supporting signal yet.']);
    group('Contrary evidence / limitations',h.contrary.length?h.contrary:['No independent counter-evidence established.']);
    group('Missing evidence',h.missing);
    group('What to verify next',h.checks);
    inspect.append(card);
   }
   inspect.append(el('p',shown.note,'signal-brain-muted'));
  }
  select.onchange=refresh;
  exportButton.onclick=()=>{
   if(!shown||shown.error)return;
   safeDownload(JSON.stringify({format:'rawest-signal-evidence-v3.1',generated:new Date().toISOString(),
    event:shown.event,quality:shown.required,hypotheses:shown.hypotheses,note:shown.note},null,2),
    'rawest-signal-event-evidence.json','application/json;charset=utf-8');
  };
  refresh();
 }
 drawBrain();
}
root.RawestSignalBrain={buildHeatmap,summarizeEvent,diagnose,render,version:'3.2.0'};
})(typeof window!=='undefined'?window:globalThis);
