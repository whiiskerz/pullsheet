/* RAWEST SIGNAL 4.0.1 — conservative fuel graph adapter.
 * Lambda is preferred for flex fuel. Do not infer a stoich AFR or manufacture channels.
 */
(function(root){
'use strict';
const valid=Number.isFinite;
const has=a=>Array.isArray(a)&&a.some(valid);
const countPairs=(a,b)=>{let n=0;for(let i=0;i<Math.min(a?.length||0,b?.length||0);i++)if(valid(a[i])&&valid(b[i]))n++;return n;};
const lambdaOk=a=>Array.isArray(a)?a.map(x=>valid(x)&&x>.5&&x<1.5?x:NaN):[];
const afrOk=a=>Array.isArray(a)?a.map(x=>valid(x)&&x>4&&x<24?x:NaN):[];
function modes(log){
 const d=log||{},warnings=(d.channelWarnings||[]).join(' ').toLowerCase();
 const collisionLambda=/measured lambda and target lambda both|actual and target lambda resolve to one/.test(warnings);
 const collisionAfr=/measured afr and target afr use the same/.test(warnings);
 const lambdaActual=lambdaOk(d.lambda),lambdaTarget=lambdaOk(d.targetLambda);
 const lambdaAvailable=!collisionLambda&&countPairs(lambdaActual,lambdaTarget)>=3;
 // Direct logged AFR must include a real measured + commanded pair, not an empty placeholder.
 const loggedA=afrOk(d.afr),loggedT=afrOk(d.targetAfr);
 const direct=!collisionAfr&&countPairs(loggedA,loggedT)>=3;
 let convertedA=[],convertedT=[],converted=false;
 // Only convert both sides from the same lambda convention using *logged* stoich AFR.
 // Never use a hard-coded gasoline value on unknown or flex-fuel blends.
 if(lambdaAvailable&&has(d.stoichAfr)){
  const n=Math.min(lambdaActual.length,lambdaTarget.length,d.stoichAfr.length);
  convertedA=new Array(n);convertedT=new Array(n);
  for(let i=0;i<n;i++){
   const s=d.stoichAfr[i],a=lambdaActual[i],t=lambdaTarget[i];
   const good=valid(s)&&s>=8&&s<=17.5&&valid(a)&&valid(t);
   convertedA[i]=good?a*s:NaN;
   convertedT[i]=good?t*s:NaN;
  }
  converted=countPairs(convertedA,convertedT)>=3;
 }
 const afrAvailable=converted||direct;
 return {
  lambda:{available:lambdaAvailable,actual:lambdaActual,target:lambdaTarget,source:'Independent logged actual and target lambda'},
  afr:{available:afrAvailable,actual:converted?convertedA:loggedA,target:converted?convertedT:loggedT,
   source:converted?'Computed from measured + target lambda × logged stoichiometric AFR (same reference for both)':'Independent logged actual and target AFR'},
  reason:lambdaAvailable||afrAvailable?'': 'No verified actual/target fueling pair found in this log. Select independent source columns in Sensors; a file may omit target AFR entirely.'
 };
}
function choose(d,preference='auto'){
 const pair=modes(d),want=preference==='afr'||preference==='lambda'?preference:'auto';
 let mode=want==='auto'?(pair.lambda.available?'lambda':pair.afr.available?'afr':'none'):want;
 let notice=pair.reason;
 if(want!=='auto'&&!pair[want].available){
  notice=(want==='afr'?'Target AFR is not available as a matched pair. To use AFR, log both actual and target AFR, or log actual lambda, target lambda AND fuel stoichiometric AFR. No gasoline stoich constant is assumed.':
   'Actual and target lambda must be logged and mapped to distinct sources before showing lambda.');
  mode=pair.lambda.available?'lambda':pair.afr.available?'afr':'none';
 }
 const selected=mode==='none'?{actual:[],target:[],source:'No paired fuel data'}:pair[mode];
 return {mode,actual:selected.actual,target:selected.target,source:selected.source,notice,
  available:{lambda:pair.lambda.available,afr:pair.afr.available}};
}
root.RawestSignalFuelGraph={version:'4.0.1',modes,choose};
})(typeof window!=='undefined'?window:globalThis);
