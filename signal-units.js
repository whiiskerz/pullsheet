/* RAWEST SIGNAL / US display units.
 * Source units may be metric, but driver-facing values are PSI, °F, lb and mph.
 * Unknown source calibration NEVER becomes a PSI value by guessing magnitude. */
(function(root){
 'use strict';
 const factors={psi:1,kpa:0.14503773773020923,bar:14.503773773020923};
 const finite=Number.isFinite;
 const storage=()=>{try{return root.localStorage||null;}catch(e){return null;}};
 const clean=x=>String(x||'').toLowerCase().trim();
 const headerUnit=header=>{
   const h=String(header||'');
   const found=h.match(/(?:^|[\s([:_-])(kpa|bar|psi)(?=$|[\s)\]_\-])/i);
   return found?clean(found[1]):null;
 };
 const key=header=>'rawest-signal-pressure-source-v1:'+encodeURIComponent(clean(header));
 const getSaved=header=>{if(!header)return null;try{const val=storage()?.getItem(key(header));return Object.hasOwn(factors,val)?val:null;}catch(e){return null;}};
 const save=(header,unit)=>{
   if(!header)return false;
   try{
    if(!Object.hasOwn(factors,unit)&&unit!=='auto')return false;
    if(unit==='auto')storage()?.removeItem(key(header));
    else storage()?.setItem(key(header),unit);
    return true;
   }catch(e){return false;}
 };
 const mappedHeader=(d,kind='fuelPress')=>{
   const index=d?.sourceColumns?.[kind];
   return Number.isInteger(index)&&index>=0?String(d.headers?.[index]||''):'';
 };
 const describe=(d,kind='fuelPress',override='auto')=>{
   const header=mappedHeader(d,kind),declared=d?.sourceFormat==='holley'?clean(d.sourceUnits?.[kind]):'';
   const explicit=Object.hasOwn(factors,declared)?declared:headerUnit(header);
   const saved=getSaved(header);
   const selected=Object.hasOwn(factors,override)?override:null;
   const unit=selected||saved||explicit||null;
   const provenance=selected?'manually selected':saved?'remembered user selection':explicit?'log header unit':'unverified';
   return {
     header:header||'not mapped',unit,source:provenance,canShowPsi:!!unit,
     factor:unit?factors[unit]:null,manuallySelected:!!(selected||saved),
     psi:(value)=>unit&&finite(value)?value*factors[unit]:NaN,
     display:(value,digits=1)=>unit&&finite(value)?(value*factors[unit]).toFixed(digits)+' PSI':'PSI unavailable (verify source unit)',
     note:unit?(provenance==='log header unit'?'Converted from declared source units. Confirm sensor calibration.':'PSI conversion based on '+provenance+'; confirm original input units and sensor calibration.'):'Source pressure units are unknown. Confirm them once to display PSI; no conversion is guessed from raw pressure magnitude.'
   };
 };
 const mphFromKmh=value=>finite(value)?value/1.609344:NaN;
 const fahrenheitFromC=value=>finite(value)?value*9/5+32:NaN;
 const kilogramsFromPounds=value=>finite(value)?value*0.45359237:NaN;
 const poundsFromKilograms=value=>finite(value)?value/0.45359237:NaN;
 const mapPsia=(value,entry,sourceFormat)=>{
   // MaxxECU standard MAP [20] is logged in kPa. Unknown/custom or Holley
   // MAP channels require explicit unit verification; don't silently scale.
   if(!finite(value)||sourceFormat==='holley'||!entry||entry.method!=='MaxxECU ID')return NaN;
   return value*factors.kpa;
 };
 root.RawestSignalUnits={describe,getSaved,save,mappedHeader,mapPsia,mphFromKmh,fahrenheitFromC,kilogramsFromPounds,poundsFromKilograms,version:'1.0.0'};
})(typeof window!=='undefined'?window:globalThis);
