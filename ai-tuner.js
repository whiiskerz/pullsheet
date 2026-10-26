/* Pullsheet AI Tuner development module — deterministic, local, read-only. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const finite=a=>Array.isArray(a)&&a.some(Number.isFinite);
const mean=a=>a.reduce((s,v)=>s+v,0)/Math.max(1,a.length);
const fmt=(n,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
function card(title,body){return '<div style="background:var(--panel2);border:1px solid var(--line);padding:15px;border-radius:12px;margin:12px 0"><b>'+title+'</b><p style="line-height:1.6;color:var(--dim);font-size:12px">'+body+'</p></div>'}
function samples(d){let a=[];for(let i=0;i<d.rpm.length;i++){const r=d.rpm[i],t=d.tps[i],l=d.lambda[i],target=d.targetLambda[i];if([r,t,l,target].every(Number.isFinite)&&r>800&&t>=15&&l>.5&&l<1.5&&target>.5&&target<1.5)a.push({i,r,t,l,target,err:l/target-1});}return a}
function analyze(){
 const out=$('aiFindings'),d=typeof lastParsed!=='undefined'?lastParsed:null;
 if(!out)return;
 if(!d){out.innerHTML=card('Log required','Import a MaxxECU log in Analyze first. No results have been fabricated.');return;}
 const count=d.rowCount||d.rpm?.length||0;
 const at=(key,i)=>Array.isArray(d[key])?d[key][i]:NaN;
 const valid=(key)=>finite(d[key]);
 const rows=Array.from({length:count},(_,i)=>i).filter(i=>Number.isFinite(at('rpm',i)));
 const loaded=rows.filter(i=>at('rpm',i)>=1500&&at('tps',i)>=40);
 const wot=rows.filter(i=>at('rpm',i)>=2000&&at('tps',i)>=80);
 const warning=valid('warnings')?loaded.filter(i=>at('warnings',i)>0):[];
 // MaxxECU 'Knock Detected' is often a boolean, not degrees of knock retard.
 const knock=valid('knock')?loaded.filter(i=>at('knock',i)>0):[];
 const hardStops=[];
 if(warning.length)hardStops.push({name:'ECU warnings under load',detail:warning.length+' loaded samples report active warnings. Decode the warning flags and verify sensor health before calibration changes.'});
 if(knock.length)hardStops.push({name:'Knock indication under load',detail:knock.length+' loaded samples report a positive knock signal. Verify the configured channel (boolean detection versus retard degrees), mechanical noise and fuel quality. Do not infer a degree value.'});
 const missing=[];
 if(!valid('rpm'))missing.push('RPM');
 if(!valid('tps'))missing.push('throttle position');
 if(!valid('lambda'))missing.push('measured lambda');
 if(!valid('targetLambda'))missing.push('commanded lambda');
 if(!valid('fuelPress'))missing.push('fuel pressure (with verified units)');
 if(!valid('knock'))missing.push('knock channel (with verified definition)');
 if(!valid('coolant'))missing.push('coolant temperature');
 const supportedFuel=valid('lambda')&&valid('targetLambda')&&wot.length>=25&&!hardStops.length;
 let html=card('GLOBAL engine safety check · '+count+' samples',hardStops.length?'<strong>'+hardStops.length+' flagged stop(s).</strong> Resolve and validate these before performance-oriented changes.':'No active warning or knock condition detected in available channels. This does NOT prove the engine is safe.');
 for(const x of hardStops)html+=card('STOP · '+escapeHtml(x.name),escapeHtml(x.detail));
 html+=card('Operating areas','RPM rows: '+rows.length+' · Loaded samples (RPM ≥1500, TPS ≥40%): '+loaded.length+' · WOT candidate samples (RPM ≥2000, TPS ≥80%): '+wot.length+'. Throttle thresholds are screening rules, not proof of a clean pull.');
 html+=card('WOT fueling snapshot (all workflows) · '+(supportedFuel?'Review available':'Not evaluated'),!wot.length?'No WOT samples were captured. Do not change WOT fuel or spark based on this log.':!valid('lambda')||!valid('targetLambda')?'Measured and commanded lambda are missing. WOT fueling cannot be assessed.':hardStops.length?'Active safety flags block WOT fueling suggestions.':wot.length<25?'Only '+wot.length+' candidate samples. Not enough for a reliable WOT review.':'Both lambda channels exist, but sensor scaling, load axis, fuel pressure and transient conditions must be verified before any numeric edits.');
 html+=card('What to leave alone','No automated ignition advance, boost targets, injector scaling, flex-fuel blending, overrun/flame settings, or fuel-table cell edits are supported by this screening pass.');
 html+=card('What to log next',missing.length?'Missing or unverified: '+escapeHtml(missing.join(', '))+'. Record appropriate steady-state data after resolving active warnings and mechanical issues.':'Verify actual channel units, closed-loop state, MAP/load, ethanol content, injector pulse width and pressure differential. Record repeatable steady-state data; avoid unsafe road pulls.');
 if(valid('lambda')&&valid('targetLambda')){
  const good=rows.filter(i=>{const l=at('lambda',i),t=at('targetLambda',i),th=at('tps',i);return Number.isFinite(l)&&Number.isFinite(t)&&l>.5&&l<1.5&&t>.5&&t<1.5&&th>=15&&at('rpm',i)>800;});
  html+=card('Lambda coverage',good.length+' samples contain plausible measured and target lambda at RPM >800 and throttle ≥15% (same operating filter as general fueling reports). No VE correction inferred: steady-state, fuel cut, closed-loop compensation and MAP/load are not validated.');
 }
 out.innerHTML=html;
}
function dyno(){
 const d=typeof lastParsed!=='undefined'?lastParsed:null,out=$('aiDynoResult');
 if(!d||!finite(d.runtime)||!finite(d.rpm)||!finite(d.vss)||!finite(d.tps)){out.innerHTML=card('Not trusted','Load a log containing time, RPM, speed and throttle.');return;}
 const massLb=Number($('aiMass').value);const mass=window.RawestSignalUnits?.kilogramsFromPounds(massLb)??massLb*.45359237;const cdaFt2=Number($('aiCda').value);const cda=cdaFt2*0.09290304;const crr=Number($('aiCrr').value),gear=$('aiGear').value,drive=$('aiDrive').value,locked=$('aiLocked').checked;
 if(!(massLb>1100&&massLb<11000&&cdaFt2>2.15&&cdaFt2<21.5&&crr>.002&&crr<.05)){out.innerHTML=card('Invalid vehicle inputs','Check weight (lb), drag area (ft²), and rolling resistance.');return;}
 // MaxxECU speed convention is km/h; runtime convention varies, validated using observed span.
 let pts=[];let eligible=0;for(let i=0;i<d.rpm.length;i++){let t=d.runtime[i],v=d.vss[i],r=d.rpm[i],p=d.tps[i];if([t,v,r,p].every(Number.isFinite)&&r>=2000&&p>=85&&v>15){eligible++;pts.push({t,v:v/3.6,r,p,i,g:finite(d.gear)?d.gear[i]:NaN});}}
 if(pts.length<12){out.innerHTML=card('Not trusted · Data coverage','Only '+pts.length+' qualifying rows: RPM ≥2,000, TPS ≥85%, vehicle speed >9.3 mph, and valid time. Check TPS scaling, speed mapping, and whether this log contains a WOT pull.');return;}
 let best=[],cur=[];let dtPositive=pts.slice(1).map((x,i)=>x.t-pts[i].t).filter(x=>x>0).sort((a,b)=>a-b);let medianDt=dtPositive.length?dtPositive[Math.floor(dtPositive.length/2)]:NaN;let timeScale=medianDt>2?.001:1;let maxGap=Number.isFinite(medianDt)?Math.max(medianDt*8,0.25/timeScale):1/timeScale;for(let x of pts){if(cur.length&&(x.i!==cur[cur.length-1].i+1||x.t<=cur[cur.length-1].t||x.t-cur[cur.length-1].t>maxGap)){if(cur.length>best.length)best=cur;cur=[];}cur.push(x);}if(cur.length>best.length)best=cur;if(best.length<6){out.innerHTML=card('Not trusted · Fragmented pull','Found '+pts.length+' qualifying samples but the longest uninterrupted segment has '+best.length+'. Median time step: '+fmt(medianDt,3)+' raw units. Check runtime units, TPS threshold, VSS mapping and logging gaps.');return;}
 let span=best.at(-1).t-best[0].t,scale=timeScale; // infer from sample interval, not total duration; still requires verification
 let power=[];for(let j=2;j<best.length-2;j++){let a=best[j-2],b=best[j+2],dt=(b.t-a.t)*scale;if(dt<=0)continue;let acc=(b.v-a.v)/dt;if(acc<0||acc>12)continue;let v=best[j].v;let force=mass*acc+0.5*1.225*cda*v*v+mass*9.80665*crr;let kw=force*v/1000;power.push({hp:kw*1.341022,rpm:best[j].r});}
 if(power.length<8){let dt=best.slice(1).map((x,i)=>(x.t-best[i].t)*scale).filter(x=>x>0);let speedChange=(best.at(-1).v-best[0].v)*3.6;out.innerHTML=card('Not trusted · Acceleration diagnostics','Found '+pts.length+' qualifying rows; longest continuous segment: '+best.length+' rows over '+fmt(span*scale,2)+' seconds. Speed change: '+fmt(speedChange/1.609344,2)+' mph. Median time step: '+fmt(medianDt*scale,4)+' s. Valid acceleration windows: '+power.length+' (need ≥8). Likely causes: VSS quantization/flat readings, incorrect timebase, missing speed updates, or no clean single-gear pull. No horsepower number is reliable from these inputs.');return;}
 let peak=power.reduce((a,b)=>b.hp>a.hp?b:a),gears=new Set(best.map(x=>x.g).filter(Number.isFinite)),flags=[];
 if(gears.size>1)flags.push('gear change detected');
 if(!locked&&gear==='Automatic')flags.push('converter lockup not confirmed');
 if(span*scale<2)flags.push('short acceleration window');
 if(!finite(d.knock))flags.push('knock data missing');
 if(!finite(d.targetAfr)&&!finite(d.targetLambda))flags.push('commanded mixture missing');
 if(!finite(d.fuelPress))flags.push('fuel pressure missing');
 if(!finite(d.coolant))flags.push('coolant missing');
 if(!finite(d.gear))flags.push('gear channel missing');
 if(!finite(d.converterLockup)&&gear==='Automatic')flags.push('logged converter state missing');
 const status=gears.size>1?'Not trusted':flags.length?'Directional':'Directional'; // never certify usable without full validation
 out.innerHTML=card(status+' · Road-load wheel-power estimate','Peak '+fmt(peak.hp,0)+' hp at '+fmt(peak.rpm,0)+' RPM. Window '+fmt(span*scale,1)+' s; '+power.length+' acceleration samples. '+(flags.length?'Limitations: '+flags.join('; ')+'. ':'')+'Assumes level road, calibrated speed, known mass, no wheelspin and accurate timebase. Not a certified dyno. No automatic tune edits. This calculation does not verify ignition, fueling or mechanical safety.');
}
function plan(){
 const goal=$('aiGoal').value,loaded=typeof lastParsed!=='undefined'?lastParsed:null;
 const fuelingWorkflow=['flex','cruise','wot','transient'].includes(goal);
 const sameLambdaColumn=loaded&&Number.isInteger(loaded.sourceColumns?.lambda)&&loaded.sourceColumns.lambda>=0&&loaded.sourceColumns.lambda===loaded.sourceColumns?.targetLambda;
 const d=sameLambdaColumn?{...loaded,lambda:[],channelWarnings:[...(loaded.channelWarnings||[]),'Actual lambda and target lambda use the same log column. Fueling evaluation is disabled until I/O Config is fixed.']}:loaded;
 const tune=workspace.original;
 const targets={
 launch:['Launch input activation','Launch target / limiter conditions','Gear and speed conditions','Shift-cut and engine protection'],
 exhaust:['Overrun fuel-cut status','Exhaust temperature logging','Overrun ignition and load conditions','Thermal and emissions considerations'],
 idle:['Idle target RPM','Idle ignition correction','Idle air / electronic throttle control','Fuel table near idle load'],
 cruise:['Main fuel table','Closed-loop lambda control and trims','Fuel pressure compensation'],
 wot:['Main fuel table at measured RPM and load','Lambda target table','Injector and fuel pressure compensation'],
 transient:['Acceleration enrichment','Wall-wetting / transient fuel','Throttle rate and electronic throttle settings'],
 spark:['Main ignition table','Knock detection and correction','IAT/CLT ignition corrections'],
 flex:['Ethanol content sensor calibration','Flex-fuel blend tables','Fuel stoichiometry and injector compensation']
 };
 const label=$('aiGoal').selectedOptions[0].textContent;
 const selectedTargets=targets[goal]||['Verify ECU configuration'];
 const proposal={
  format:'pullsheet-review-plan/v1',created:new Date().toISOString(),goal,label,
  source:{logLoaded:!!d,logSamples:d?.rowCount||0,maxxecuTuneLoaded:!!tune},
  status:'REVIEW_ONLY_NOT_A_MAXXECU_CALIBRATION',
  mtuneTablesToInspect:selectedTargets,
  evidence:[],
  checks:['Verify actual channel units and sensor calibration','Confirm tune version and RPM/load axes','Review fuel pressure, ethanol content, knock and temperature conditions','Validate closed-loop and transient effects before attributing lambda errors to fuel-table cells'],
  changes:[],
  note:'No native MaxxECU tune was generated. No calibration values or cell indices are proposed without verified table schema, cell axes and log alignment.'
 };
 if(fuelingWorkflow&&d&&finite(d.lambda)&&finite(d.targetLambda)){
  const x=samples(d).filter(x=>goal==='wot'?x.r>=2000&&x.t>=80:x.t>=15);
  const bins=new Map();for(const v of x){const k=Math.floor(v.r/500)*500;const b=bins.get(k)||[];b.push(v);bins.set(k,b);}
  proposal.evidence=[...bins].filter(([k,v])=>v.length>=15).map(([rpm,v])=>({rpmBand:[rpm,rpm+499],samples:v.length,meanLambdaRatioErrorPct:+(mean(v.map(x=>x.err))*100).toFixed(2),interpretation:'Diagnostic only; not a VE/fuel-table correction'}));
 }

 const sorted=[...proposal.evidence].sort((a,b)=>a.rpmBand[0]-b.rpmBand[0]);
 const threshold=goal==='wot'?'RPM ≥2000 and TPS ≥80%':'RPM >800 and TPS ≥15%';
 const qualified=d&&finite(d.rpm)&&finite(d.tps)?d.rpm.reduce((n,r,i)=>n+(Number.isFinite(r)&&Number.isFinite(d.tps[i])&&(goal==='wot'?r>=2000&&d.tps[i]>=80:r>800&&d.tps[i]>=15)?1:0),0):0;
 const lambdaCount=sorted.reduce((n,x)=>n+x.samples,0);
 const readChannel=k=>d&&Array.isArray(d[k])?d[k].filter(Number.isFinite):[];
 const channelSummary=k=>{const a=readChannel(k);return a.length?{count:a.length,min:Math.min(...a),max:Math.max(...a),avg:mean(a)}:null;};
 const ethanolInfo=channelSummary('ethanol');
 const fuelInfo=channelSummary('fuelPress');
 const qualifying=d&&Array.isArray(d.rpm)?d.rpm.map((_,i)=>i).filter(i=>Number.isFinite(d.rpm[i])&&Number.isFinite(d.tps?.[i])&&(goal==='wot'?d.rpm[i]>=2000&&d.tps[i]>=80:d.rpm[i]>800&&d.tps[i]>=15)):[];
 const paired=qualifying.filter(i=>Number.isFinite(d.lambda?.[i])&&Number.isFinite(d.targetLambda?.[i])&&d.lambda[i]>.5&&d.lambda[i]<1.5&&d.targetLambda[i]>.5&&d.targetLambda[i]<1.5);
 const lean10=paired.filter(i=>d.lambda[i]/d.targetLambda[i]>1.10);
 const rich10=paired.filter(i=>d.lambda[i]/d.targetLambda[i]<.90);
 const pressureAtLean=lean10.map(i=>d.fuelPress?.[i]).filter(Number.isFinite);
 const pressureAtOther=paired.filter(i=>d.lambda[i]/d.targetLambda[i]<=1.10).map(i=>d.fuelPress?.[i]).filter(Number.isFinite);
 const avgPress=a=>a.length?mean(a).toFixed(1):null;
 const safetyRows=qualifying.filter(i=>(Number.isFinite(d.knock?.[i])&&d.knock[i]>0)||(Number.isFinite(d.warnings?.[i])&&d.warnings[i]>0));
 const eRows=qualifying.map(i=>d.ethanol?.[i]).filter(Number.isFinite);
 const eMin=eRows.length?Math.min(...eRows):null,eMax=eRows.length?Math.max(...eRows):null;
 const mappedHeader=id=>{
  if(!d)return 'no log loaded';
  const keys={cfgLambda:'lambda',cfgTargetLambda:'targetLambda',cfgFuel:'fuelPress',cfgEthanol:'ethanol'};
  const key=keys[id];
  const index=key&&d.sourceColumns?d.sourceColumns[key]:-1;
  // Reflect the column ACTUALLY used by the parser. Do not independently
  // guess again and accidentally claim the wrong wideband sensor.
  if(Number.isInteger(index)&&index>=0&&d.headers?.[index]){
   const suffix=$(id)?.value==='auto'?' (auto-matched; verify)':' (selected)';
   return String(d.headers[index])+suffix;
  }
  return 'not mapped — verify in I/O Config';
 };
 const units=typeof window!=='undefined'?window.RawestSignalUnits:null;
 const pressureHeader=mappedHeader('cfgFuel');
 const previousUnit=$('aiPressureUnit')?.value||'auto';
 const pressureInfo=units?units.describe(d,'fuelPress',previousUnit):null;
 const pressureUnit=previousUnit;
 const pressureFactor=pressureInfo?.factor??null;
 const pressureText=v=>pressureInfo?pressureInfo.display(v):'PSI unavailable (source unit unverified)';
 const pressureNote=pressureInfo?.note||'Pressure source unit must be confirmed to calculate PSI.';
 // Event Detective: contiguous sample runs, not isolated spikes or RPM averages.
 // Time duration is intentionally not inferred from row count.
 const detective=[];
 if(d&&Array.isArray(d.rpm)){
  const n=d.rpm.length;
  const val=(key,i)=>Array.isArray(d[key])?Number(d[key][i]):NaN;
  const events=[
   {kind:'LEAN',test:i=>val('rpm',i)>800&&val('tps',i)>=15&&val('lambda',i)>.5&&val('lambda',i)<1.5&&val('targetLambda',i)>.5&&val('targetLambda',i)<1.5&&val('lambda',i)/val('targetLambda',i)>1.10},
   {kind:'RICH',test:i=>val('rpm',i)>800&&val('tps',i)>=15&&val('lambda',i)>.5&&val('lambda',i)<1.5&&val('targetLambda',i)>.5&&val('targetLambda',i)<1.5&&val('lambda',i)/val('targetLambda',i)<.90},
   {kind:'KNOCK SIGNAL',test:i=>val('rpm',i)>800&&val('knock',i)>0},
   {kind:'ECU WARNING',test:i=>val('rpm',i)>800&&val('warnings',i)>0}
  ];
  for(const type of events){
   let start=-1;
   const close=end=>{
    if(start<0)return;
    const count=end-start+1;
    if(count>=3){
     const middle=Math.floor((start+end)/2);
     const actual=val('lambda',middle),target=val('targetLambda',middle);
     const before=Math.max(0,start-5),after=Math.min(n-1,end+5);
     const tpsValues=Array.from({length:after-before+1},(_,j)=>val('tps',before+j)).filter(Number.isFinite);
     const tpsSwing=tpsValues.length?Math.max(...tpsValues)-Math.min(...tpsValues):NaN;
     const t0=val('runtime',start),t1=val('runtime',end);
     // Runtime units differ by ECU/export. Do not claim seconds without verification.
     const nextLambda=val('lambda',after),nextTarget=val('targetLambda',after);
     const recovered=Number.isFinite(nextLambda)&&Number.isFinite(nextTarget)&&nextTarget>.5&&Math.abs(nextLambda/nextTarget-1)<=.05;
     const context=type.kind==='LEAN'||type.kind==='RICH'
       ?Number.isFinite(tpsSwing)&&tpsSwing>=8
         ?'THROTTLE TRANSITION — possible transient fueling; verify corrections'
         :recovered?'RETURNED TO TARGET — check elapsed time and corrections'
         :'UNRESOLVED — verify duration, load and fuel corrections'
       :'CHECK ECU SIGNAL DEFINITION';
     detective.push({kind:type.kind,start,end,count,rpm:val('rpm',middle),tps:val('tps',middle),actual,target,pressure:val('fuelPress',middle),time:val('runtime',middle),runtimeDelta:Number.isFinite(t0)&&Number.isFinite(t1)?t1-t0:null,tpsSwing,context});
    }
    start=-1;
   };
   for(let i=0;i<n;i++){if(type.test(i)){if(start<0)start=i;}else close(i-1);}
   close(n-1);
  }
  detective.sort((a,b)=>b.count-a.count);
 }
 const eventLine=e=>{
  const bits=[e.kind+' — '+e.count+' consecutive samples (rows '+(e.start+1)+'–'+(e.end+1)+')'];
  if(Number.isFinite(e.rpm))bits.push(Math.round(e.rpm)+' RPM');
  if(Number.isFinite(e.tps))bits.push(e.tps.toFixed(1)+'% TPS');
  if(Number.isFinite(e.actual)&&Number.isFinite(e.target))bits.push('measured '+(e.actual*14.7).toFixed(2)+' vs target '+(e.target*14.7).toFixed(2)+' gasoline-equivalent AFR');
  if(Number.isFinite(e.pressure))bits.push('fuel pressure '+pressureText(e.pressure));
  bits.push(e.context);
  return bits.join(' | ');
 };
 const ratioAfr=ratio=>(14.7*ratio).toFixed(2);
 const standout=[...sorted].filter(x=>Math.abs(x.meanLambdaRatioErrorPct)>=1).sort((a,b)=>Math.abs(b.meanLambdaRatioErrorPct)-Math.abs(a.meanLambdaRatioErrorPct)).slice(0,3);
 const near=sorted.filter(x=>Math.abs(x.meanLambdaRatioErrorPct)<=3);
 const prettyBand=x=>x.rpmBand[0].toLocaleString()+' to '+x.rpmBand[1].toLocaleString()+' RPM';
 const intelligence=typeof window!=='undefined'&&window.RawestSignalIntelligence&&d?window.RawestSignalIntelligence.analyze(d,{pressureUnit}):null;
 const smartEvents=intelligence&&!intelligence.error?intelligence.events:null;
 const workflow=intelligence&&!intelligence.error&&d?window.RawestSignalIntelligence.workflowInfo(d,intelligence,goal):null;
 const relevantEvents=workflow?.events||null;
 const smartEventLine=e=>[e.priority+' '+e.kind,'rows '+(e.a+1)+'-'+(e.b+1),e.count+' samples',Number.isFinite(e.duration)?e.duration.toFixed(2)+' seconds':'duration unknown',Math.round(e.rpm)+' RPM',Number(e.tps).toFixed(1)+'% TPS',e.context].join(' | ');
 const knockTracked=d&&Number.isInteger(d.sourceColumns?.knock)&&d.sourceColumns.knock>=0;
 const warningsTracked=d&&Number.isInteger(d.sourceColumns?.warnings)&&d.sourceColumns.warnings>=0;

 const plain=[
  'RAWEST SIGNAL — '+label+' report',
  '',
  d?'I reviewed '+(d.rowCount||d.rpm?.length||0).toLocaleString()+' samples from your engine log.':'No engine log is loaded yet.',
  d?.sourceFormat==='holley'?'This report uses a Holley CSV; MaxxECU tune comparison is not available for this log.':tune?'Your MaxxECU calibration file is loaded for reference.':'Your MaxxECU calibration file is not loaded, so I cannot compare these readings with the tune tables.',
  '',
  'What I found',
  ...(d?.channelWarnings||[]).map(w=>'CHANNEL ERROR: '+w),
  ...((workflow?.notes||[]).map(n=>'WORKFLOW: '+n)),
  fuelingWorkflow?(sorted.length?'I found differences between measured and requested fueling in '+sorted.length+' RPM ranges; those averages do not prove a bad fuel table.':'There were not enough qualified, independent lambda readings to assess fueling in this workflow.'):goal==='idle'?'Idle/cam uses stationary, low-throttle RPM windows—not the general ≥15% throttle fueling screen. Global engine safety is reported separately.':'This workflow does NOT infer launch, ignition or overrun calibration from generic lambda data. Global engine safety is reported separately.',
  fuelingWorkflow?(standout.length?'Largest RPM-band fueling differences: '+standout.map(x=>prettyBand(x)+': '+Math.abs(x.meanLambdaRatioErrorPct).toFixed(1)+'% '+(x.meanLambdaRatioErrorPct>0?'lean':'rich')).join('; ')+'.':''):'',
  fuelingWorkflow&&near.length?'Readings were closer to target around '+near.map(prettyBand).join(', ')+'.':'',
  '',
  'Channel mapping',
  'Measured lambda: '+mappedHeader('cfgLambda')+'; target lambda: '+mappedHeader('cfgTargetLambda')+'.',
  'Fuel pressure sensor: '+mappedHeader('cfgFuel')+'; ethanol: '+mappedHeader('cfgEthanol')+'. Fuel pressure will only display in PSI after its original unit is confirmed.',
  '',
  ...(goal==='wot'?[
   'Pull Sessions — separate high-throttle runs',
   intelligence?.wotSessions?.length
    ? 'Detected '+intelligence.wotSessions.length+' continuous high-throttle segments of at least 8 samples. These are candidate runs, not proof of clean single-gear full-load testing.'
    : 'No high-throttle segment had enough continuous samples to review as a run.',
   ...((intelligence?.wotSessions||[]).slice(0,8).map((p,i)=>{
    const mph=Number.isFinite(p.startMph)&&Number.isFinite(p.endMph)?p.startMph.toFixed(1)+'–'+p.endMph.toFixed(1)+' mph':'mph not logged';
    const pressure=Number.isFinite(p.pressureMinPsi)?'minimum '+p.pressureMinPsi.toFixed(1)+' PSI (input source '+intelligence.pressureInfo?.source+')':'Fuel PSI unavailable';
    const timing=Number.isFinite(p.duration)?'~'+p.duration.toFixed(2)+' s':'time unverified';
    const pattern=p.elapsedVerified?p.earlyLean+' lean samples in first 0.5 s; '+p.lateLean+' later':'lean timing not verified';
    return 'Run '+(i+1)+' | rows '+(p.a+1)+'–'+(p.b+1)+' | '+timing+' | '+Math.round(p.startRpm)+'–'+Math.round(p.endRpm)+' RPM | '+mph+' | '+p.leanCount+' over 10% lean, '+p.richCount+' over 10% rich | '+pattern+' | '+pressure+' | '+(Number.isFinite(p.gearChanges)?p.gearChanges+' logged gear transitions':'gear not verified')+'.';
   })),
   (intelligence?.wotSessions?.length||0)>8?'Additional runs are in the interactive Pull Sessions panel.':'',
   'No automatic VE, spark or boost changes were inferred from these segments.',
   ''
  ]:[]),
  'Significant events — ECU-aware screening',
  smartEvents?'In the selected '+label+' workflow: '+relevantEvents.length+' matching events. The full log has '+smartEvents.length+' events and '+intelligence.high+' higher-priority findings (regardless of selected workflow). Safety flags remain visible.':'Advanced event engine unavailable; falling back to sample runs.',
  ...(smartEvents?relevantEvents.slice(0,8).map(smartEventLine):detective.slice(0,8).map(eventLine)),
  smartEvents&&relevantEvents.length>8?'Plus '+(relevantEvents.length-8)+' relevant events in the inspector.':!smartEvents&&detective.length>8?'Plus '+(detective.length-8)+' additional runs.':'',
  smartEvents?.some(e=>e.kind==='LEAN'&&e.highLoad&&e.negativeWhileLean)?'High-throttle lean and negative Lambda corr A overlap. MaxxECU can hold old correction during transients: verify closed-loop state, configured hold/deactivation behavior and feedback settings.':'',
  '',
  fuelingWorkflow?'Sample-level checks':'Full-log fueling safety context (not evidence of '+label+' activation)',
  paired.length?'Of '+paired.length+' valid fueling readings: '+lean10.length+' were over 10% lean, and '+rich10.length+' were over 10% rich. For reference, lambda 1.00 = 14.7 gasoline-scale AFR, lambda 0.85 = 12.50, and lambda 0.80 = 11.76. These AFR numbers are gasoline-equivalent even on ethanol blends. Individual readings are not sustained events.':'There were no usable paired lambda readings in the selected operating filter.',
  pressureAtLean.length&&pressureAtOther.length?'Average fuel pressure: '+pressureText(mean(pressureAtLean))+' during lean readings versus '+pressureText(mean(pressureAtOther))+' during other readings. '+pressureNote+' Averages cannot rule out momentary pressure drops.':'Fuel pressure cannot be compared reliably against lean samples because paired pressure data is missing.',
  safetyRows.length?'Attention: '+safetyRows.length+' qualifying samples contained a positive knock or ECU-warning indication. Verify what those channels mean and investigate before loaded testing.':(knockTracked||warningsTracked)?'No positive indications appeared in the available mapped knock/warning channels. This does NOT confirm that knock detection and engine protection were active or calibrated.':'Knock and ECU warning channels are not mapped; the log cannot establish the absence of knock or protection events.',
  goal==='flex'&&eRows.length?'Ethanol content in the selected operating samples ranged from '+eMin.toFixed(1)+'% to '+eMax.toFixed(1)+'%. Compare against the actual fuel and inspect any sudden changes.':'',
  '',
  'How reliable is this?',
  'This review checked '+qualified.toLocaleString()+' candidate samples using '+threshold+'. That screening does not prove steady throttle, correct sensor calibration, or a clean pull. Individual lean spikes can also be hidden by averages. Fuel-pressure and ethanol summaries cover the full log unless specifically labeled as selected operating samples.',
  goal==='flex'?'This is not yet a complete flex-fuel test: ethanol content, fuel pressure and active fuel corrections have not been validated. The log alone does not establish which fuel was in the tank.':'The log has not been matched to verified fuel-table cells or confirmed steady-state operating conditions.',
  '',
  goal==='flex'?'Ethanol sensor: '+(ethanolInfo&&ethanolInfo.min>=0&&ethanolInfo.max<=100?'The log contains '+ethanolInfo.count+' ethanol readings averaging '+ethanolInfo.avg.toFixed(1)+'%, from '+ethanolInfo.min.toFixed(1)+'% to '+ethanolInfo.max.toFixed(1)+'%. Confirm these readings match the fuel in the tank.':'No trustworthy ethanol percentage was identified. Verify the channel mapping and sensor calibration.'):'',
  goal==='flex'?'Fuel pressure: '+(fuelInfo?'The log contains '+fuelInfo.count+' readings, ranging from '+pressureText(fuelInfo.min)+' to '+pressureText(fuelInfo.max)+'. '+pressureNote+' This includes key-off and low-load samples.':'No usable fuel-pressure readings were identified.'):'',
  '',
  'What I would check next',
  'Check measured and target lambda together with throttle, MAP/load, fuel pressure, knock and closed-loop corrections in the affected areas. Confirm wideband calibration and channel units first.',
  ...(intelligence&&!intelligence.error?intelligence.next.slice(0,5):[]),
  '',
  'Should you change the tune?',
  'Not from these averages alone. No calibration changes have been recommended or generated.',
  '',
  'This is a diagnostic report, not an ECU-ready calibration.'
 ].filter(x=>x!==undefined).join('\n');
 const report=plain;
 const container=$('aiPlanResult');container.replaceChildren();
 const controls=document.createElement('div');controls.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px';
 const unitLabel=document.createElement('label');unitLabel.textContent='Fuel pressure display: PSI · original input scale: ';
 const unitSelect=document.createElement('select');unitSelect.id='aiPressureUnit';
 for(const [v,t] of [['auto','Use verified input/header (or unavailable)'],['kpa','Input is kPa → display PSI'],['bar','Input is bar → display PSI'],['psi','Input is already PSI']]){
  const option=document.createElement('option');option.value=v;option.textContent=t;unitSelect.append(option);
 }
 unitSelect.value=pressureUnit;
 unitSelect.onchange=()=>{
  window.RawestSignalUnits?.save?.(window.RawestSignalUnits.mappedHeader(d,'fuelPress'),unitSelect.value);
  plan();
 };
 unitLabel.append(unitSelect);controls.append(unitLabel);
 const hint=document.createElement('span');hint.style.cssText='font-size:11px;color:var(--dim)';hint.textContent=pressureInfo?.canShowPsi?'Pressure is displayed in PSI; source '+pressureInfo.source+'.':'Select the original logged unit once to calculate PSI; never guessed.';controls.append(hint);
 container.append(controls);
 const heading=document.createElement('h3');heading.textContent=label+' · Tuning report';container.append(heading);
 const summary=document.createElement('p');summary.textContent='Inspect prioritized events, AFR graphs, ECU corrections and next-log checks. Expand the full text report below or copy/download it.';container.append(summary);
 if(typeof window!=='undefined'&&window.RawestSignalIntelligence){
  try{
   window.RawestSignalIntelligence.render(container,d,{pressureUnit:pressureUnit,goal});
  }catch(err){
   const warning=document.createElement('p');warning.textContent='Signal Intelligence was unable to review this log: '+err.message;container.append(warning);
  }
 }
 const fullText=document.createElement('details');fullText.className='signal-full-text-report';fullText.style.marginTop='18px';
 const fullTextLabel=document.createElement('summary');fullTextLabel.textContent='FULL DIAGNOSTIC TEXT · Expand report';fullText.append(fullTextLabel);
 const pre=document.createElement('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;color:var(--text);font-size:12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:14px;max-height:560px;overflow:auto';pre.textContent=report;fullText.append(pre);container.append(fullText);
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:9px;flex-wrap:wrap;margin-top:12px';container.append(actions);
 const download=(content,type,name)=>{const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const txt=document.createElement('button');txt.textContent='Download text report (.txt)';txt.className='ps-btn';txt.onclick=()=>download(report,'text/plain;charset=utf-8','rawest-signal-'+goal+'-report.txt');actions.append(txt);
 const copy=document.createElement('button');copy.textContent='Copy report';copy.className='ps-btn secondary';copy.onclick=async()=>{try{await navigator.clipboard.writeText(report);copy.textContent='Copied!'}catch(e){copy.textContent='Copy unavailable — use TXT download'}};actions.append(copy);
 const details=document.createElement('details');details.style.marginTop='12px';const summaryEl=document.createElement('summary');summaryEl.textContent='Advanced · detailed data';details.append(summaryEl);
 const json=document.createElement('button');json.textContent='Download structured data (.json)';json.className='ps-btn secondary';json.style.marginTop='10px';json.onclick=()=>download(JSON.stringify(proposal,null,2),'application/json','rawest-signal-'+goal+'-review.json');details.append(json);const raw=document.createElement('button');raw.textContent='Download detailed numbers (.txt)';raw.className='ps-btn secondary';raw.style.marginTop='10px';raw.onclick=()=>download(sorted.map(x=>prettyBand(x)+' | '+x.samples+' samples | '+x.meanLambdaRatioErrorPct+'%').join('\n'),'text/plain;charset=utf-8','rawest-signal-'+goal+'-details.txt');details.append(raw);container.append(details);
}


const workspace={original:null,compare:null};
const groups={
 launch:/launch|2.step|limiter|cut|clutch|brake|shift|gear/i,
 flex:/ethanol|flex.?fuel|stoich|fuel.?blend|content|fuel.?comp/i,
 spark:/ignition|spark|knock|timing|iat.*corr|clt.*corr/i,
 idle:/idle|throttle|iac|startup|stall/i,
 fuel:/fuel|lambda|inject|afr|ve |pressure/i,
 exhaust:/overrun|decel|fuel.?cut|exhaust|antilag|anti.lag|pop|bang|flame/i
};
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function parseCalibration(text,name){
 const xml=new DOMParser().parseFromString(text,'application/xml');
 if(xml.querySelector('parsererror'))throw Error('Invalid XML; native calibration could not be parsed.');
 const nodes=[...xml.getElementsByTagName('ECUSettingsItem')];
 if(!nodes.length)throw Error('No ECUSettingsItem entries found. This may not be a supported MaxxECU-save export.');
 const settings=new Map();
 for(const n of nodes){const key=n.getAttribute('name');if(!key)continue;const value=(n.textContent||'').trim();if(!settings.has(key))settings.set(key,[]);settings.get(key).push(value);}
 return {name,settings,entries:nodes.length};
}
function settingRows(){
 const a=workspace.original,b=workspace.compare;if(!a)return [];
 const keys=new Set([...a.settings.keys(),...(b?[...b.settings.keys()]:[])]);
 const rows=[];
 for(const key of keys){const before=a.settings.get(key)||[],after=b?.settings.get(key)||[];const changed=!!b&&JSON.stringify(before)!==JSON.stringify(after);rows.push({key,before,after,changed});}
 return rows;
}
function renderWorkspace(){
 const status=$('aiTuneStatus'),target=$('aiTuneBrowser');if(!status||!target)return;
 const a=workspace.original,b=workspace.compare;
 if(!a){status.textContent='Load an original .MaxxECU-save to browse ECU settings.';target.replaceChildren();refreshStudio();return;}
 const goal=$('aiGoal')?.value||'flex',term=($('aiSettingSearch')?.value||'').toLowerCase().trim(),diffOnly=$('aiDiffFilter')?.value==='changed';
 const all=settingRows(),filtered=all.filter(r=>(!diffOnly||r.changed)&&(!term||r.key.toLowerCase().includes(term))&&(!groups[goal]||groups[goal].test(r.key)||!!term));
 const changes=all.filter(r=>r.changed);
 status.textContent=a.name+' · '+a.entries+' XML entries · '+a.settings.size+' unique names'+(b?' · '+changes.length+' changed names vs '+b.name:' · import comparison tune to see changed settings')+'. Display is a raw XML settings view; table shapes and value units are not yet validated.';
 const table=document.createElement('table');table.style.cssText='width:100%;font-size:12px;border-collapse:collapse;table-layout:fixed';
 const head=document.createElement('tr');for(const h of ['MTune setting','Original value',b?'Compared value':'Status']){let th=document.createElement('th');th.textContent=h;th.style.cssText='text-align:left;padding:8px;overflow-wrap:anywhere';head.append(th);}table.append(head);
 for(const r of filtered.slice(0,80)){let tr=document.createElement('tr');if(r.changed)tr.style.background='rgba(255,180,50,.10)';for(const v of [r.key,r.before.join(' | '),b?r.after.join(' | '):'Read-only']){let td=document.createElement('td');td.textContent=v.length>180?v.slice(0,180)+'…':v;td.title=v;td.style.cssText='border-top:1px solid #5555;padding:8px;vertical-align:top;overflow-wrap:anywhere';tr.append(td);}table.append(tr);}
 target.replaceChildren();refreshStudio();const summary=document.createElement('p');summary.textContent=filtered.length+' matching settings; showing first '+Math.min(80,filtered.length)+'. Search to narrow. Goal filters are keyword matches, not verified table mappings.';target.append(summary);const wrap=document.createElement('div');wrap.style.cssText='overflow-x:auto;max-height:430px;overflow-y:auto';wrap.append(table);target.append(wrap);
}
async function loadCalibration(file,slot){
 if(!file)return;
 try{if(file.size>25e6)throw Error('Tune file exceeds 25 MB inspection limit.');
 const parsed=parseCalibration(await file.text(),file.name);workspace[slot]=parsed;renderWorkspace();}
 catch(err){const e=$('aiTuneStatus');if(e)e.textContent='Import error: '+err.message;}
}
function exportComparison(){
 if(!workspace.original){$('aiTuneStatus').textContent='Load an original tune first.';return;}
 const rows=settingRows(),report={format:'pullsheet-maxxecu-settings-diff/v1',created:new Date().toISOString(),original:workspace.original.name,compared:workspace.compare?.name||null,validatedForEcuImport:false,notes:'Read-only XML settings comparison. Not a MaxxECU-save tune. Unknown table encodings and ECU compatibility are not validated.',changes:workspace.compare?rows.filter(r=>r.changed):[],settings:workspace.compare?undefined:rows.map(r=>({key:r.key,value:r.before}))};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='pullsheet-mtune-'+(workspace.compare?'diff':'inventory')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}



function eventRows(){
 const d=typeof lastParsed!=='undefined'?lastParsed:null;if(!d||!Array.isArray(d.rpm))return {d,rows:[]};
 const mode=$('aiEventFilter')?.value||'all';
 const n=d.rpm.length,rows=[];
 const get=(k,i)=>Array.isArray(d[k])?d[k][i]:NaN;
 for(let i=0;i<n;i++){
  const rpm=get('rpm',i),tps=get('tps',i),knock=get('knock',i),warn=get('warnings',i),l=get('lambda',i),target=get('targetLambda',i);
  if(!Number.isFinite(rpm))continue;
  const ok=mode==='all'||mode==='idle'&&(rpm>=500&&rpm<=1200&&tps<=10)||mode==='cruise'&&(rpm>=1200&&tps>=10&&tps<40)||mode==='load'&&(rpm>=1500&&tps>=40)||mode==='wot'&&(rpm>=2000&&tps>=80)||mode==='knock'&&knock>0||mode==='warning'&&warn>0||mode==='lean'&&(Number.isFinite(l)&&Number.isFinite(target)&&l>.5&&l<1.5&&target>.5&&target<1.5&&l>target*1.05);
  if(ok)rows.push(i);
 }
 return {d,rows};
}
function renderEvents(){
 const target=$('aiEventTable'),status=$('aiEventStatus');if(!target||!status)return;
 const {d,rows}=eventRows();target.replaceChildren();
 if(!d){status.textContent='No log loaded. Import a log in Analyze first.';return;}
 const limit=Math.min(500,Math.max(1,Number($('aiEventLimit')?.value)||50));
 const ranked=($('aiEventFilter')?.value==='lean')?[...rows].sort((a,b)=>((d.lambda?.[b]/d.targetLambda?.[b])||0)-((d.lambda?.[a]/d.targetLambda?.[a])||0)):rows;
 const selected=ranked.slice(0,limit);
 const pressureInfo=window.RawestSignalUnits?.describe(d,'fuelPress');
 status.textContent=rows.length+' matching samples out of '+d.rpm.length+' total · displaying '+selected.length+'. '+(pressureInfo?.canShowPsi?'Fuel pressure converted to PSI ('+pressureInfo.source+').':'Fuel PSI unavailable until the original sensor source scale is verified in the report.')+' Speed shown in mph. Select Lean to rank deviations.';
 const cols=[['runtime','Time'],['rpm','RPM'],['tps','TPS'],['lambda','Lambda'],['targetLambda','Target λ'],['fuelPress','Fuel PSI'],['coolantF','Coolant °F'],['ethanol','Ethanol %'],['knock','Knock signal'],['warnings','Warnings'],['gear','Gear'],['vss','Speed mph']];
 const table=document.createElement('table');const head=document.createElement('tr');
 for(const title of ['Row',...cols.map(x=>x[1])]){const th=document.createElement('th');th.textContent=title;head.append(th);}table.append(head);
 for(const i of selected){
  const tr=document.createElement('tr');
  const values=[i+1,...cols.map(([k])=>{
   const raw=Array.isArray(d[k])?d[k][i]:NaN;
   if(k==='fuelPress')return pressureInfo?.display(raw)||'PSI unverified';
   if(k==='coolantF'){
    const temp=Number.isFinite(raw)?raw:window.RawestSignalUnits?.fahrenheitFromC(d.coolant?.[i]);
    return Number.isFinite(temp)?Number(temp.toFixed(1)):'—';
   }
   if(k==='vss')return Number.isFinite(raw)?Number((raw/1.609344).toFixed(1)):'—';
   return raw;
  })];
  for(const v of values){const td=document.createElement('td');td.textContent=typeof v==='number'?(Number.isFinite(v)?Number(v.toFixed(3)):'—'):(v??'—');tr.append(td);}
  table.append(tr);
 }
 target.append(table);
}
function downloadEvents(){
 const {d,rows}=eventRows();if(!d||!rows.length){const status=$('aiEventStatus');if(status)status.textContent='No matching rows to export.';return;}
 const cols=['runtime','rpm','tps','lambda','targetLambda','fuelPress','coolantF','ethanol','knock','warnings','gear','vss'];
 const pressureInfo=window.RawestSignalUnits?.describe(d,'fuelPress');
 const escapeCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const colNames=['time_source','rpm','tps_percent','lambda','lambda_target','fuel_pressure_psi','coolant_f','ethanol_percent','knock_raw','warnings_raw','gear','speed_mph'];
 const data=[['source_row',...colNames].join(','),...rows.map(i=>[i+1,...cols.map(k=>{
  const value=Array.isArray(d[k])?d[k][i]:NaN;
  if(!Number.isFinite(value))return '';
  if(k==='fuelPress')return pressureInfo?.canShowPsi?Number((value*pressureInfo.factor).toFixed(3)):'';
  if(k==='coolantF')return Number(value.toFixed(3));
  if(k==='vss')return Number((value/1.609344).toFixed(3));
  return value;
 })].map(escapeCsv).join(','))].join('\n');
 const blob=new Blob([data],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='rawest-signal-'+($('aiEventFilter')?.value||'events')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function refreshStudio(){
 const d=typeof lastParsed!=='undefined'?lastParsed:null;
 const a=workspace.original,b=workspace.compare;
 if($('aiSourceStatus'))$('aiSourceStatus').textContent=a?a.name+' · '+a.entries+' entries':'No calibration loaded';
 if($('aiCompareStatus'))$('aiCompareStatus').textContent=b?b.name+' · '+b.entries+' entries':'No comparison loaded';
 if($('aiLogStatus'))$('aiLogStatus').textContent=d?(d.rowCount||d.rpm?.length||0)+' samples linked · RPM '+(finite(d.rpm)?'available':'missing')+' · lambda '+(finite(d.lambda)?'available':'missing'):'No log linked. Import a log in Analyze first.';
 const output=$('aiSafetyChecklist');if(!output)return;
 const checks=[
  [!!a,'Source calibration XML loaded','Required for inspecting genuine settings'],
  [!!d,'MaxxECU log loaded','Required for evidence-based fueling analysis'],
  [!!d&&finite(d.lambda)&&finite(d.targetLambda),'Measured and target lambda present','Missing channels prevent lambda comparison'],
  [!!d&&finite(d.fuelPress),'Fuel pressure channel present','Pressure units and sensor location still need verification'],
  [!!d&&finite(d.knock),'Knock signal present','A valid knock sensor/configuration must be verified'],
  [!!d&&finite(d.coolant),'Coolant channel present','Verify sensor validity before using data']
 ];
 output.replaceChildren();const ul=document.createElement('ul');ul.style.cssText='margin:0;padding-left:20px;line-height:2;font-size:12px';
 checks.forEach(([ok,title,note])=>{const li=document.createElement('li');li.textContent=(ok?'✓ ':'○ ')+title+' — '+note;ul.append(li)});output.append(ul);
}
function selectStudioGoal(goal){
 const select=$('aiGoal');if(!select||!Array.from(select.options).some(x=>x.value===goal))return;
 select.value=goal;document.querySelectorAll('#aiGoals button[data-goal]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.goal===goal)));
 renderWorkspace();const plan=$('aiPlanResult');if(plan)plan.replaceChildren();
}

let studioLogIdentity=null;
function onLogChanged(d){
 if(studioLogIdentity!==d){
  studioLogIdentity=d;
  const report=$('aiPlanResult');if(report)report.replaceChildren();
  const findings=$('aiFindings');if(findings)findings.replaceChildren();
 }
 refreshStudio();
 renderEvents();
}
window.pullsheetAI={analyze,dyno,plan,renderWorkspace,refreshStudio,renderEvents,onLogChanged};
document.addEventListener('DOMContentLoaded',()=>{
 $('aiAnalyzeBtn')?.addEventListener('click',analyze);
 $('aiDynoBtn')?.addEventListener('click',dyno);
 $('aiPlanBtn')?.addEventListener('click',plan);
 $('aiTuneInput')?.addEventListener('change',e=>loadCalibration(e.target.files[0],'original'));
 $('aiCompareInput')?.addEventListener('change',e=>loadCalibration(e.target.files[0],'compare'));
 $('aiSettingSearch')?.addEventListener('input',renderWorkspace);
 $('aiGoal')?.addEventListener('change',renderWorkspace);
 $('aiExportDiff')?.addEventListener('click',exportComparison);
 $('aiRefreshStatus')?.addEventListener('click',()=>{refreshStudio();renderEvents();});
 $('aiInspectEvents')?.addEventListener('click',renderEvents);
 $('aiDownloadEvents')?.addEventListener('click',downloadEvents);
 $('aiEventFilter')?.addEventListener('change',renderEvents);
 $('aiEventLimit')?.addEventListener('change',renderEvents);
 $('aiDiffFilter')?.addEventListener('change',renderWorkspace);
 document.querySelectorAll('#aiGoals button[data-goal]').forEach(btn=>btn.addEventListener('click',()=>selectStudioGoal(btn.dataset.goal)));
 selectStudioGoal($('aiGoal')?.value||'flex');
 renderWorkspace();
 renderEvents();
});
})();
