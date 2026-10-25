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
 const d=typeof lastParsed!=='undefined'?lastParsed:null;
 if(!d){$('aiFindings').innerHTML=card('No log loaded','Load a native MaxxECU log in Analyze first, then return here.');return;}
 let html=card('Log linked',d.rowCount+' samples available. Recommendations are screening observations, not validated calibration edits.');
 if(!finite(d.lambda)||!finite(d.targetLambda))html+=card('Lambda channels missing','Map actual and target lambda in I/O Config. No fueling correction will be inferred from AFR without verified stoichiometric settings.');
 else {
 const a=samples(d),bins=new Map();
 for(const x of a){if(x.t<35)continue;let key=Math.floor(x.r/500)*500;let b=bins.get(key)||[];b.push(x);bins.set(key,b);}
 let good=[...bins].filter(([k,v])=>v.length>=15).map(([k,v])=>({rpm:k,n:v.length,error:mean(v.map(x=>x.err)),range:v.map(x=>x.i)})).sort((a,b)=>Math.abs(b.error)-Math.abs(a.error)).slice(0,6);
 if(good.length)html+=card('Fuel-table regions to inspect',good.map(b=>'<b>'+b.rpm+'–'+(b.rpm+499)+' RPM:</b> actual lambda '+(b.error>=0?'leaner':'richer')+' than target by '+fmt(Math.abs(b.error)*100,1)+'% ('+b.n+' samples). Inspect RPM/load cells only after checking closed-loop trims, steady state, pressure and ethanol calibration.').join('<br><br>'));
 else html+=card('Insufficient steady-state coverage','No RPM bands with at least 15 suitable samples at TPS ≥35%. No cell corrections calculated.');
 }
 if(finite(d.fuelPress))html+=card('Fuel pressure caution','Fuel-pressure channel exists. Confirm its physical units and whether it is gauge or differential pressure before interpreting drops or recommending fuel-table changes.');
 if(finite(d.knock)&&d.knock.some(v=>Number.isFinite(v)&&v>0))html+=card('Knock signal present','Positive knock readings were recorded. Verify the signal definition and investigate the matching timestamps before any ignition advance.');
 if(finite(d.warnings)&&d.warnings.some(v=>v>0))html+=card('ECU warnings recorded','Review warning flags and sensor validity before tuning.');
 $('aiFindings').innerHTML=html;
}
function dyno(){
 const d=typeof lastParsed!=='undefined'?lastParsed:null,out=$('aiDynoResult');
 if(!d||!finite(d.runtime)||!finite(d.rpm)||!finite(d.vss)||!finite(d.tps)){out.innerHTML=card('Not trusted','Load a log containing time, RPM, speed and throttle.');return;}
 const mass=Number($('aiMass').value),cda=Number($('aiCda').value),crr=Number($('aiCrr').value),gear=$('aiGear').value,drive=$('aiDrive').value,locked=$('aiLocked').checked;
 if(!(mass>500&&mass<5000&&cda>.2&&cda<2&&crr>.002&&crr<.05)){out.innerHTML=card('Invalid vehicle inputs','Check mass, CdA and rolling resistance.');return;}
 // MaxxECU speed convention is km/h; runtime convention varies, validated using observed span.
 let pts=[];let eligible=0;for(let i=0;i<d.rpm.length;i++){let t=d.runtime[i],v=d.vss[i],r=d.rpm[i],p=d.tps[i];if([t,v,r,p].every(Number.isFinite)&&r>=2000&&p>=85&&v>15){eligible++;pts.push({t,v:v/3.6,r,p,i,g:finite(d.gear)?d.gear[i]:NaN});}}
 if(pts.length<12){out.innerHTML=card('Not trusted · Data coverage','Only '+pts.length+' qualifying rows: RPM ≥2,000, TPS ≥85%, VSS >15 km/h, and valid time. Check TPS scaling, speed mapping, and whether this log contains a WOT pull.');return;}
 let best=[],cur=[];let dtPositive=pts.slice(1).map((x,i)=>x.t-pts[i].t).filter(x=>x>0).sort((a,b)=>a-b);let medianDt=dtPositive.length?dtPositive[Math.floor(dtPositive.length/2)]:NaN;let timeScale=medianDt>2?.001:1;let maxGap=Number.isFinite(medianDt)?Math.max(medianDt*8,0.25/timeScale):1/timeScale;for(let x of pts){if(cur.length&&(x.i!==cur[cur.length-1].i+1||x.t<=cur[cur.length-1].t||x.t-cur[cur.length-1].t>maxGap)){if(cur.length>best.length)best=cur;cur=[];}cur.push(x);}if(cur.length>best.length)best=cur;if(best.length<6){out.innerHTML=card('Not trusted · Fragmented pull','Found '+pts.length+' qualifying samples but the longest uninterrupted segment has '+best.length+'. Median time step: '+fmt(medianDt,3)+' raw units. Check runtime units, TPS threshold, VSS mapping and logging gaps.');return;}
 let span=best.at(-1).t-best[0].t,scale=timeScale; // infer from sample interval, not total duration; still requires verification
 let power=[];for(let j=2;j<best.length-2;j++){let a=best[j-2],b=best[j+2],dt=(b.t-a.t)*scale;if(dt<=0)continue;let acc=(b.v-a.v)/dt;if(acc<0||acc>12)continue;let v=best[j].v;let force=mass*acc+0.5*1.225*cda*v*v+mass*9.80665*crr;let kw=force*v/1000;power.push({hp:kw*1.341022,rpm:best[j].r});}
 if(power.length<8){let dt=best.slice(1).map((x,i)=>(x.t-best[i].t)*scale).filter(x=>x>0);let speedChange=(best.at(-1).v-best[0].v)*3.6;out.innerHTML=card('Not trusted · Acceleration diagnostics','Found '+pts.length+' qualifying rows; longest continuous segment: '+best.length+' rows over '+fmt(span*scale,2)+' seconds. Speed change: '+fmt(speedChange,2)+' km/h. Median time step: '+fmt(medianDt*scale,4)+' s. Valid acceleration windows: '+power.length+' (need ≥8). Likely causes: VSS quantization/flat readings, incorrect timebase, missing speed updates, or no clean single-gear pull. No horsepower number is reliable from these inputs.');return;}
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
 const goal=$('aiGoal').value,d=typeof lastParsed!=='undefined'?lastParsed:null;
 const tune=typeof aiOriginalTuneText!=='undefined'?aiOriginalTuneText:null;
 const targets={
 idle:['Idle target RPM','Idle ignition correction','Idle air / electronic throttle control','Fuel table near idle load'],
 cruise:['Main fuel table','Closed-loop lambda control and trims','Fuel pressure compensation'],
 wot:['Main fuel table at measured RPM and load','Lambda target table','Injector and fuel pressure compensation'],
 transient:['Acceleration enrichment','Wall-wetting / transient fuel','Throttle rate and electronic throttle settings'],
 spark:['Main ignition table','Knock detection and correction','IAT/CLT ignition corrections'],
 flex:['Ethanol content sensor calibration','Flex-fuel blend tables','Fuel stoichiometry and injector compensation']
 };
 const label=$('aiGoal').selectedOptions[0].textContent;
 const proposal={
  format:'pullsheet-review-plan/v1',created:new Date().toISOString(),goal,label,
  source:{logLoaded:!!d,logSamples:d?.rowCount||0,maxxecuTuneLoaded:!!tune},
  status:'REVIEW_ONLY_NOT_A_MAXXECU_CALIBRATION',
  mtuneTablesToInspect:targets[goal],
  evidence:[],
  checks:['Verify actual channel units and sensor calibration','Confirm tune version and RPM/load axes','Review fuel pressure, ethanol content, knock and temperature conditions','Validate closed-loop and transient effects before attributing lambda errors to fuel-table cells'],
  changes:[],
  note:'No native MaxxECU tune was generated. No calibration values or cell indices are proposed without verified table schema, cell axes and log alignment.'
 };
 if(d&&finite(d.lambda)&&finite(d.targetLambda)){
  const x=samples(d).filter(x=>x.t>=35);
  const bins=new Map();for(const v of x){const k=Math.floor(v.r/500)*500;const b=bins.get(k)||[];b.push(v);bins.set(k,b);}
  proposal.evidence=[...bins].filter(([k,v])=>v.length>=15).map(([rpm,v])=>({rpmBand:[rpm,rpm+499],samples:v.length,meanLambdaRatioErrorPct:+(mean(v.map(x=>x.err))*100).toFixed(2),interpretation:'Diagnostic only; not a VE/fuel-table correction'}));
 }
 const html=card('Review plan ready · '+label,'Tune file: '+(tune?'loaded':'missing')+'; log: '+(d?d.rowCount+' samples':'missing')+'. MTune areas to inspect: '+targets[goal].join(', ')+'. Exact cell edits and a valid .MaxxECU-save export require a verified source calibration and table encoding. No fake ECU-ready file will be generated.');
 $('aiPlanResult').innerHTML=html;
 const btn=document.createElement('button');btn.textContent='Download review plan (.json)';btn.style.cssText='background:var(--amber);color:#080a0c;border:0;border-radius:8px;padding:10px 14px;font-weight:700';
 btn.onclick=()=>{const blob=new Blob([JSON.stringify(proposal,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pullsheet-'+goal+'-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('aiPlanResult').appendChild(btn);
}

window.pullsheetAI={analyze,dyno,plan};
document.addEventListener('DOMContentLoaded',()=>{
 $('aiAnalyzeBtn')?.addEventListener('click',analyze);
 $('aiDynoBtn')?.addEventListener('click',dyno);
 $('aiPlanBtn')?.addEventListener('click',plan);
});
})();
