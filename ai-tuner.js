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
 let html=card('Safety check · '+count+' samples',hardStops.length?'<strong>'+hardStops.length+' flagged stop(s).</strong> Resolve and validate these before performance-oriented changes.':'No active warning or knock condition detected in available channels. This does NOT prove the engine is safe.');
 for(const x of hardStops)html+=card('STOP · '+escapeHtml(x.name),escapeHtml(x.detail));
 html+=card('Operating areas','RPM rows: '+rows.length+' · Loaded samples (RPM ≥1500, TPS ≥40%): '+loaded.length+' · WOT candidate samples (RPM ≥2000, TPS ≥80%): '+wot.length+'. Throttle thresholds are screening rules, not proof of a clean pull.');
 html+=card('WOT fueling · '+(supportedFuel?'Review available':'Not evaluated'),!wot.length?'No WOT samples were captured. Do not change WOT fuel or spark based on this log.':!valid('lambda')||!valid('targetLambda')?'Measured and commanded lambda are missing. WOT fueling cannot be assessed.':hardStops.length?'Active safety flags block WOT fueling suggestions.':wot.length<25?'Only '+wot.length+' candidate samples. Not enough for a reliable WOT review.':'Both lambda channels exist, but sensor scaling, load axis, fuel pressure and transient conditions must be verified before any numeric edits.');
 html+=card('What to leave alone','No automated ignition advance, boost targets, injector scaling, flex-fuel blending, overrun/flame settings, or fuel-table cell edits are supported by this screening pass.');
 html+=card('What to log next',missing.length?'Missing or unverified: '+escapeHtml(missing.join(', '))+'. Record appropriate steady-state data after resolving active warnings and mechanical issues.':'Verify actual channel units, closed-loop state, MAP/load, ethanol content, injector pulse width and pressure differential. Record repeatable steady-state data; avoid unsafe road pulls.');
 if(valid('lambda')&&valid('targetLambda')){
  const good=rows.filter(i=>{const l=at('lambda',i),t=at('targetLambda',i),th=at('tps',i);return Number.isFinite(l)&&Number.isFinite(t)&&l>.5&&l<1.5&&t>.5&&t<1.5&&th>=15;});
  html+=card('Lambda coverage',good.length+' samples contain plausible measured and target lambda at throttle ≥15%. No VE correction inferred: steady-state, fuel cut, closed-loop compensation and MAP/load are not validated.');
 }
 out.innerHTML=html;
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
 if(d&&finite(d.lambda)&&finite(d.targetLambda)){
  const x=samples(d).filter(x=>x.t>=35);
  const bins=new Map();for(const v of x){const k=Math.floor(v.r/500)*500;const b=bins.get(k)||[];b.push(v);bins.set(k,b);}
  proposal.evidence=[...bins].filter(([k,v])=>v.length>=15).map(([rpm,v])=>({rpmBand:[rpm,rpm+499],samples:v.length,meanLambdaRatioErrorPct:+(mean(v.map(x=>x.err))*100).toFixed(2),interpretation:'Diagnostic only; not a VE/fuel-table correction'}));
 }
 const html=card('Review plan · '+label,'Tune: '+(tune?escapeHtml(tune.name):'not loaded')+'; log: '+(d?d.rowCount+' samples':'not loaded')+'. Review: '+selectedTargets.join(', ')+'. This is a diagnostic plan, not a set of ECU-ready edits.');
 $('aiPlanResult').innerHTML=html;
 const btn=document.createElement('button');btn.textContent='Download review plan (.json)';btn.style.cssText='background:var(--amber);color:#080a0c;border:0;border-radius:8px;padding:10px 14px;font-weight:700';
 btn.onclick=()=>{const blob=new Blob([JSON.stringify(proposal,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pullsheet-'+goal+'-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 $('aiPlanResult').appendChild(btn);
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
 const limit=Math.min(500,Math.max(1,Number($('aiEventLimit')?.value)||50)),selected=rows.slice(0,limit);
 status.textContent=rows.length+' matching samples out of '+d.rpm.length+' total · displaying '+selected.length+'. Values are from the parsed log; absent channels show —.';
 const cols=[['runtime','Time'],['rpm','RPM'],['tps','TPS'],['lambda','Lambda'],['targetLambda','Target λ'],['fuelPress','Fuel press'],['knock','Knock signal'],['warnings','Warnings'],['gear','Gear'],['vss','Speed']];
 const table=document.createElement('table');const head=document.createElement('tr');
 for(const title of ['Row',...cols.map(x=>x[1])]){const th=document.createElement('th');th.textContent=title;head.append(th);}table.append(head);
 for(const i of selected){const tr=document.createElement('tr');const values=[i+1,...cols.map(([k])=>Array.isArray(d[k])?d[k][i]:null)];for(const v of values){const td=document.createElement('td');td.textContent=typeof v==='number'?(Number.isFinite(v)?Number(v.toFixed(3)):'—'):(v??'—');tr.append(td);}table.append(tr);}
 target.append(table);
}
function downloadEvents(){
 const {d,rows}=eventRows();if(!d||!rows.length){const status=$('aiEventStatus');if(status)status.textContent='No matching rows to export.';return;}
 const cols=['runtime','rpm','tps','lambda','targetLambda','fuelPress','knock','warnings','gear','vss'];
 const escapeCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const data=[['source_row',...cols].join(','),...rows.map(i=>[i+1,...cols.map(k=>Array.isArray(d[k])?d[k][i]:'')].map(escapeCsv).join(','))].join('\n');
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

window.pullsheetAI={analyze,dyno,plan,renderWorkspace,refreshStudio};
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
