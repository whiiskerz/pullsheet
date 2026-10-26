/* RAWEST SIGNAL — My Garage BETA v3.2
 * On-device build inventory and deterministic hardware/log compatibility screening.
 * User-entered information is not verified hardware. No power guarantees or ECU writes.
 */
(function(root){
'use strict';
const KEY='rawest-signal-garage-beta-v1';
const VERSION=1,MAX_BUILDS=25,MAX_SNAPSHOTS=12;
const logCache=new WeakMap();
const finite=Number.isFinite;
const num=v=>{if(v===null||v===undefined||String(v).trim()==='')return NaN;const n=Number(v);return finite(n)?n:NaN;};
const round=(n,d=3)=>finite(n)?n.toFixed(d):'unverified';
const safeText=(v,max=220)=>String(v??'').slice(0,max).replace(/[\u0000-\u001f\u007f]/g,' ').trim();
const allowedSelect=options=>new Set(options.map(x=>x[0]));
const FIELDS=[
 {section:'Vehicle / project',id:'name',label:'Build nickname',type:'text',placeholder:'E90 LS swap, drag truck, street Camaro…',required:true},
 {section:'Vehicle / project',id:'year',label:'Vehicle year',type:'number',min:1900,max:2100,step:1},
 {section:'Vehicle / project',id:'make',label:'Make',type:'text',placeholder:'BMW'},
 {section:'Vehicle / project',id:'model',label:'Model / chassis',type:'text',placeholder:'E90 sedan'},
 {section:'Vehicle / project',id:'use',label:'Main use',type:'select',options:[['','Select'],['street','Street / drivability'],['track','Track / circuit'],['drag','Drag strip'],['mixed','Mixed use']]},
 {section:'Vehicle / project',id:'goalWhp',label:'Power goal · wheel horsepower',type:'number',min:1,max:4000,step:1},
 {section:'Vehicle / project',id:'currentWhp',label:'Verified current dyno · WHP (optional)',type:'number',min:1,max:4000,step:1},
 {section:'Vehicle / project',id:'budget',label:'Possible upgrade budget',type:'select',options:[['','Not specified'],['under1000','Under $1,000'],['1000-3000','$1,000–$3,000'],['3000-7000','$3,000–$7,000'],['over7000','Over $7,000']]},
 {section:'Engine / rotating assembly',id:'engine',label:'Engine family / code',type:'text',placeholder:'Gen III 4.8 LS, 2JZ, Coyote…'},
 {section:'Engine / rotating assembly',id:'displacement',label:'Displacement · liters',type:'number',min:.5,max:25,step:.1},
 {section:'Engine / rotating assembly',id:'block',label:'Block / rotating assembly',type:'text',placeholder:'Iron block, stock bottom end…'},
 {section:'Engine / rotating assembly',id:'pistons',label:'Pistons / rods / fasteners',type:'text',placeholder:'OEM flat tops, forged etc.'},
 {section:'Engine / rotating assembly',id:'compression',label:'Compression ratio · X:1',type:'number',min:4,max:20,step:.1},
 {section:'Engine / rotating assembly',id:'heads',label:'Cylinder heads / valves',type:'text',placeholder:'862, CNC port, etc.'},
 {section:'Engine / rotating assembly',id:'intake',label:'Intake / throttle body / exhaust',type:'text'},
 {section:'Camshaft / timing',id:'camName',label:'Camshaft brand / model',type:'text',placeholder:'Manufacturer and grind / part number'},
 {section:'Camshaft / timing',id:'camBasis',label:'Cam lift numbers represent',type:'select',options:[['valve','Valve lift from cam card'],['lobe','Lobe lift (needs installed rocker ratio)']]},
 {section:'Camshaft / timing',id:'camInt',label:'Intake cam lift · inches',type:'number',min:.05,max:1.2,step:.001,placeholder:'.610'},
 {section:'Camshaft / timing',id:'camExh',label:'Exhaust cam lift · inches',type:'number',min:.05,max:1.2,step:.001,placeholder:'.610'},
 {section:'Camshaft / timing',id:'camCardRatio',label:'Rocker ratio specified on cam card',type:'number',min:1,max:2.5,step:.01,placeholder:'1.70'},
 {section:'Camshaft / timing',id:'installedRatio',label:'Installed rocker arm ratio',type:'number',min:1,max:2.5,step:.01,placeholder:'1.70'},
 {section:'Camshaft / timing',id:'durationInt',label:'Duration @ .050 · intake (°)',type:'number',min:100,max:400,step:1},
 {section:'Camshaft / timing',id:'durationExh',label:'Duration @ .050 · exhaust (°)',type:'number',min:100,max:400,step:1},
 {section:'Camshaft / timing',id:'lsa',label:'Lobe separation angle · degrees',type:'number',min:90,max:125,step:1},
 {section:'Camshaft / timing',id:'rpmLimit',label:'Planned maximum engine RPM',type:'number',min:500,max:15000,step:100},
 {section:'Valvetrain / springs',id:'springPart',label:'Valve spring manufacturer / part number',type:'text',placeholder:'Exact kit / part number'},
 {section:'Valvetrain / springs',id:'springMaxLift',label:'Manufacturer spring maximum valve lift · inches',type:'number',min:.05,max:1.5,step:.001,placeholder:'.560'},
 {section:'Valvetrain / springs',id:'springInstalledHeight',label:'Measured installed spring height · inches',type:'number',min:.5,max:4,step:.001},
 {section:'Valvetrain / springs',id:'springBindHeight',label:'Measured spring coil-bind height · inches',type:'number',min:.2,max:3,step:.001},
 {section:'Valvetrain / springs',id:'retainerSeal',label:'Measured retainer-to-seal distance at valve closed · inches',type:'number',min:0,max:3,step:.001},
 {section:'Valvetrain / springs',id:'seatPressure',label:'Verified seat spring pressure · lb',type:'number',min:1,max:1000,step:1},
 {section:'Valvetrain / springs',id:'openPressure',label:'Verified open spring pressure · lb',type:'number',min:1,max:2000,step:1},
 {section:'Valvetrain / springs',id:'lifters',label:'Lifters / trays',type:'text',placeholder:'Hydraulic roller, LS7, etc.'},
 {section:'Valvetrain / springs',id:'pushrods',label:'Pushrods / measured length / wall',type:'text',placeholder:'Length verified?'},
 {section:'Valvetrain / springs',id:'rockerType',label:'Rockers / trunnions',type:'select',options:[['','Unverified'],['stock','Factory rocker bearings / trunnions'],['upgraded','Upgraded / confirmed compatible'],['shaft','Shaft-mounted rocker system'],['other','Other / custom']]},
 {section:'Valvetrain / springs',id:'ptvChecked',label:'Piston-to-valve clearance',type:'select',options:[['','Not verified'],['measured','Measured/validated for this cam'],['unknown','Unknown / not checked']]},
 {section:'Fuel / power adders',id:'fuel',label:'Fuel actually used',type:'select',options:[['','Unverified'],['91','91 octane'],['93','93 octane'],['e85','E85'],['flex','Flex fuel / varying ethanol'],['race','Race fuel'],['other','Other']]},
 {section:'Fuel / power adders',id:'injectors',label:'Injector make / flow rating',type:'text',placeholder:'Bosch 210 lb/hr'},
 {section:'Fuel / power adders',id:'pumps',label:'Fuel pump(s), filter, surge, regulator',type:'text'},
 {section:'Fuel / power adders',id:'fuelPressureVerified',label:'Fuel pressure sensor scaling verified?',type:'select',options:[['','Unknown'],['yes','Yes, checked in ECU and log'],['no','No / needs validation']]},
 {section:'Fuel / power adders',id:'aspiration',label:'Power delivery',type:'select',options:[['','Select'],['na','Naturally aspirated'],['turbo','Turbocharged'],['supercharged','Supercharged'],['nitrous','Nitrous-assisted'],['turbo-nitrous','Turbo + nitrous']]},
 {section:'Fuel / power adders',id:'turbo',label:'Turbo / blower / boost-control hardware',type:'text'},
 {section:'Fuel / power adders',id:'intercooler',label:'Intercooler / charge piping / IAT sensors',type:'text'},
 {section:'Fuel / power adders',id:'nitrous',label:'Nitrous system, progressive control, interlocks',type:'text'},
 {section:'Drivetrain / ECU',id:'transmission',label:'Transmission / controller',type:'text',placeholder:'8HP70 Gen1, TCU type…'},
 {section:'Drivetrain / ECU',id:'converter',label:'Torque converter stall or clutch / flywheel',type:'text',placeholder:'3,600 RPM stall etc.'},
 {section:'Drivetrain / ECU',id:'differential',label:'Final drive / differential',type:'text'},
 {section:'Drivetrain / ECU',id:'tire',label:'Tire size / traction setup',type:'text'},
 {section:'Drivetrain / ECU',id:'ecu',label:'ECU / firmware',type:'text',placeholder:'MaxxECU Race Gen1'},
 {section:'Drivetrain / ECU',id:'protection',label:'Protection channels / cut strategy',type:'text',placeholder:'Oil PSI, fuel PSI, CLT °F, knock, failsafes…'},
 {section:'Drivetrain / ECU',id:'notes',label:'Changes, issues, anything else',type:'textarea',placeholder:'Head gasket, oiling, temperature, wiring, priorities…'}
];
const FIELD_IDS=new Set(FIELDS.map(f=>f.id));
const optionField=f=>f.type==='select';
const cleanFields=raw=>{
 const o={};
 for(const f of FIELDS){
  const val=raw?.[f.id];if(val===null||val===undefined)continue;
  if(f.type==='number'){
   if(String(val).trim()==='')continue;
   const n=num(val);
   if(!finite(n)||n<f.min||n>f.max)continue;
   o[f.id]=String(n);
  }else if(optionField(f)){
   const allowed=allowedSelect(f.options);
   if(allowed.has(String(val)))o[f.id]=String(val);
  }else{
   const max=f.id==='notes'?3000:220;
   o[f.id]=safeText(val,max);
  }
 }
 return o;
};
const blank=()=>({name:'',camBasis:'valve'});
const ident=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,9);
const safeSnapshot=s=>{
 if(!s||typeof s!=='object')return null;
 return {
  savedAt:safeText(s.savedAt,48),samples:Math.min(10000000,Math.max(0,Math.floor(num(s.samples)||0))),
  wotCandidates:Math.min(10000000,Math.max(0,Math.floor(num(s.wotCandidates)||0))),
  eventCount:Math.min(10000000,Math.max(0,Math.floor(num(s.eventCount)||0))),
  highPriority:Math.min(10000000,Math.max(0,Math.floor(num(s.highPriority)||0))),
  notes:safeText(s.notes,450)
 };
};
const cleanBuild=input=>{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const fields=cleanFields(input.fields||input);
 const id=safeText(input.id,64)||ident();
 return {id,fields,updatedAt:safeText(input.updatedAt,48)||new Date().toISOString(),
  snapshots:(Array.isArray(input.snapshots)?input.snapshots:[]).slice(-MAX_SNAPSHOTS).map(safeSnapshot).filter(Boolean)};
};
function readStorage(storage){
 try{
  const text=storage?.getItem(KEY);
  if(!text)return {builds:[],activeId:null,error:null};
  if(text.length>1000000)return {builds:[],activeId:null,error:'Saved garage data exceeds the permitted size; import a clean backup.'};
  const data=JSON.parse(text);
  if(data?.version!==VERSION||!Array.isArray(data.builds))return {builds:[],activeId:null,error:'Garage storage version is not compatible; export and migrate the old backup.'};
  const seen=new Set();
  const builds=[];
  for(const item of data.builds.slice(0,MAX_BUILDS)){
   const b=cleanBuild(item);if(!b||seen.has(b.id))continue;seen.add(b.id);builds.push(b);
  }
  return {builds,activeId:builds.find(x=>x.id===data.activeId)?.id||builds[0]?.id||null,error:null};
 }catch(e){return {builds:[],activeId:null,error:'Garage local storage could not be parsed; a backup import may restore it.'};}
}
function saveStorage(storage,builds,activeId){
 if(!storage)return {ok:false,error:'Local storage is unavailable; export a JSON backup to keep the build.'};
 try{
  storage.setItem(KEY,JSON.stringify({version:VERSION,builds,activeId}));
  return {ok:true};
 }catch(e){return {ok:false,error:'Browser storage is unavailable or full. Export a JSON backup; your draft remains on screen.'};}
}
const issue=(severity,title,explanation,action,category='Hardware',evidence='User-entered build specifications')=>
 ({severity,title,explanation,action,category,evidence});
function valveLift(fields){
 const values=[num(fields.camInt),num(fields.camExh)];
 const basis=fields.camBasis||'valve',card=num(fields.camCardRatio),installed=num(fields.installedRatio);
 const out={basis,intake:NaN,exhaust:NaN,verifiedRatio:false,description:''};
 if(basis==='lobe'){
  if(!finite(installed))return {...out,description:'Lobe lift entered, but installed rocker ratio is missing. Valve lift is unknown.'};
  out.intake=finite(values[0])?values[0]*installed:NaN;
  out.exhaust=finite(values[1])?values[1]*installed:NaN;
  out.verifiedRatio=true;
  out.description='Estimated valve lift = logged lobe lift × entered installed rocker ratio; actual measured lift still needs verification.';
 }else{
  if(finite(card)&&finite(installed)){
   out.intake=finite(values[0])?values[0]*installed/card:NaN;
   out.exhaust=finite(values[1])?values[1]*installed/card:NaN;
   out.verifiedRatio=true;
   out.description='Cam-card valve lift scaled for entered installed rocker ratio vs card ratio; confirm actual valve lift with the manufacturer.';
  }else{
   out.intake=values[0];out.exhaust=values[1];
   out.description='Valve lift taken from the cam card; installed rocker ratio must match the cam-card assumption. Verify at the valve.';
  }
 }
 return out;
}
function analyzeHardware(fields){
 const f=cleanFields(fields),checks=[],lift=valveLift(f);
 const intake=lift.intake,exhaust=lift.exhaust,actual=finite(intake)&&finite(exhaust)?Math.max(intake,exhaust):finite(intake)?intake:exhaust;
 const maxLift=num(f.springMaxLift),installed=num(f.springInstalledHeight),bind=num(f.springBindHeight),
  retainer=num(f.retainerSeal),rpm=num(f.rpmLimit);
 if(finite(actual)&&finite(maxLift)){
  if(actual>maxLift+0.000001){
   checks.push(issue('stop','Valve lift exceeds recorded spring maximum',
    'Calculated intake/exhaust max valve lift '+round(actual)+'" exceeds the manufacturer spring maximum you entered ('+round(maxLift)+'") by '+round(actual-maxLift)+'". Spring capacity cannot be assumed from the cam alone.',
    'Do not increase RPM or load until the spring manufacturer/engine builder confirms a suitable matched spring, installed height, seat/open pressure and measured clearances.',
    'Valvetrain','Cam lift / rocker ratio and claimed spring maximum from the saved build'));
  }else if(maxLift-actual<.025){
   checks.push(issue('review','Valve spring advertised lift margin is narrow',
    'Recorded max valve lift '+round(actual)+'" is within '+round(maxLift-actual)+'" of the spring maximum '+round(maxLift)+'". This does not demonstrate coil-bind or retainer clearance.',
    'Verify spring specification, installed height, coil bind and retainer-to-seal clearance at full lift with the engine builder.','Valvetrain'));
  }else checks.push(issue('info','Advertised lift is within recorded spring maximum',
    'Valve lift '+round(actual)+'" is below the entered maximum spring lift '+round(maxLift)+'"; this alone does NOT establish suitability.',
    'Check measured seat/open pressures, coil-bind margin, retainer clearance and manufacturer part-number compatibility.','Valvetrain'));
 }else{
  checks.push(issue('verify','Cannot confirm cam-to-spring lift compatibility',
   'Provide the cam-card valve lift (or lobe lift and installed rocker ratio) and the spring manufacturer’s maximum supported valve lift.',
   'Record exact cam/spring part numbers; do not substitute generic spring ratings.','Valvetrain'));
 }
 if(f.camBasis==='lobe'&&!finite(num(f.installedRatio)))
  checks.push(issue('verify','Lobe lift entered without rocker ratio','Actual valve lift depends on the installed rocker ratio.',
   'Enter the measured/verified rocker ratio; compare the resulting valve lift against the spring specifications.','Valvetrain'));
 if(f.camBasis!=='lobe'&&finite(num(f.camCardRatio))&&!finite(num(f.installedRatio)))
  checks.push(issue('verify','Cam-card rocker ratio needs confirmation','Cam-card lift may have been specified at a different rocker ratio than installed.',
   'Check the actual rocker ratio and verify total lift at the valve.','Valvetrain'));
 if(finite(actual)&&finite(installed)&&finite(bind)){
  const margin=installed-actual-bind;
  if(margin<.06)checks.push(issue('stop','Possible coil bind: measured clearance is below 0.060"',
   'Installed spring height '+round(installed)+'" − valve lift '+round(actual)+'" − coil-bind height '+round(bind)+'" = '+round(margin)+'" remaining.',
   'Stop high-RPM/high-load operation. Verify both inner/outer spring stacks and installed height with a qualified builder; follow the spring manufacturer’s specification.','Valvetrain','User-entered spring installed height, bind height, and calculated lift'));
  else checks.push(issue('info','Calculated spring coil-bind margin',
   round(margin)+'" remains from the entered heights (generic 0.060" screen, not a universal spring specification).',
   'Physically measure installed height and all spring layers at maximum lift, per manufacturer instructions.','Valvetrain'));
 }else if(finite(actual))checks.push(issue('verify','Coil-bind margin not verified',
  'Installed spring height and/or measured coil-bind height were not supplied.',
  'Measure both; springs can bind even when the catalog maximum-lift rating appears adequate.','Valvetrain'));
 if(finite(actual)&&finite(retainer)){
  const margin=retainer-actual;
  if(margin<.06)checks.push(issue('stop','Retainer-to-seal clearance may be insufficient',
   'Entered retainer-to-seal distance at valve closed ('+round(retainer)+'") minus max valve lift ('+round(actual)+'") leaves '+round(margin)+'".',
   'Verify at actual full lift, including seal/guide and rocker geometry; use the valve train manufacturer’s required clearance.','Valvetrain'));
  else checks.push(issue('info','Calculated retainer-to-seal clearance',round(margin)+'" remaining based on entered values; this still requires physical verification.','Inspect guide/seal, rocker-retainer and pushrod clearances.','Valvetrain'));
 }else if(finite(actual))checks.push(issue('verify','Retainer-to-seal clearance unknown',
  'A high-lift cam may contact valve seals/guides even with adequate spring lift rating.',
  'Physically verify retainer-to-seal and rocker-retainer clearances at full lift.','Valvetrain'));
 if(!finite(num(f.seatPressure))||!finite(num(f.openPressure)))
  checks.push(issue('verify','Seat/open spring pressures not both verified',
   'Catalog maximum valve lift does not establish the correct seat and open spring pressure for this cam/RPM.',
   'Measure installed pressures and match the cam manufacturer’s recommendations.','Valvetrain'));
 if(f.rockerType==='stock'&&(finite(actual)&&actual>=.6||finite(rpm)&&rpm>=6500)){
  checks.push(issue('upgrade','Inspect factory rocker bearings / trunnions for high-lift use',
   'This cam lift / planned RPM may increase valvetrain demands; stock rocker condition and fit are unknown.',
   'Inspect bearings, rocker geometry, pivot/retainer clearance and pushrod strength; evaluate a compatible trunnion or rocker upgrade with your engine builder. This is a durability review, not a proven power gain.','Valvetrain'));
 }else if(!f.rockerType&&finite(actual)&&actual>=.55)
  checks.push(issue('verify','Rocker geometry/trunnion configuration unknown','Lift is substantial but rocker configuration was not supplied.',
   'Verify rocker ratio, trunnion/bearing condition and clearances.','Valvetrain'));
 if(f.ptvChecked!=='measured'&&finite(actual)&&actual>=.55)
  checks.push(issue('verify','Piston-to-valve clearance not confirmed',
   'Cam lift alone cannot determine clearance; duration, installed centerline, piston/head/valve geometry and phasing also matter.',
   'Measure piston-to-valve clearance using the appropriate engine-builder procedure before hard loaded use.','Valvetrain'));
 if(!f.springPart&&finite(actual))
  checks.push(issue('verify','Spring kit identity missing','A generic “.660 lift spring” description is not the same as the manufacturer part number.',
   'Capture the exact spring/retainer/locator combination before declaring a compatible cam package.','Valvetrain'));
 return {checks,lift,actual,maxLift};
}
function analyzeLog(log,intelligence){
 if(!log||!Array.isArray(log.rpm))return {available:false,text:'No current datalog linked. Hardware checks still run, but power advice cannot be validated against operating evidence.',alerts:[],next:['Load a real datalog in Analyze to evaluate WOT lambda, pressure, protection and temperature evidence.']};
 const unit=root.RawestSignalUnits?.describe?.(log,'fuelPress')?.unit||'unverified';
 const stamp=JSON.stringify([unit,log.rpm.length,log.rpm[log.rpm.length-1],log.runtime?.[log.runtime.length-1],log.sourceColumns]);
 const hit=logCache.get(log);
 if(hit&&hit.stamp===stamp&&hit.intelligence===intelligence)return hit.result;
 let r;
 try{r=intelligence?.analyze?.(log,{pressureUnit:'auto'});}catch(e){return {available:false,text:'Log analysis unavailable: '+safeText(e.message),alerts:[],next:[]};}
 if(!r||r.error)return {available:false,text:r?.error||'ECU analysis unavailable.',alerts:[],next:[]};
 const alerts=[],next=[];
 const lean=(r.events||[]).filter(e=>e.kind==='LEAN'&&e.highLoad&&(e.priority==='HIGH'||e.priority==='REVIEW'));
 const knock=(r.events||[]).filter(e=>e.kind==='KNOCK'||e.kind==='ECU WARNING');
 if(lean.length){
  alerts.push(issue('stop','High-load lean findings: hold added power',
   lean.length+' significant loaded lean event(s) were recorded, including '+Math.round(lean[0].rpm)+' RPM. This is evidence to investigate, not proof the VE table is wrong.',
   'Verify wideband, transient fueling, correction state, fuel pressure and protective strategy before adding boost/nitrous or further high-load testing.','Logged evidence','MaxxECU log event rows '+(lean[0].a+1)+'–'+(lean[0].b+1)));
 }
 if(knock.length)alerts.push(issue('stop','ECU knock/warning indications need interpretation',
  knock.length+' knock or warning event(s) were flagged, but raw code meaning and sensor configuration are not automatically validated.',
  'Inspect logs and protection calibration with a qualified tuner before adding load.','Logged evidence'));
 if(r.pressureFactor===null)alerts.push(issue('verify','Log fuel-pressure source units unverified',
  'The app cannot safely convert the logged fuel-pressure channel to PSI without a confirmed original scale.',
  'Verify the pressure-sensor scaling and original log units in MTune.','Logged evidence'));
 const snaps=Array.isArray(r.wotSessions)?r.wotSessions.length:0;
 const high=Number(r.high)||0;
 const wot=Number(r.wotCount)||0;
 if(wot<20)next.push('Log enough representative operating data to evaluate load and fueling. Do not conduct unsafe or illegal test pulls.');
 if(r.quality?.find(q=>q.key==='Timebase')?.status==='unverified')next.push('Verify a valid seconds-based time channel to distinguish transient spikes from sustained events.');
 if(!r.pressureInfo?.canShowPsi)next.push('Confirm original fuel-pressure units so pressure can be interpreted in PSI.');
 const result={available:true,samples:r.n,wotCandidates:wot,pullSegments:snaps,events:r.events.length,high,lean:lean.length,alerts,next,
  text:r.n.toLocaleString()+' samples · '+wot+' WOT candidate samples · '+snaps+' segmented high-throttle runs · '+r.events.length+' flagged multi-sample events. This is not a safety certification.'};
 logCache.set(log,{stamp,intelligence,result});
 return result;
}
function powerPlan(fields,hardware,logReport){
 const goal=num(fields.goalWhp),current=num(fields.currentWhp),asp=fields.aspiration||'';
 const options=[],barriers=hardware.checks.filter(c=>c.severity==='stop').concat(logReport.alerts.filter(c=>c.severity==='stop'));
 if(!finite(goal)){
  options.push(issue('verify','Define a wheel-horsepower goal',
   'Power upgrades depend on the target, traction, fuel, engine hardware, budget and intended use.',
   'Enter your target WHP and (if available) a verified baseline dyno, not a simulated horsepower estimate.','Power plan'));
 }else if(finite(current)&&goal<=current){
  options.push(issue('info','Target WHP is not above your verified baseline',
   'Entered goal '+round(goal,0)+' WHP is at or below your entered dyno baseline '+round(current,0)+' WHP.',
   'Focus on reliability, repeatability, traction and cooling unless the target changes.','Power plan'));
 }else{
  const gap=finite(current)?'Desired increase from entered dyno baseline: '+round(goal-current,0)+' WHP.':'Baseline wheel horsepower is unknown; no numeric gain is predicted.';
  options.push(issue('info','Power goal context',gap,'Use a verified dyno/drag-strip track measurement for baseline and re-test comparable conditions.','Power plan'));
  if(asp==='na'||asp===''){
   options.push(issue('upgrade','Naturally aspirated breathing / combination review',
    'Potential power paths include matched head flow, intake/exhaust restriction work, cam/valvetrain development and compression/fuel strategy. None guarantees a specific WHP gain.',
    'First confirm cam-to-spring compatibility, air/fuel target tracking, RPM/torque curve and engine limits. A cam alone is not proof a larger one would help.','Power plan'));
   options.push(issue('upgrade','If the goal requires more than an NA combination can realistically deliver',
    'Consider a properly engineered forced-induction or nitrous path only after evaluating short-block capability, cooling, fuel system, drivetrain, traction, applicable rules and ECU protections.',
    'Request a professional combination design and budget before purchasing a turbo or nitrous kit.','Power plan'));
  }else if(asp.includes('turbo')||asp==='supercharged'){
   options.push(issue('upgrade','Forced-induction efficiency and control review',
    'Power gains depend on compressor efficiency, backpressure, intercooling, charge temperatures and boost control—not simply turning up boost.',
    'Inspect charge-temperature trends, verified fuel supply, pressure control, wastegate/boost safety, ignition margin and the torque capacity of the engine/drivetrain before making changes.','Power plan'));
  }else if(asp==='nitrous'){
   options.push(issue('upgrade','Nitrous system support review',
    'A power increase needs a verified fuel and ignition strategy and functioning system interlocks; bottle-pressure alone does not establish safety.',
    'Verify appropriate solenoid/line hardware, bottle-pressure control, progressive enable conditions, independent fuel-pressure protection and a track-oriented professional tune.','Power plan'));
  }
  if(!fields.pumps||!fields.injectors)options.push(issue('verify','Fuel-system capacity not documented',
   'No verified injector/pump hardware flow information was entered; this prevents a credible power-support recommendation.',
   'Record exact part numbers, fuel type, injector characterization and duty logs. Determine real flow at operating differential pressure.','Fuel system'));
  if(!fields.transmission)options.push(issue('verify','Transmission / torque limits not documented',
   'More wheel horsepower can increase drivetrain demand well before a target RPM is reached.',
   'Record transmission model, converter/clutch, fluid temperatures, shift behavior, driveshaft and differential limits.','Drivetrain'));
  if(fields.fuel==='flex'||fields.fuel==='e85')options.push(issue('verify','Ethanol-capable power plan needs verified blend and fueling',
   'Fuel system flow requirement and required stoichiometric calibration depend on the actual fuel blend.',
   'Validate ethanol sensor scaling, injector/fuel capacity, flex blend calibration and matched log evidence.','Fuel system'));
  if(fields.budget)options.push(issue('info','Budget scope entered',
   'Budget tier: '+safeText(fields.budget)+' (labor, fabrication, installation, dyno and contingency are not included in any cost estimate).',
   'Prioritize correcting compatibility and protection issues before buying power parts.','Power plan'));
 }
 const gated=barriers.length>0;
 return {goal:finite(goal)?goal:null,baseline:finite(current)?current:null,barriers,options,gated,
  headline:gated?'HARDWARE / LOG WARNINGS FIRST — added power is not the next step':'Power paths are possibilities, not predicted WHP or approved parts'};
}
function analyzeBuild(build,log,intelligence){
 const fields=cleanFields(build?.fields||build||{}),hardware=analyzeHardware(fields),logReport=analyzeLog(log,intelligence);
 const plan=powerPlan(fields,hardware,logReport);
 const issues=[...hardware.checks,...logReport.alerts];
 const totals={stop:issues.filter(x=>x.severity==='stop').length,verify:issues.filter(x=>x.severity==='verify').length,upgrade:issues.filter(x=>x.severity==='upgrade').length};
 return {fields,hardware,logReport,plan,issues,totals,generatedAt:new Date().toISOString(),
  disclaimer:'BETA screening. This system cannot verify user-entered parts, cam-card lift, spring height/pressure, calibration states or physical measurements. No ECU tune recommendations, guaranteed power figures or safe-operation certification.'};
}
function demo(){
 return {
  name:'EXAMPLE ONLY — .610 cam / .560 springs',year:'2011',make:'Example',model:'LS project',engine:'LS V8 example',
  aspiration:'na',camBasis:'valve',camName:'Illustrative cam — not a product',camInt:'.610',camExh:'.615',
  camCardRatio:'1.70',installedRatio:'1.70',springMaxLift:'.560',
  springPart:'Example spring — max .560 in',rockerType:'stock',rpmLimit:'6700',
  ptvChecked:'unknown',goalWhp:'500',fuel:'91',transmission:'Automatic',
  notes:'Demo only. Replace every field with your actual cam-card and spring manufacturer data.'
 };
}
const sectionOrder=[...new Set(FIELDS.map(x=>x.section))];
const mk=(tag,textValue,cls)=>{
 const e=document.createElement(tag);if(textValue!==undefined&&textValue!==null)e.textContent=String(textValue);if(cls)e.className=cls;return e;
};
const findField=(id)=>FIELDS.find(f=>f.id===id);
function mount(host,getLog){
 if(!host)return null;
 const local=(()=>{try{return root.localStorage||null;}catch(e){return null;}})();
 const initial=readStorage(local),model={
  builds:initial.builds,activeId:initial.activeId,draft:null,
  error:initial.error,dirty:false,importing:false
 };
 const getActive=()=>model.builds.find(x=>x.id===model.activeId)||null;
 model.draft={...blank(),...(getActive()?.fields||{})};
 const formControls={};
 const top=mk('div',null,'garage-top'),header=mk('div',null,'garage-header');
 header.append(mk('h3','MY GARAGE · BUILD BETA'));
 header.append(mk('p','Save complete builds and cam/valvetrain specifications locally. Hardware checks use what YOU entered; log evidence comes from the currently loaded file. No automatic ECU changes.','garage-muted'));
 top.append(header);
 const badges=mk('div',null,'garage-status');top.append(badges);host.replaceChildren();host.append(top);
 const toolbar=mk('div',null,'garage-toolbar');host.append(toolbar);
 const select=mk('select');select.setAttribute('aria-label','Choose saved vehicle build');
 const addButton=(text,fn,cls='ps-btn secondary')=>{const b=mk('button',text,cls);b.type='button';b.onclick=fn;toolbar.append(b);return b;};
 toolbar.append(select);
 const status=mk('p','', 'garage-muted');host.append(status);
 const form=mk('div',null,'garage-form');host.append(form);
 const actions=mk('div',null,'garage-actions');host.append(actions);
 const audit=mk('section',null,'garage-audit');host.append(audit);
 const logs=mk('section',null,'garage-history');host.append(logs);
 const io=mk('input');io.type='file';io.accept='.json,application/json';io.hidden=true;host.append(io);
 const storageMsg=()=>local?'Stored in THIS browser only. Browser deletion/private mode can erase builds; export backups. Raw datalogs and tune files are never saved here.':'Browser storage unavailable; JSON export is required to retain your build.';
 let analysis=null;
 function fieldRow(f){
  const label=mk('label',f.label,'garage-field');
  let input;
  if(f.type==='select'){
   input=mk('select');
   for(const [value,title] of f.options){const option=mk('option',title);option.value=value;input.append(option);}
  }else if(f.type==='textarea'){
   input=mk('textarea');input.rows=4;
  }else{
   input=mk('input');input.type=f.type;input.inputMode=f.type==='number'?'decimal':'text';
   if(f.min!==undefined)input.min=f.min;if(f.max!==undefined)input.max=f.max;if(f.step!==undefined)input.step=f.step;
   if(f.placeholder)input.placeholder=f.placeholder;
  }
  input.name=f.id;input.id='garage-'+f.id;input.value=model.draft[f.id]||'';
  input.addEventListener('input',()=>{
   model.draft[f.id]=input.value;model.dirty=true;status.textContent='Unsaved changes · '+storageMsg();refreshRecommendations();
  });
  input.addEventListener('change',()=>{
   model.draft[f.id]=input.value;model.dirty=true;refreshRecommendations();
  });
  formControls[f.id]=input;label.append(input);return label;
 }
 for(const section of sectionOrder){
  const group=mk('details',null,'garage-section');group.open=section==='Vehicle / project'||section==='Camshaft / timing'||section==='Valvetrain / springs';
  group.append(mk('summary',section));
  const grid=mk('div',null,'garage-grid');for(const f of FIELDS.filter(x=>x.section===section))grid.append(fieldRow(f));
  group.append(grid);form.append(group);
 }
 function refreshInputs(){
  for(const f of FIELDS)formControls[f.id].value=model.draft[f.id]||'';
 }
 function refreshSelect(){
  select.replaceChildren();
  const first=mk('option','Unsaved new build');first.value='';select.append(first);
  for(const b of model.builds){const o=mk('option',b.fields.name||'Untitled build');o.value=b.id;select.append(o);}
  select.value=model.activeId||'';
  badges.replaceChildren();
  const count=mk('span',model.builds.length+' saved build'+(model.builds.length===1?'':'s')+' / '+MAX_BUILDS);
  badges.append(count);
 }
 function refreshRecommendations(){
  analysis=analyzeBuild(model.draft,typeof getLog==='function'?getLog():null,root.RawestSignalIntelligence);
  audit.replaceChildren();
  const h=mk('h3','BUILD COMPATIBILITY · LIVE BETA');audit.append(h);
  const counts=mk('div',null,'garage-metrics');
  const makeStat=(value,label,kind)=>{
   const b=mk('div',null,'garage-metric '+(kind||''));b.append(mk('strong',value),mk('span',label));counts.append(b);
  };
  makeStat(analysis.totals.stop,'Stop / investigate','garage-stop');
  makeStat(analysis.totals.verify,'Needs verification','garage-verify');
  makeStat(analysis.logReport.available?'Linked':'Not linked','Current ECU log');
  makeStat(analysis.plan.gated?'Hold power':'Review options','Power upgrade gate',analysis.plan.gated?'garage-stop':'');
  audit.append(counts);
  if(finite(analysis.hardware.actual))audit.append(mk('p',
   'Calculated max valve lift: '+round(analysis.hardware.actual)+'" · '+analysis.hardware.lift.description,'garage-muted'));
  const item=(entry)=>{
   const card=mk('article',null,'garage-finding severity-'+entry.severity);
   const h=mk('strong',entry.title+' · '+entry.severity.toUpperCase());
   card.append(h,mk('p',entry.explanation),mk('p','NEXT: '+entry.action,'garage-muted'));
   card.append(mk('small',entry.evidence||entry.category));return card;
  };
  for(const c of analysis.issues.filter(x=>x.severity==='stop'))audit.append(item(c));
  const other=mk('details',null,'garage-other-findings');other.open=!analysis.totals.stop;
  other.append(mk('summary','Other compatibility / verification checks ('+analysis.issues.filter(x=>x.severity!=='stop').length+')'));
  for(const c of analysis.issues.filter(x=>x.severity!=='stop'))other.append(item(c));
  audit.append(other);
  const logbox=mk('div',null,'garage-log-context');
  logbox.append(mk('h4','LOG EVIDENCE'),mk('p',analysis.logReport.text));
  for(const n of analysis.logReport.next)logbox.append(mk('p','• '+n,'garage-muted'));
  audit.append(logbox);
  const power=mk('section',null,'garage-power');
  power.append(mk('h3','MORE POWER · BUILD-AWARE OPTIONS'),mk('p',analysis.plan.headline,'garage-muted'));
  for(const p of analysis.plan.options)power.append(item(p));audit.append(power);
  audit.append(mk('p',analysis.disclaimer,'garage-disclaimer'));
 const source=mk('p','Technical reference: COMP Cams Valve Springs 101 · minimum 0.060-inch coil clearance is an illustrative check; follow the actual spring/cam manufacturer and measure the engine.','garage-disclaimer');
 const citation=mk('a','Read valve spring clearance guidance');
 citation.href='https://www.compcams.com/valve-springs-101/';
 citation.target='_blank';citation.rel='noopener noreferrer';
 source.append(citation);audit.append(source);
 }
 function drawHistory(){
  logs.replaceChildren();logs.append(mk('h3','BUILD HISTORY · COMPACT LOG SNAPSHOTS'));
  const active=getActive();
  const history=active?.snapshots||[];
  logs.append(mk('p','Saves only a dated summary of the current parsed log for this build—not raw CSV rows, ECU settings or personal vehicle IDs.','garage-muted'));
  if(!history.length)logs.append(mk('p','No log snapshots saved for this build. Save the build, load a log, then choose Save log snapshot.','garage-muted'));
  for(const snap of [...history].reverse()){
   const entry=mk('div',null,'garage-history-entry');
   entry.append(mk('strong',snap.savedAt||'Saved snapshot'));
   entry.append(mk('span',snap.samples+' rows · '+snap.wotCandidates+' WOT candidates · '+snap.eventCount+' flagged events · '+snap.highPriority+' high-priority findings'));
   entry.append(mk('p',snap.notes,'garage-muted'));logs.append(entry);
  }
 }
 function applySelection(){
  const active=getActive();model.draft={...blank(),...(active?.fields||{})};model.dirty=false;
  refreshSelect();refreshInputs();drawHistory();refreshRecommendations();
  status.textContent=(active?'Editing '+(active.fields.name||'Untitled build'):'New unsaved build')+' · '+storageMsg();
  if(model.error)status.textContent=model.error+' · '+status.textContent;
 }
 function persist(){
  const outcome=saveStorage(local,model.builds,model.activeId);
  if(!outcome.ok){status.textContent=outcome.error;return false;}
  return true;
 }
 const confirmLose=()=>!model.dirty||typeof root.confirm!=='function'||root.confirm('Discard unsaved build changes?');
 select.onchange=()=>{
  if(!confirmLose()){select.value=model.activeId||'';return;}
  model.activeId=select.value||null;applySelection();
 };
 const newBuild=()=>{if(!confirmLose())return;model.activeId=null;model.draft=blank();model.dirty=false;applySelection();};
 const newBtn=addButton('New build',newBuild);
 const demoBtn=addButton('Try .610 / .560 demo',()=>{
  if(!confirmLose())return;
  model.activeId=null;model.draft=demo();model.dirty=true;refreshSelect();refreshInputs();drawHistory();refreshRecommendations();
  status.textContent='DEMO ONLY · .610/.615 lift cam and .560 spring rating. Not saved unless you choose Save build.';
 });
 const saveBtn=addButton('Save build',()=>{
  const fields=cleanFields(model.draft);
  if(!fields.name){status.textContent='Enter a build nickname before saving.';formControls.name.focus();return;}
  let active=getActive();
  if(!active){
   if(model.builds.length>=MAX_BUILDS){status.textContent='Maximum '+MAX_BUILDS+' saved builds; export/delete one first.';return;}
   active={id:ident(),fields,updatedAt:new Date().toISOString(),snapshots:[]};
   model.builds.push(active);model.activeId=active.id;
  }else{active.fields=fields;active.updatedAt=new Date().toISOString();}
  model.dirty=false;model.draft={...blank(),...fields};refreshSelect();
  status.textContent=persist()?'Build saved locally · '+storageMsg():'Save failed; export a backup';
  drawHistory();refreshRecommendations();
 },'ps-btn');
 const delBtn=addButton('Delete build',()=>{
  const selected=getActive();
  if(!selected){status.textContent='No saved build selected.';return;}
  if(typeof root.confirm==='function'&&!root.confirm('Delete saved build "'+(selected.fields.name||'Untitled')+'" from this browser? Export first to keep a backup.'))return;
  model.builds=model.builds.filter(x=>x.id!==selected.id);model.activeId=model.builds[0]?.id||null;
  persist();applySelection();
 });
 const exportBtn=addButton('Export garage JSON',()=>{
  const payload={format:'rawest-signal-garage-backup-v1',version:VERSION,exportedAt:new Date().toISOString(),
   builds:model.builds,activeId:model.activeId,note:'Local build profile and compact log snapshots only. No calibration, CSV, credentials or ECU writes.'};
  try{
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}));
   const a=mk('a');a.href=url;a.download='rawest-signal-my-garage-backup.json';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
   status.textContent='Garage backup exported. This does not include unsaved draft edits.';
  }catch(e){status.textContent='JSON export unavailable in this browser: '+safeText(e.message);}
 });
 const importBtn=addButton('Import garage JSON',()=>io.click());
 io.onchange=async()=>{
  const file=io.files?.[0];if(!file)return;
  if(file.size>512000){status.textContent='Import too large (maximum 500 KB).';io.value='';return;}
  try{
   const data=JSON.parse(await file.text());
   if(data?.format!=='rawest-signal-garage-backup-v1'||data.version!==VERSION||!Array.isArray(data.builds)||data.builds.length>MAX_BUILDS)throw Error('Not a compatible RAWEST SIGNAL Garage v1 JSON backup.');
   if(typeof root.confirm==='function'&&!root.confirm('Replace all saved builds in this browser with the imported garage backup? Export a backup first.')){io.value='';return;}
   const seen=new Set();const next=[];
   for(const row of data.builds){
    const b=cleanBuild(row);if(!b||seen.has(b.id))throw Error('Duplicate or invalid build identifier.');
    seen.add(b.id);next.push(b);
   }
   model.builds=next;model.activeId=next.find(x=>x.id===data.activeId)?.id||next[0]?.id||null;
   if(persist())applySelection();else status.textContent='Imported on screen but could not persist. Export a fresh backup.';
  }catch(e){status.textContent='Import rejected: '+safeText(e.message);}
  io.value='';
 };
 const snapshotBtn=addButton('Save log snapshot',()=>{
  const active=getActive();
  if(!active){status.textContent='Save/select a build first before attaching a compact log snapshot.';return;}
  if(model.dirty){status.textContent='Save your build edits first, then save a log snapshot.';return;}
  const report=analyzeLog(typeof getLog==='function'?getLog():null,root.RawestSignalIntelligence);
  if(!report.available){status.textContent='No valid log linked. Import a current log under Analyze first.';return;}
  const snap=safeSnapshot({savedAt:new Date().toISOString(),samples:report.samples,
   wotCandidates:report.wotCandidates,eventCount:report.events,highPriority:report.high,
   notes:report.lean+' high-load lean review event(s) detected in this log. Hardware fit has not been validated by log data.'});
  active.snapshots.push(snap);active.snapshots=active.snapshots.slice(-MAX_SNAPSHOTS);
  active.updatedAt=new Date().toISOString();
  if(persist()){drawHistory();status.textContent='Compact log snapshot saved locally (no CSV or raw ECU data stored).';}
 },'ps-btn secondary');
 const jsonBtn=addButton('Export compatibility report',()=>{
  const buildReport=analyzeBuild(model.draft,typeof getLog==='function'?getLog():null,root.RawestSignalIntelligence);
  const backup={format:'rawest-signal-build-review-beta',generatedAt:new Date().toISOString(),
   build:{name:buildReport.fields.name||'Unsaved build',fields:buildReport.fields},
   compatibility:buildReport.hardware,logContext:buildReport.logReport,upgradeOptions:buildReport.plan,
   disclaimer:buildReport.disclaimer};
  try{
   const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json;charset=utf-8'}));
   const a=mk('a');a.href=url;a.download='rawest-signal-build-compatibility-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){status.textContent='Report export unavailable: '+safeText(e.message);}
 });
 const api={refresh(){refreshRecommendations();drawHistory();},getActive:()=>getActive(),getDraft:()=>({...model.draft}),
  getSaved:()=>model.builds.map(x=>({id:x.id,fields:{...x.fields},snapshots:[...x.snapshots]})),
  analysis:()=>analysis};
 applySelection();
 return api;
}
root.RawestGarageBeta={version:'3.2.0-beta.1',FIELDS,cleanFields,cleanBuild,readStorage,saveStorage,valveLift,analyzeHardware,analyzeLog,powerPlan,analyzeBuild,demo,mount};
})(typeof window!=='undefined'?window:globalThis);
