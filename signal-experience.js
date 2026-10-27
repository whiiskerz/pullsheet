/* RAWEST SIGNAL: beginner-first, read-only experience layer. */
(function(){
'use strict';
const analyze=document.getElementById('view-analyze');
const home=analyze&&analyze.querySelector('.signal-home');
if(!home)return;
const id=name=>document.getElementById(name);
const tab=name=>document.querySelector('.tabs [data-tab="'+name+'"]');
const go=name=>{tab(name)?.click();window.scrollTo?.({top:0,behavior:'smooth'});};
const garage=()=>{go('ai');id('aiGarageBeta')?.scrollIntoView?.({behavior:'smooth',block:'start'});};
const key='rawest-signal-experience-mode';
const getMode=()=>{try{return localStorage.getItem(key)||'easy'}catch(e){return'easy'}};
const saveMode=v=>{try{localStorage.setItem(key,v)}catch(e){}};
const names={analyze:'My log',history:'Past logs',ai:'Tune studio',config:'Sensors',about:'Help'};
document.querySelectorAll('.tabs [data-tab]').forEach(el=>{if(names[el.dataset.tab])el.textContent=names[el.dataset.tab];});
home.innerHTML=[
'<div class="signal-card signal-hero-main">',
'<div class="signal-eyebrow">RAWEST PERFORMANCE · YOUR ENGINE, EXPLAINED</div>',
'<h2>Know your build.<br><em>Know your next move.</em></h2>',
'<p>All those numbers your ECU records? We help you make sense of them. See what happened, what needs a closer look, and what to check next — without having to be a tuner.</p>',
'<div class="signal-actions"><button class="signal-action primary" id="signalChooseLog" type="button">Analyze my log ↗</button>',
'<button class="signal-action" id="signalOpenGarage" type="button">My garage</button>',
'<button class="signal-action" id="signalOpenStudio" type="button">Explore my tune</button></div>',
'<div class="signal-hero-foot"><span>◉ Works on your device</span><span>◉ Files stay private</span><span>◉ No ECU changes</span></div></div>',
'<div class="signal-card signal-how-card"><div class="signal-eyebrow">THE EASY WAY IN</div>',
'<h3>Three steps. Real answers.</h3><ol class="signal-how-list">',
'<li><b>01</b><div><strong>Add a real log</strong><small>Export it from your ECU software.</small></div></li>',
'<li><b>02</b><div><strong>Understand the results</strong><small>See what the recorded sensors actually show.</small></div></li>',
'<li><b>03</b><div><strong>Know what to check</strong><small>Take the evidence to your next inspection or tune session.</small></div></li>',
'</ol><span class="signal-how-note">NEW HERE? START BELOW ↓</span></div>'
].join('');
id('signalChooseLog').addEventListener('click',()=>id('fileInput')?.click());
id('signalOpenStudio').addEventListener('click',()=>go('ai'));
id('signalOpenGarage').addEventListener('click',garage);

const entry=document.createElement('section');
entry.id='signalLaunchpad';entry.className='signal-launchpad';
entry.setAttribute('aria-label','Getting started');
entry.innerHTML=[
'<div class="signal-launch-top"><div><span class="signal-eyebrow">YOUR STARTING LINE</span><h3>What are you here to do?</h3><p>Pick what sounds like you. We will point you in the right direction.</p></div>',
'<div class="signal-mode-wrap" role="group" aria-label="Explanation detail"><span class="signal-mode-label">EXPLANATIONS</span><button type="button" id="signalEasy" aria-pressed="true">Easy</button><button type="button" id="signalDetailed" aria-pressed="false">Detailed</button></div></div>',
'<div class="signal-choice-grid" role="group" aria-label="Choose your goal">',
'<button type="button" class="signal-choice" data-choice="check" aria-pressed="true"><span class="signal-choice-icon" aria-hidden="true">⌁</span><strong>Check my engine</strong><small>Make sense of a drive or idle log.</small><span class="signal-choice-arrow" aria-hidden="true">↗</span></button>',
'<button type="button" class="signal-choice" data-choice="tune" aria-pressed="false"><span class="signal-choice-icon" aria-hidden="true">◇</span><strong>Understand my tune</strong><small>Review settings and compare versions.</small><span class="signal-choice-arrow" aria-hidden="true">↗</span></button>',
'<button type="button" class="signal-choice" data-choice="garage" aria-pressed="false"><span class="signal-choice-icon" aria-hidden="true">▤</span><strong>Track my build</strong><small>Keep parts, setup and logs together.</small><span class="signal-choice-arrow" aria-hidden="true">↗</span></button>',
'</div><div class="signal-next-move" aria-live="polite"><div><span class="signal-eyebrow">NEXT MOVE</span><p id="signalChoiceExplain"></p></div><button type="button" class="signal-action primary" id="signalChoiceGo"></button></div>',
'<details class="signal-glossary"><summary><span><b>New to datalogs?</b> Learn the words without the jargon.</span><span class="signal-glossary-expand">OPEN GUIDE ＋</span></summary>',
'<div class="signal-glossary-body"><div class="signal-terms" role="group" aria-label="Common sensor terms">',
'<button type="button" data-term="log">Datalog</button><button type="button" data-term="afr">AFR</button>',
'<button type="button" data-term="lambda">Lambda</button><button type="button" data-term="rpm">RPM</button>',
'<button type="button" data-term="tps">TPS</button><button type="button" data-term="pressure">Fuel pressure</button>',
'<button type="button" data-term="knock">Knock</button><button type="button" data-term="map">MAP / Boost</button>',
'</div><div class="signal-term-answer" role="status" aria-live="polite"><b id="signalTermTitle"></b><p id="signalTermText"></p></div></div></details>'
].join('');
home.insertAdjacentElement('afterend',entry);
const intents={
check:['Have a real log from a drive, idle session or test? Add it here and see what the recorded sensors actually show.','Choose a log'],
tune:['Want to know what changed in your MaxxECU tune? Open Tune studio, then add your original .MaxxECU-save file.','Open Tune studio'],
garage:['Building or swapping a car? Save your setup, parts and related logs in My garage. Stored on this device.','Open My garage']
};
let active='check';
function choose(name){
if(!intents[name])return;
active=name;
entry.querySelectorAll('[data-choice]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.choice===name)));
id('signalChoiceExplain').textContent=intents[name][0];
id('signalChoiceGo').textContent=intents[name][1]+' ↗';
}
entry.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>choose(btn.dataset.choice)));
id('signalChoiceGo').addEventListener('click',()=>{if(active==='check')id('fileInput')?.click();else if(active==='tune')go('ai');else garage();});
function mode(value){
const detailed=value==='detailed';
document.body.classList.toggle('signal-friendly',!detailed);
document.body.classList.toggle('signal-detailed',detailed);
id('signalEasy').setAttribute('aria-pressed',String(!detailed));
id('signalDetailed').setAttribute('aria-pressed',String(detailed));
saveMode(detailed?'detailed':'easy');
}
id('signalEasy').addEventListener('click',()=>mode('easy'));
id('signalDetailed').addEventListener('click',()=>mode('detailed'));
const terms={
log:['Datalog · A recording of what happened','The ECU records measurements over time. Import an actual exported file to see the story behind the numbers. This app reads files but never flashes your ECU.'],
afr:['AFR · Air/fuel ratio','How much air is mixed with fuel. Check whether actual fueling follows the target under similar conditions. One AFR number alone cannot verify a tune.'],
lambda:['Lambda · Fuel mixture comparison','Lambda 1.00 is stoichiometric for the current fuel, not a universal target in every condition. Compare measured and commanded lambda.'],
rpm:['RPM · Engine speed','How fast the engine spins. A high RPM reading is not proof of touching a limiter. Gear and context matter.'],
tps:['TPS · Throttle position','How far the throttle is open. Along with RPM and other channels, it helps distinguish idle, cruising, and wide-open throttle.'],
pressure:['Fuel pressure · Supply sensor','A pressure reading only means something when the sensor and its units are correctly mapped. A missing or incorrectly scaled reading cannot verify fuel delivery.'],
knock:['Knock · A signal to investigate','An indication should be reviewed with the rest of the log. It alone does not confirm detonation or justify an automatic timing change.'],
map:['MAP / Boost · Intake pressure','Manifold absolute pressure helps describe load. Boost is normally pressure above atmospheric. Verify units and the channel meaning.']
};
function term(name){
const item=terms[name];if(!item)return;
entry.querySelectorAll('[data-term]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.term===name)));
id('signalTermTitle').textContent=item[0];id('signalTermText').textContent=item[1];
}
entry.querySelectorAll('[data-term]').forEach(btn=>btn.addEventListener('click',()=>term(btn.dataset.term)));
choose('check');mode(getMode());term('log');

const review=document.createElement('section');
review.id='signalReview';review.className='signal-review';review.hidden=true;
review.setAttribute('aria-label','Your log explained');review.setAttribute('aria-live','polite');
review.innerHTML=[
'<div class="signal-review-head"><div><span class="signal-eyebrow">YOUR LOG, IN PLAIN ENGLISH</span><h3 id="signalReviewTitle"></h3><p id="signalReviewSubtitle"></p></div><span class="signal-review-stamp">REAL LOG · READ ONLY</span></div>',
'<div class="signal-review-points" id="signalReviewPoints"></div>',
'<div class="signal-review-bottom"><p>These are screening observations, not proof that an engine or tune is safe. Missing or mis-scaled sensors cannot be checked.</p>',
'<div class="signal-review-actions"><button class="signal-action primary" type="button" id="signalJumpChart">See my graphs</button>',
'<button class="signal-action" type="button" id="signalFixChannels">Check sensors</button>',
'<button class="signal-action" type="button" id="signalCopySummary">Copy summary</button></div></div>'
].join('');
id('results')?.insertAdjacentElement('beforebegin',review);
let plain='';
function point(kind,title,detail){
const node=document.createElement('article');node.className='signal-review-point signal-point-'+kind;
const heading=document.createElement('strong');heading.textContent=title;
const p=document.createElement('p');p.textContent=detail;
node.append(heading,p);id('signalReviewPoints').appendChild(node);
}
function showResults(data,health,filename){
if(!data||!health)return;
const all=Array.isArray(health.checks)?health.checks.filter(x=>x&&typeof x.name==='string'&&Number.isFinite(x.score)):[];
const flags=all.filter(x=>x.score<75).sort((a,b)=>a.score-b.score);
const mapping=Array.isArray(data.channelWarnings)?data.channelWarnings.filter(Boolean):[];
id('signalReviewTitle').textContent=flags.length||mapping.length?'Here is what deserves a closer look.':'Here is what your log can tell us.';
id('signalReviewSubtitle').textContent=(filename||'Your log')+' · '+all.length+' available checks. Only measured channels were considered.';
id('signalReviewPoints').replaceChildren();
const lines=['RAWEST SIGNAL · LOG REVIEW',filename||'Your log',''];
if(mapping.length){point('caution','First: confirm your sensors','Some channels need mapping or calibration review before their results can be interpreted.');lines.push('Confirm your sensor mappings and calibrations.');}
if(flags.length){
flags.slice(0,3).forEach(x=>{const why=x.reason||'Review this recorded reading and its sensor configuration.';point('watch',x.name,why);lines.push(x.name+': '+why);});
if(flags.length>3){point('more','More to review',(flags.length-3)+' additional flagged checks appear in the full results below.');lines.push((flags.length-3)+' more flagged checks are in the full report.');}
}else if(!mapping.length){
const words=all.length?'No priority flags in the checks available here. This does not prove that other systems are healthy.':'Not enough verified sensor data to show a meaningful screening summary.';
point('info',all.length?'No priority flags in available checks':'Need more sensor information',words);lines.push(words);
}
point('next','Your next move','Inspect the graphs and full findings. If a reading seems wrong, check its sensor channel and units before making any changes.');
lines.push('Next: inspect graphs and verify questionable sensor channels and units.','Screening observations only; not a safety certification.');
plain=lines.join('\n');review.hidden=false;entry.classList.add('signal-log-ready');
}
function clearResults(){review.hidden=true;plain='';entry.classList.remove('signal-log-ready');id('signalCopySummary').textContent='Copy summary';}
id('signalJumpChart').addEventListener('click',()=>document.querySelector('#results .chartPanel')?.scrollIntoView?.({behavior:'smooth',block:'center'}));
id('signalFixChannels').addEventListener('click',()=>go('config'));
id('signalCopySummary').addEventListener('click',async()=>{
if(!plain)return;
try{if(!navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
await navigator.clipboard.writeText(plain);id('signalCopySummary').textContent='Copied ✓';
}catch(e){window.prompt?.('Copy your log summary:',plain);}
});
window.RawestSignalExperience={showResults,clearResults};
})();