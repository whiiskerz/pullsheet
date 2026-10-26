/* RAWEST SIGNAL / v3.0 Calibration Intelligence
 * Local-only, read-only evidence. Never invents MaxxECU table formats, axes or units.
 * Nothing here writes, modifies or produces an ECU-ready calibration.
 */
(function(root){
'use strict';
const finite=Number.isFinite;
const num=v=>v===null||v===undefined||v===''?NaN:Number(v);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const text=(value)=>String(value??'');
const normalized=(value)=>text(value).trim().toLowerCase().replace(/[_\s-]+/g,' ');
const exactNumeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const numericSequence=/^[\s,;|+.\dEe-]+$/;
const escapeCsv=v=>'"'+text(v).replace(/"/g,'""')+'"';
const settingValue=(settings,key)=>{
 if(!settings||!key||!settings.has(key))return {error:'No matching, exact XML setting key.'};
 const values=settings.get(key);
 if(!Array.isArray(values)||values.length!==1)return {error:'This setting has '+(values?.length||0)+' XML entries. Repeated or ambiguous encodings cannot be interpreted as one axis/table.'};
 return {raw:values[0]};
};
function parseVector(settings,key,minimum=2,maximum=4096){
 const v=settingValue(settings,key);if(v.error)return v;
 const raw=text(v.raw).trim();
 if(!raw||raw.length>200000||!numericSequence.test(raw))return {error:'Setting is not a plain numeric list. Encoded, labeled and compressed values are not decoded or guessed.'};
 const fields=raw.split(/[\s,;|]+/).filter(Boolean);
 if(fields.length<minimum||fields.length>maximum)return {error:'Requires '+minimum+'–'+maximum+' plain numeric elements; found '+fields.length+'.'};
 if(fields.some(x=>!exactNumeric.test(x)))return {error:'The setting contains nonnumeric/ambiguous values.'};
 const vector=fields.map(Number);
 if(!vector.every(finite))return {error:'Invalid numeric values.'};
 return {vector,raw};
}
const strictlyIncreasing=x=>x.every((v,i)=>!i||v>x[i-1]);
function verifyAxis(settings,key,kind,unit){
 const value=parseVector(settings,key,2,128);
 if(value.error)return {error:kind+' axis: '+value.error};
 const arr=value.vector;
 if(!strictlyIncreasing(arr))return {error:kind+' axis must be strictly increasing in the selected physical unit.'};
 if(kind==='RPM'){
  if(unit!=='rpm')return {error:'RPM axis unit must be RPM.'};
  if(arr[0]<0||arr[arr.length-1]>20000)return {error:'RPM axis values outside plausible engine range; verify the original setting and scaling.'};
 } else {
  if(!['kpa-absolute','psia'].includes(unit))return {error:'Load axis must explicitly be absolute kPa or absolute PSI (PSIA).'};
  const mapInKpa=unit==='psia'?arr.map(v=>v/0.1450377377):arr;
  if(mapInKpa[0]<5||mapInKpa[mapInKpa.length-1]>600)return {error:'MAP axis outside 5–600 kPa absolute. Could be gauge pressure, raw encoding or the wrong axis.'};
 }
 return {...value,unit};
}
function verifyTable(settings,{rpmKey,loadKey,valuesKey,loadUnit,layout,confirmed},opts={}){
 if(!confirmed)return {error:'Confirm you personally verified the table identity, axis settings, orientation and load units in MTune.'};
 if(!rpmKey||!loadKey||!valuesKey||new Set([rpmKey,loadKey,valuesKey]).size!==3)
  return {error:'Select three distinct, exact XML settings for RPM axis, MAP axis, and table values.'};
 if(!['rpm-rows','load-rows'].includes(layout))return {error:'Select which verified axis corresponds to the matrix rows.'};
 const rpm=verifyAxis(settings,rpmKey,'RPM','rpm');if(rpm.error)return rpm;
 const load=verifyAxis(settings,loadKey,'MAP',loadUnit);if(load.error)return load;
 const cells=rpm.vector.length*load.vector.length;
 if(cells>4096)return {error:'Table dimensions exceed the supported, inspectable 4,096 cells.'};
 const values=parseVector(settings,valuesKey,cells,cells);
 if(values.error)return {error:'Table value shape: '+values.error+' Expected '+rpm.vector.length+' × '+load.vector.length+' = '+cells+' numeric values in verified '+layout+' orientation.'};
 if(values.vector.length!==cells)return {error:'Number of table cells does not match the verified axes.'};
 if(opts.maxValue!==undefined&&values.vector.some(v=>v>opts.maxValue))return {error:'Table values outside verified expected scale.'};
 return {rpm:rpm.vector,load:load.vector,values:values.vector,loadUnit,layout,rpmKey,loadKey,valuesKey,cellCount:cells,
  verification:'Manual axis/unit/orientation confirmation + strict numeric vector/shape validation. This does not prove the engine uses this table at the event.'};
}
function bracket(axis,x){
 if(!finite(x)||!axis||axis.length<2)return null;
 if(x<axis[0]||x>axis[axis.length-1])return null;
 for(let i=0;i<axis.length;i++)if(x===axis[i])return [i,i];
 for(let i=0;i<axis.length-1;i++)if(x>axis[i]&&x<axis[i+1])return [i,i+1];
 return null;
}
function mapEvent(table,event,mapSource){
 if(!table||table.error)return {error:'Select and verify a readable table first.'};
 if(!event||!finite(event.rpm)||!finite(event.map))return {error:'Event lacks measured RPM or MAP.'};
 if(mapSource?.method!=='MaxxECU ID'||!/^\s*MAP\s*\[20\]\s*$/i.test(text(mapSource.name)))
  return {error:'MAP channel was not independently verified as standard MaxxECU MAP [20]. Select a validated log channel first.'};
 const load=table.loadUnit==='psia'?event.map*.1450377377:event.map;
 const rpmIndices=bracket(table.rpm,event.rpm),loadIndices=bracket(table.load,load);
 if(!rpmIndices||!loadIndices)return {error:'Event RPM or absolute MAP is outside the verified table axes. No extrapolation or guessed cell lookup.'};
 const cells=[],seen=new Set();
 for(const r of rpmIndices)for(const l of loadIndices){
  const index=table.layout==='rpm-rows'?r*table.load.length+l:l*table.rpm.length+r;
  if(seen.has(index))continue;seen.add(index);
  cells.push({rpm:table.rpm[r],load:table.load[l],value:table.values[index],row:table.layout==='rpm-rows'?r:l,
   col:table.layout==='rpm-rows'?l:r,index});
 }
 return {rpm:event.rpm,load,loadUnit:table.loadUnit,cells,rpmBracket:rpmIndices,loadBracket:loadIndices,
  note:'Surrounding stored cells only. No interpolation, VE correction, or tune recommendation. Active table blending, enrichment and correction states remain unverified.'};
}
function diffSettings(a,b){
 if(!a?.settings)return [];
 const keys=new Set([...a.settings.keys(),...(b?.settings?[...b.settings.keys()]:[])]);
 const changes=[];
 for(const key of keys){
  const before=a.settings.get(key),after=b?.settings.get(key);
  if(!b)continue;
  if(JSON.stringify(before)===JSON.stringify(after))continue;
  const category=!before?'ADDED':!after?'REMOVED':'CHANGED';
  let delta=null,percent=null;
  if(before?.length===1&&after?.length===1&&exactNumeric.test(text(before[0]).trim())&&exactNumeric.test(text(after[0]).trim())){
   const old=Number(before[0]),now=Number(after[0]);
   if(finite(old)&&finite(now)){
    delta=now-old;percent=old!==0?100*delta/Math.abs(old):null;
   }
  }
  changes.push({key,before:before||[],after:after||[],category,delta,percent,attention:classifyKey(key)});
 }
 return changes.sort((x,y)=>{
  const order={protection:0,fuel:1,ignition:2,flex:3,launch:4,idle:5,other:6};
  return order[x.attention]-order[y.attention]||x.key.localeCompare(y.key);
 });
}
function classifyKey(name){
 const n=normalized(name);
 if(/(?:oil.*press|fuel.*press|knock|rev.*limit|cut.*limit|overtemp|overheat|clt.*limit|coolant.*limit|engine.*protect|safet|fail.?safe|fault)/i.test(n))return 'protection';
 if(/(?:ve\b|volumetric|fuel.*table|fuel.*map|inject|lambda|afr|fuel.*comp|fuel.*cut|fuel.*pump)/i.test(n))return 'fuel';
 if(/(?:ignition|spark|timing|dwell|advance|retard)/i.test(n))return 'ignition';
 if(/(?:ethanol|flex.?fuel|stoich|fuel.*blend)/i.test(n))return 'flex';
 if(/(?:launch|2.step|clutch|brake|gear|shift|transbrake)/i.test(n))return 'launch';
 if(/(?:idle|iac|stall|crank|warmup|startup)/i.test(n))return 'idle';
 return 'other';
}
const candidateCache=new WeakMap();
function candidateKeys(settings,role){
 if(!settings)return [];
 const cached=candidateCache.get(settings)||{};
 if(cached[role])return cached[role];
 const output=[];
 for(const [key] of settings){
  const p=parseVector(settings,key,role==='values'?4:2,role==='values'?4096:128);
  if(p.error)continue;
  if(role!=='values'&&!strictlyIncreasing(p.vector))continue;
  output.push({key,n:p.vector.length});
 }
 const sorted=output.sort((a,b)=>a.key.localeCompare(b.key));
 cached[role]=sorted;candidateCache.set(settings,cached);
 return sorted;
}
function eventInventory(log,goal){
 const engine=root.RawestSignalIntelligence;
 if(!engine||!log)return {events:[],map:null,note:'Load a log to see exact event context.'};
 const result=engine.analyze(log,{pressureUnit:'auto'});
 if(result.error)return {events:[],map:null,note:result.error};
 const focused=engine.forGoal(result.events,log,goal||'wot');
 const all=goal==='idle'?focused:focused.length?focused:result.events;
 return {events:all.slice(0,30),map:result.entries.map,
  note:(goal==='idle'?'Idle windows must be matched only to verified idle-control tables. ':'')+
   result.events.length+' flagged full-log events, '+focused.length+' in the selected workflow. Event-to-table links require separate manual axis verification.'};
}
function protectionEvidence(d){
 if(!d||!Array.isArray(d.rpm))return {error:'No current engine log is loaded. Protection settings can still be inspected as raw XML.'};
 const mapped=key=>Number.isInteger(d.sourceColumns?.[key])&&d.sourceColumns[key]>=0;
 const at=(key,i)=>Array.isArray(d[key])?num(d[key][i]):NaN;
 const units=root.RawestSignalUnits;
 const oilInfo=units?.describe(d,'oilPress')||null,fuelInfo=units?.describe(d,'fuelPress')||null;
 let rpmSamples=0,loadSamples=0,knockCount=0,warningCount=0,maxCoolant=-Infinity,minOilPsi=Infinity,minFuelPsi=Infinity;
 for(let i=0;i<d.rpm.length;i++){
  const rpm=at('rpm',i),tps=at('tps',i);
  if(!finite(rpm)||rpm<800)continue;rpmSamples++;
  const f=finite(at('coolantF',i))?at('coolantF',i):units?.fahrenheitFromC(at('coolant',i));
  if(finite(f))maxCoolant=Math.max(maxCoolant,f);
  if(mapped('knock')&&at('knock',i)>0)knockCount++;
  if(mapped('warnings')&&at('warnings',i)>0)warningCount++;
  if(!(rpm>=1500&&finite(tps)&&tps>=40))continue;loadSamples++;
  const fuel=at('fuelPress',i),oil=at('oilPress',i);
  if(fuelInfo?.canShowPsi&&finite(fuel)&&fuel>0)minFuelPsi=Math.min(minFuelPsi,fuelInfo.psi(fuel));
  if(oilInfo?.canShowPsi&&finite(oil)&&oil>0)minOilPsi=Math.min(minOilPsi,oilInfo.psi(oil));
 }
 const minOrNull=x=>x===Infinity?null:x,maxOrNull=x=>x===-Infinity?null:x;
 const notes=[
  'Operating samples (RPM ≥800): '+rpmSamples+'; loaded samples (RPM ≥1,500, TPS ≥40%): '+loadSamples+'.',
  'Highest logged coolant temperature while running: '+(maxCoolant>-Infinity?maxCoolant.toFixed(1)+' °F':'not available')+'. Verify coolant sensor calibration.',
  'Lowest positive fuel pressure in loaded samples: '+(minFuelPsi<Infinity?minFuelPsi.toFixed(1)+' PSI':'PSI unavailable / no valid loaded samples')+'. Verify input scale, regulator reference and expected behavior.',
  'Lowest positive oil pressure in loaded samples: '+(minOilPsi<Infinity?minOilPsi.toFixed(1)+' PSI':'PSI unavailable / no valid loaded samples')+'. Verify pressure sensor and warm-oil operation.',
  mapped('knock')?knockCount+' running sample(s) with a positive mapped knock signal. Signal meaning and protection strategy unverified.':'Knock input is not confidently mapped; detection status cannot be determined.',
  mapped('warnings')?warningCount+' running sample(s) with a positive mapped ECU warning. A zero reading does not prove protections were enabled.':'ECU warning input is not confidently mapped; detection status cannot be determined.',
  d.sourceFormat==='holley'?'Holley source logged: telemetry context only; MaxxECU-specific table and protection meanings cannot be inferred.':'MaxxECU log channels still require sensor configuration and engine protection settings to be verified in MTune.',
  'These are recorded observations—not verified configured protection limits or proof of intervention. Never infer protection engagement from XML keywords.'
 ];
 return {rpmSamples,loadSamples,knockCount:mapped('knock')?knockCount:null,warningCount:mapped('warnings')?warningCount:null,
  maxCoolantF:maxOrNull(maxCoolant),minFuelPsi:minOrNull(minFuelPsi),minOilPsi:minOrNull(minOilPsi),notes};
}
function element(tag,value,cls){
 const e=document.createElement(tag);
 if(value!==undefined&&value!==null)e.textContent=text(value);
 if(cls)e.className=cls;
 return e;
}
const state={original:null,compare:null,log:null,binding:{rpmKey:'',loadKey:'',valuesKey:'',loadUnit:'',layout:'',confirmed:false},selection:'',pane:'overview'};
function selectField(label,choices,value,changed){
 const outer=element('label',label,'signal-cal-label'),input=element('select');
 const option=element('option','Select verified XML setting');option.value='';input.append(option);
 for(const c of choices){const o=element('option',c.key+' · '+c.n+' numbers');o.value=c.key;input.append(o);}
 input.value=choices.some(c=>c.key===value)?value:'';
 input.onchange=()=>changed(input.value);
 outer.append(input);return outer;
}
function render(host,original,compare,log,goal){
 if(!host)return;
 const changed=state.original!==original||state.compare!==compare;
 if(changed){
  state.original=original;state.compare=compare;
  state.binding={rpmKey:'',loadKey:'',valuesKey:'',loadUnit:'',layout:'',confirmed:false};
  state.selection='';
 }
 state.log=log;
 host.replaceChildren();
 const area=element('div');area.className='signal-calibration-intelligence';
 area.append(element('h3','MTUNE CALIBRATION INTELLIGENCE · v3.0'));
 const intro=element('p','Genuine .MaxxECU-save XML only · exact key and revision comparison · optional manually verified axis-to-log lookup · entirely read-only.');
 intro.className='signal-cal-note';area.append(intro);
 if(!original){
  area.append(element('p','Load an original .MaxxECU-save above to inspect exact ECUSettingsItem names, protection-related settings, revision differences and manually validated table cells. No tune is currently loaded.'));
  const warning=element('p','The current log cannot tell us which fuel or ignition table cell is active without verified calibration data.');
  warning.className='signal-cal-warning';area.append(warning);host.append(area);return;
 }
 const settings=original.settings;
 const changes=diffSettings(original,compare),categorized={};
 for(const [key] of settings){const category=classifyKey(key);categorized[category]=(categorized[category]||0)+1;}
 const summary=element('div');summary.className='signal-cal-metrics';
 for(const [title,value] of [['Original XML settings',settings.size],['Revision changes',compare?changes.length:'Not loaded'],
  ['Protection keyword matches',categorized.protection||0],['Axis-readable candidates',candidateKeys(settings,'axis').length]]){
  const item=element('div');item.append(element('strong',value));item.append(element('span',title));summary.append(item);
 }
 area.append(summary);
 const privacy=element('p','Only actual XML values from your uploaded calibration are shown. Keyword classifications are SEARCH HINTS, not proof of setting purpose or protection activity.');
 privacy.className='signal-cal-note';area.append(privacy);
 const panes=element('div');panes.className='signal-cal-panes';
 const tabs=element('div');tabs.className='signal-cal-tabs';
 const content=element('div');content.className='signal-cal-content';
 panes.append(tabs,content);area.append(panes);
 const panels=[['overview','Exact setting'],['changes','Revision audit'],['protections','Protection settings'],['table','Verified table crosswalk']];
 function drawPane(){
  tabs.replaceChildren();content.replaceChildren();
  for(const [id,label] of panels){
   const btn=element('button',label);btn.type='button';btn.className='signal-cal-tab';
   btn.setAttribute('aria-pressed',String(state.pane===id));
   btn.onclick=()=>{state.pane=id;drawPane();};tabs.append(btn);
  }
  if(state.pane==='overview')drawOverview();
  if(state.pane==='changes')drawDiff();
  if(state.pane==='protections')drawProtections();
  if(state.pane==='table')drawTable();
 }
 const writeValue=(parent,label,values)=>{
  const outer=element('div');outer.className='signal-cal-raw';
  outer.append(element('strong',label));
  const pre=element('pre',!values?'Not present in this revision':values.join('\n\n'));
  if(pre.textContent.length>30000){pre.textContent=pre.textContent.slice(0,30000)+'\n[Preview truncated at 30,000 characters; export comparison JSON for full raw entries.]';}
  outer.append(pre);parent.append(outer);
 };
 function drawOverview(){
  const input=element('input');input.type='search';input.placeholder='Exact setting name, fuel, knock, lambda, launch…';
  input.value=state.search||'';input.className='signal-cal-search';content.append(input);
  const matches=element('div');content.append(matches);
  function update(){
   state.search=input.value||'';
   matches.replaceChildren();
   const q=normalized(state.search);
   const keys=[...settings.keys()].filter(k=>!q||normalized(k).includes(q)).slice(0,60);
   matches.append(element('p',keys.length+' settings shown. Select a key to display the unmodified raw XML values.'));
   for(const key of keys){
    const b=element('button',key,'signal-cal-key');b.type='button';
    b.onclick=()=>{state.selection=key;showSelection();};matches.append(b);
   }
   showSelection();
  }
  const selected=element('section');selected.className='signal-cal-selection';content.append(selected);
  function showSelection(){
   selected.replaceChildren();
   if(!state.selection||!settings.has(state.selection))return;
   selected.append(element('h4','EXACT SETTING · '+state.selection));
   selected.append(element('p','Classification hint: '+classifyKey(state.selection)+'. XML setting name and bytes are read-only; purpose and units require validation in MTune.'));
   writeValue(selected,'Original XML value(s)',settings.get(state.selection));
   if(compare)writeValue(selected,'Compared revision value(s)',compare.settings.get(state.selection));
  }
  input.oninput=update;update();
 }
 function drawDiff(){
  if(!compare){content.append(element('p','Load the second revision above for a change-by-change audit. The original tune is unchanged.'));return;}
  const safe=element('p','Added, removed and changed XML keys are compared EXACTLY. Numeric deltas are shown only for unambiguous scalar numbers, in their raw units. This does not prove that an ECU table or safety limit changed.');
  safe.className='signal-cal-note';content.append(safe);
  const search=element('input');search.placeholder='Find an exact changed setting';search.type='search';search.className='signal-cal-search';
  content.append(search);
  const listing=element('div');content.append(listing);
  function drawChanges(){
   listing.replaceChildren();
   const matched=changes.filter(c=>normalized(c.key).includes(normalized(search.value))).slice(0,80);
   listing.append(element('p',changes.length+' total changed setting keys · '+matched.length+' shown.'));
   for(const change of matched){
    const d=element('details');d.className='signal-cal-diff';
    const label=change.category+' · '+change.key+' · '+change.attention+' keyword category';
    d.append(element('summary',label));
    if(change.delta!==null)d.append(element('p','Raw numeric change: '+change.delta.toPrecision(6)+(change.percent!==null?' ('+change.percent.toFixed(2)+'% relative to |original|)':'')+'. Unit and meaning NOT verified.'));
    writeValue(d,'Original entry/entries',change.before?.length?change.before:null);
    writeValue(d,'Compared entry/entries',change.after?.length?change.after:null);
    listing.append(d);
   }
  }
  search.oninput=drawChanges;drawChanges();
 }
 function drawProtections(){
  const evidence=protectionEvidence(log);
  const logPanel=element('section');logPanel.className='signal-cal-selection';
  logPanel.append(element('h4','ENGINE PROTECTION EVIDENCE · CURRENT LOG'));
  if(evidence.error)logPanel.append(element('p',evidence.error));
  else{const ul=element('ul');for(const note of evidence.notes)ul.append(element('li',note));logPanel.append(ul);}
  content.append(logPanel);
  const keys=[...settings.keys()].filter(key=>classifyKey(key)==='protection');
  content.append(element('p','These are keyword-matched settings. A setting name alone does NOT establish whether protection is enabled, configured, or triggered. Check the actual ECU strategy in MTune and the corresponding log state.'));
  const list=element('div');content.append(list);
  if(!keys.length){list.append(element('p','No protection-related XML setting names recognized. This does not indicate that ECU safety features are absent.'));return;}
  for(const key of keys.slice(0,70)){
   const d=element('details');d.className='signal-cal-diff';
   d.append(element('summary',key+(compare&&JSON.stringify(settings.get(key))!==JSON.stringify(compare.settings.get(key))?' · REVISION CHANGED':'')));
   writeValue(d,'Original raw setting',settings.get(key));
   if(compare)writeValue(d,'Compared raw setting',compare.settings.get(key));
   list.append(d);
  }
  if(keys.length>70)content.append(element('p','Showing 70 keyword matches. Search exact names in the Calibration Explorer to examine the rest.'));
 }
 function drawTable(){
  const warning=element('p','MANUAL VALIDATION REQUIRED: Confirm in MTune that these three exact XML keys are the real RPM axis, absolute-MAP axis and table cells, plus the row order. Plain numeric sequences must match exactly. No auto-mapping by name. No interpolation. NO VE or timing edit advice.');
  warning.className='signal-cal-warning';content.append(warning);
  const numericAxes=candidateKeys(settings,'axis'),numericValues=candidateKeys(settings,'values');
  const form=element('div');form.className='signal-cal-grid';
  const refresh=()=>{state.binding.confirmed=false;drawPane();};
  form.append(selectField('RPM axis · exact XML key',numericAxes,state.binding.rpmKey,v=>{state.binding.rpmKey=v;refresh();}));
  form.append(selectField('Absolute MAP axis · exact XML key',numericAxes,state.binding.loadKey,v=>{state.binding.loadKey=v;refresh();}));
  form.append(selectField('Table values · exact XML key',numericValues,state.binding.valuesKey,v=>{state.binding.valuesKey=v;refresh();}));
  const settingsList=[
   ['loadUnit','MAP axis unit',[['','Select confirmed physical unit'],['kpa-absolute','kPa ABSOLUTE (in the MTune source)'],['psia','PSI ABSOLUTE / PSIA (in the MTune source)']]],
   ['layout','Verified matrix arrangement',[['','Select confirmed row orientation'],['rpm-rows','Rows = RPM, columns = MAP'],['load-rows','Rows = MAP, columns = RPM']]]
  ];
  for(const [name,label,choices] of settingsList){
   const item=element('label',label,'signal-cal-label'),select=element('select');
   for(const [value,title] of choices){const option=element('option',title);option.value=value;select.append(option);}
   select.value=state.binding[name];select.onchange=()=>{state.binding[name]=select.value;refresh();};item.append(select);form.append(item);
  }
  content.append(form);
  const ack=element('label','I checked the actual MTune table identity, axes, units and row orientation. I understand this only shows surrounding stored cells, not active fueling corrections.','signal-cal-confirm');
  const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=state.binding.confirmed;
  checkbox.onchange=()=>{state.binding.confirmed=!!checkbox.checked;drawPane();};
  ack.prepend(checkbox);content.append(ack);
  const verdict=verifyTable(settings,state.binding);
  const diagnostic=element('div');diagnostic.className='signal-cal-status';
  if(verdict.error){diagnostic.append(element('p','NOT VERIFIED · '+verdict.error));content.append(diagnostic);return;}
  diagnostic.append(element('strong','TABLE SHAPE VALIDATED · '+verdict.rpm.length+' RPM × '+verdict.load.length+' MAP · '+verdict.cellCount+' read-only cells'));
  diagnostic.append(element('p',verdict.verification));
  content.append(diagnostic);
  const logInfo=eventInventory(log,goal);
  content.append(element('p',logInfo.note));
  if(!log){content.append(element('p','Load the MaxxECU log in Analyze to link event RPM and MAP.'));return;}
  const select=element('select');select.setAttribute('aria-label','Choose an exact logged event');
  for(const [i,event] of logInfo.events.entries()){
   const option=element('option',(i+1)+'. '+event.kind+' · row '+(event.a+1)+'–'+(event.b+1)+' · '+Math.round(event.rpm)+' RPM');
   option.value=String(i);select.append(option);
  }
  content.append(select);
  const display=element('div');display.className='signal-cal-match';content.append(display);
  function showMapped(){
   display.replaceChildren();
   const event=logInfo.events[Number(select.value||0)];
   if(!event){display.append(element('p','No applicable events with independently validated RPM and MAP. The table remains viewable as XML values only.'));return;}
   const match=mapEvent(verdict,event,logInfo.map);
   if(match.error){display.append(element('p','NO VERIFIED CELL MATCH · '+match.error));return;}
   display.append(element('h4','Stored cells near logged event '+(event.a+1)+'–'+(event.b+1)));
   const asPsia=value=>match.loadUnit==='psia'?value:value*0.1450377377;
   display.append(element('p','Logged '+Math.round(match.rpm)+' RPM · '+asPsia(match.load).toFixed(2)+' PSIA. The original source axis uses '+(match.loadUnit==='psia'?'PSIA':'kPa absolute converted to PSIA for display')+'.'));
   const table=element('table');table.className='signal-cal-cell-table';
   const head=element('tr');for(const title of ['RPM axis','MAP (PSIA)','Original stored value','Revision stored value'])head.append(element('th',title));table.append(head);
   const alt=compare?verifyTable(compare.settings,state.binding):null;
   const comparable=alt&&!alt.error&&JSON.stringify(alt.rpm)===JSON.stringify(verdict.rpm)&&JSON.stringify(alt.load)===JSON.stringify(verdict.load);
   for(const cell of match.cells){
    const tr=element('tr');
    const current=comparable?alt.values[cell.index]:null;
    for(const value of [cell.rpm,asPsia(cell.load).toFixed(2),cell.value,current===null?'Not verified / mismatched axes':current])tr.append(element('td',value));
    table.append(tr);
   }
   display.append(table);display.append(element('p',match.note));
   if(compare&&!comparable)display.append(element('p','Revision table axes or numeric encoding do not match exactly. Comparison cells are withheld.'));
  }
  select.onchange=showMapped;showMapped();
 }
 drawPane();host.append(area);
}
root.RawestCalibrationIntelligence={parseVector,verifyAxis,verifyTable,mapEvent,diffSettings,classifyKey,candidateKeys,eventInventory,protectionEvidence,render,version:'3.0.0'};
})(typeof window!=='undefined'?window:globalThis);
