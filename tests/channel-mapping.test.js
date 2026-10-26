'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin=html.indexOf('function manualIndex(value){');
const end=html.indexOf('\nfunction parseHolleyLog(',begin);
assert.ok(begin>=0&&end>begin,'MaxxECU parser functions must exist');
const core=html.slice(begin,end);

function parser(config={}){
  return new Function('selected','detectPressureConversion','detectWotPulls',
    'detectButtonEvents','detectGearShiftsWithSource','detectStandingStarts','c2f',
    core+'\nreturn {findColumn,parseLog};')(
      key=>config[key]||'auto',
      ()=>({unit:'unverified',confidence:'unknown',factor:1}),
      ()=>[],()=>[],()=>[],()=>[],
      value=>value*1.8+32
    );
}
const headers=[
  'RPM [12]','Throttle position [9]','Lambda target [81]','Lambda [5]',
  'User AIN6 (Fuel Pressure) [341]','Ethanol concentration used [813]',
  'Engine runtime [69]'
];
function log(h=headers){
  return [
    h.join('\t'),
    ...Array.from({length:60},(_,i)=>{
      const values={
        'RPM [12]':'1550',
        'Throttle position [9]':'22',
        'Lambda target [81]':'1.00',
        'Lambda [5]':i%2?'.85':'.97',
        'User AIN6 (Fuel Pressure) [341]':'405',
        'Ethanol concentration used [813]':'5.9',
        'Engine runtime [69]':String(i*.05)
      };
      return h.map(name=>values[name]??'').join('\t');
    })
  ].join('\n');
}
test('auto detection never substitutes target lambda for measured lambda',()=>{
  const d=parser().parseLog(log());
  assert.equal(d.sourceColumns.lambda,3);
  assert.equal(d.sourceColumns.targetLambda,2);
  assert.equal(d.headers[d.sourceColumns.lambda],'Lambda [5]');
  assert.equal(d.lambda[1],.85);
  assert.equal(d.targetLambda[1],1);
  assert.equal(d.channelWarnings.length,0);
});
test('mapping survives reordered actual and target headers',()=>{
  const reordered=[headers[0],headers[1],headers[3],headers[2],...headers.slice(4)];
  const d=parser().parseLog(log(reordered));
  assert.equal(d.headers[d.sourceColumns.lambda],'Lambda [5]');
  assert.equal(d.headers[d.sourceColumns.targetLambda],'Lambda target [81]');
});
test('missing wideband is never replaced with commanded lambda',()=>{
  assert.equal(parser().findColumn(['Lambda target [81]'],'auto',['Lambda [','Lambda']),-1);
});
test('generic or custom wideband aliases cannot select target lambda',()=>{
  const find=parser().findColumn;
  assert.equal(find(['Lambda target [81]','Wideband lambda [5]'],'auto',['Lambda [','Lambda']),1);
});
test('manual source collision disables actual lambda and adds warning',()=>{
  const d=parser({cfgLambda:'__INDEX__2',cfgTargetLambda:'__INDEX__2'}).parseLog(log());
  assert.equal(d.sourceColumns.lambda,-1);
  assert.equal(d.lambda.length,0);
  assert.match(d.channelWarnings[0],/Fueling diagnosis is disabled/);
});
test('ambiguous alias fails closed rather than selecting an arbitrary sensor',()=>{
  assert.equal(parser().findColumn(['FuelP [400]','FP [500]'],'auto',['FuelPressure','Fuel pressure']),-1);
});
