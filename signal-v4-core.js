/* RAWEST SIGNAL 4.0 — deterministic presentation helpers (no ECU writes, no API calls). */
(function(root){
'use strict';
const good=Number.isFinite;
const fmt=(n,d=1)=>good(n)?Number(n).toFixed(d):'not available';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const kinds={
'LEAN':{name:'Lean mixture indication',meaning:'Measured lambda was higher than the logged target during this event. Verify both channels, wideband response, fuel cut and load before interpreting the cause.'},
'RICH':{name:'Rich mixture indication',meaning:'Measured lambda was lower than the logged target. Transients, fuel cut and ECU corrections can affect interpretation.'},
'PRESSURE DIP':{name:'Fuel pressure dropped relative to this log',meaning:'Several pressure readings were low compared with the log running median. This is NOT a confirmed fuel-system failure or a differential-pressure assessment.'},
'KNOCK':{name:'Knock-related signal recorded',meaning:'A positive knock-related signal was logged. Verify the sensor, ECU decoding and engine protection; this alone does not establish detonation.'},
'ECU WARNING':{name:'ECU warning recorded',meaning:'A warning indicator appeared in the log. Inspect the real ECU faults and protection configuration.'}
};
function eventLabel(e){return kinds[e?.kind]?.name||String(e?.kind||'Logged event');}
function eventSummary(e){
 if(!e)return 'Select a recorded event to see what happened.';
 const def=kinds[e.kind];
 const evidence=['Rows '+(e.a+1)+'–'+(e.b+1)];
 if(good(e.rpm))evidence.push(fmt(e.rpm,0)+' RPM');
 if(good(e.tps))evidence.push(fmt(e.tps,0)+'% throttle');
 if(good(e.duration))evidence.push('approx. '+fmt(e.duration,2)+' s');
 return (def?.meaning||'This event was identified from recorded measurements; review its context.')+' '+evidence.join(' · ')+'.';
}
function selectEvents(report,max=30){
 if(!Array.isArray(report?.events))return [];
 return report.events.filter(e=>good(e.a)&&good(e.b)&&e.a>=0&&e.b>=e.a)
  .sort((a,b)=>({HIGH:0,REVIEW:1,CONTEXT:2}[a.priority]??3)-({HIGH:0,REVIEW:1,CONTEXT:2}[b.priority]??3)||(b.score||0)-(a.score||0)||a.a-b.a)
  .slice(0,clamp(max,1,80));
}
const channels=[
 {id:'cfgRPM',label:'RPM',rules:[/^rpm\s*\[\d+\]$/i,/^engine speed(?:\s*\[\d+\])?$/i]},
 {id:'cfgTPS',label:'Throttle',rules:[/^throttle position\s*\[\d+\]$/i,/^tps\s*\[\d+\]$/i]},
 {id:'cfgLambda',label:'Actual lambda',rules:[/^lambda\s*\[\d+\]$/i,/^lambda 1\s*\[\d+\]$/i,/^lambda actual\s*\[\d+\]$/i]},
 {id:'cfgTargetLambda',label:'Target lambda',rules:[/^lambda target\s*\[\d+\]$/i,/^target lambda\s*\[\d+\]$/i]},
 {id:'cfgFuel',label:'Fuel pressure',rules:[/^primary fuel pressure\s*\[\d+\]$/i,/^fuel pressure\s*\[\d+\]$/i]},
 {id:'cfgOil',label:'Oil pressure',rules:[/^oil pressure\s*\[\d+\]$/i,/^oilpress\s*\[\d+\]$/i]},
 {id:'cfgCoolant',label:'Coolant temperature',rules:[/^coolant (?:temp|temperature)\s*\[\d+\]$/i]},
 {id:'cfgAFR',label:'Actual AFR',rules:[/^afr\s*\[\d+\]$/i,/^air\/fuel ratio(?:\s*\[\d+\])?$/i]},
 {id:'cfgTargetAFR',label:'Target AFR',rules:[/^target afr\s*\[\d+\]$/i,/^afr target\s*\[\d+\]$/i]},
 {id:'cfgBattery',label:'Battery voltage',rules:[/^battery voltage\s*\[\d+\]$/i]},
 {id:'cfgVSS',label:'Vehicle speed',rules:[/^vss speed\s*\[\d+\]$/i,/^vehicle speed\s*\[\d+\]$/i]},
 {id:'cfgEthanol',label:'Ethanol content',rules:[/^ethanol (?:concentration|concentration used)\s*\[\d+\]$/i]}
];
function suggestions(headers){
 const list=Array.isArray(headers)?headers:[];
 return channels.map(item=>{
  const matching=[];
  for(let i=0;i<list.length;i++)if(item.rules.some(re=>re.test(String(list[i]).trim())))matching.push({index:i,name:String(list[i]).slice(0,130)});
  return {id:item.id,label:item.label,candidates:matching,unique:matching.length===1,ambiguous:matching.length>1};
 });
}
function answer(question,e,diagnosis,report){
 const q=String(question||'').toLowerCase();
 if(!e)return {title:'Import a real log first',body:'SIGNAL Guide uses recorded events—not example data. Add an actual log and select a flagged moment.',evidence:[],next:[]};
 const h=Array.isArray(diagnosis?.hypotheses)?diagnosis.hypotheses:[];
 const pick=id=>h.find(x=>x.id===id);
 let item=null,title='What this log shows';
 if(/pressure|pump|fuel rail|injector/.test(q)){item=pick('fuel-pressure')||pick('relative-drop');title='About fuel pressure';}
 else if(/lambda|afr|lean|rich|mixture|wideband/.test(q)){item=pick('transient')||pick('base-fueling');title='About your fuel mixture';}
 else if(/knock|timing|spark|warning/.test(q)){item=pick('protection-state');title='About the ECU indication';}
 else if(/correction|trim|closed.loop/.test(q)){item=pick('feedback');title='About correction and feedback';}
 else if(/next|check|fix|what do/.test(q)){item=h.find(x=>Array.isArray(x.checks)&&x.checks.length);title='What to check next';}
 const observed=item?.observed||[];
 const next=item?.checks||[];
 const missing=item?.missing||[];
 let body=eventSummary(e);
 if(item){body+=' Possible explanation to investigate: '+item.title+'. This is a hypothesis, not a confirmed cause.';}
 if(!item&&q.trim())body+=' The log does not establish a specific diagnosis for that question.';
 if(Array.isArray(report?.gates)&&report.gates.length)body+=' There are '+report.gates.length+' data/operating cautions in the full review.';
 return {title,body,evidence:observed.slice(0,4),next:(next.length?next:missing).slice(0,3)};
}
function compareInsight(c){
 if(!c||c.error)return {status:'unknown',text:c?.error||'Save a baseline and import a follow-up log.'};
 if(!c.rows?.length)return {status:'unknown',text:'No matching RPM/load regions with enough readings in both logs. Drive conditions must overlap.'};
 if(good(c.ethanolGap)&&c.ethanolGap>10)return {status:'unknown',text:'Ethanol content differs by '+fmt(c.ethanolGap)+' percentage points. Do not call this a tuning improvement.'};
 const closer=c.rows.filter(x=>x.delta<-.25).length,farther=c.rows.filter(x=>x.delta>.25).length;
 const unknown=!good(c.ethanolGap);
 return {status:unknown?'limited':closer>farther?'closer':farther>closer?'farther':'mixed',
 text:c.rows.length+' comparable RPM/load regions: '+closer+' closer to target, '+farther+' farther from target, '+(c.rows.length-closer-farther)+' essentially unchanged.'+(unknown?' Ethanol was not available on both logs; interpret with extra caution.':'')+' This is observational and cannot prove a tune change caused the difference.'};
}
root.RawestSignalV4Core={version:'4.0.0',eventLabel,eventSummary,selectEvents,suggestions,answer,compareInsight,fmt};
})(typeof window!=='undefined'?window:globalThis);
