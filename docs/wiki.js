/* RAWEST SIGNAL Documentation 4.0.2 — local Markdown wiki, no backend. */
(function(){
'use strict';
const catalog=Array.isArray(window.RAWEST_DOCS_CATALOG)?window.RAWEST_DOCS_CATALOG:[];
const bySlug=new Map(catalog.map(p=>[p.slug,p]));
const groups=[...new Set(catalog.map(p=>p.category))];
const el=id=>document.getElementById(id),content=el('wikiContent'),sidebar=el('sidebarNav'),aside=el('wikiSidebar'),toc=el('wikiToc');
const dialog=el('wikiSearch'),q=el('wikiSearchInput'),results=el('wikiSearchResults'),hint=el('searchHint');
const cache=new Map();let active='',requestNumber=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slugify=s=>String(s).toLowerCase().replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,'-').slice(0,60)||'section';
const icons={sparkles:'✦',file:'▤',activity:'⌁',gauge:'◉',sliders:'☷',shield:'◇','git-compare':'⇄',car:'▣','file-text':'▤',book:'▧','book-open':'▧','life-buoy':'?',lock:'⊡',globe:'◎',map:'↗'};
const articleUrl=slug=>'#/'+slug;
function inline(s){
 let out=esc(s);
 out=out.replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>');
 out=out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,label,url)=>{
  const dest=url.replace(/&amp;/g,'&');
  if(!/^(https?:\/\/|\.{1,2}\/|\/(?!\/)|#)/i.test(dest))return label;
  return '<a href="'+esc(dest)+'"'+(/^https?:\/\//i.test(dest)?' target="_blank" rel="noopener noreferrer"':'')+'>'+label+'</a>';
 });
 return out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/(^|[\s(])\*([^*]+)\*/g,'$1<em>$2</em>');
}
function renderMarkdown(md){
 const rows=String(md||'').replace(/\r/g,'').split('\n'),tocItems=[],seen=new Map();
 let html='',para=[],list=null,inCode=false,code=[];
 function flush(){if(para.length){html+='<p>'+inline(para.join(' '))+'</p>';para=[];}}
 function closeList(){if(list){html+='</'+list+'>';list=null;}}
 function finish(){flush();closeList();}
 const tableCells=s=>s.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(v=>v.trim());
 for(let i=0;i<rows.length;i++){
  const line=rows[i],t=line.trim();
  if(/^\x60{3}/.test(t)){finish();if(inCode){html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=[];inCode=false;}else inCode=true;continue;}
  if(inCode){code.push(line);continue;}
  if(!t){finish();continue;}
  const h=t.match(/^(#{1,3})\s+(.+)$/);
  if(h){
   finish();let id=slugify(h[2]),count=seen.get(id)||0;seen.set(id,count+1);if(count)id+='-'+(count+1);
   const level=h[1].length;html+='<h'+level+' id="'+id+'">'+inline(h[2])+'</h'+level+'>';
   if(level>1)tocItems.push({id,title:h[2],level});continue;
  }
  if(/^(?:-{3,}|\*{3,})$/.test(t)){finish();html+='<hr>';continue;}
  if(t.startsWith('|')&&/^\s*\|?\s*:?-{3,}:?\s*\|/.test(rows[i+1]||'')){
   finish();html+='<div class="table-scroll"><table><thead><tr>'+tableCells(line).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>';
   i++;while(i+1<rows.length&&rows[i+1].trim().startsWith('|')){i++;html+='<tr>'+tableCells(rows[i]).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>';}
   html+='</tbody></table></div>';continue;
  }
  const ordered=t.match(/^\d+\.\s+(.+)/),bullet=t.match(/^[-*]\s+(.+)/);
  if(ordered||bullet){
   flush();const type=ordered?'ol':'ul';if(list!==type){closeList();html+='<'+type+'>';list=type;}
   html+='<li>'+inline((ordered||bullet)[1])+'</li>';continue;
  }
  if(t.startsWith('> ')){finish();html+='<blockquote>'+inline(t.slice(2))+'</blockquote>';continue;}
  closeList();para.push(t);
 }
 finish();if(inCode)html+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';
 return {html,headings:tocItems};
}
async function fetchText(slug){
 if(cache.has(slug))return cache.get(slug);
 const task=fetch('./pages/'+slug+'.md').then(async r=>{if(!r.ok)throw new Error('Document unavailable (HTTP '+r.status+').');return r.text();});
 cache.set(slug,task);
 try{return await task;}catch(e){cache.delete(slug);throw e;}
}
function nav(){
 const home=document.createElement('a');home.href='#/';home.className='sidebar-item';home.dataset.slug='';
 home.innerHTML='<span class="sidebar-glyph">⌂</span><span>Overview</span>';sidebar.append(home);
 for(const g of groups){
  const t=document.createElement('div');t.className='section-name';t.textContent=g;sidebar.append(t);
  for(const p of catalog.filter(x=>x.category===g)){
   const a=document.createElement('a');a.href=articleUrl(p.slug);a.className='sidebar-item';a.dataset.slug=p.slug;
   a.innerHTML='<span class="sidebar-glyph">'+esc(icons[p.icon]||'▧')+'</span><span>'+esc(p.title)+'</span>';sidebar.append(a);
  }
 }
}
function selected(slug){sidebar.querySelectorAll('[data-slug]').forEach(a=>{if(a.dataset.slug===slug)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});}
function hideNav(){aside.classList.remove('open');el('mobileNav').setAttribute('aria-expanded','false');}
function home(){
 active='';selected('');toc.hidden=true;
 let html='<section class="wiki-intro"><span class="eyebrow">RAWEST PERFORMANCE / KNOWLEDGE BASE</span><h1>The answers are<br><em>right here.</em></h1><p>Everything you need to understand a datalog, learn the language and make confident next moves—without a professional tuning manual.</p><p>Start with a guide or search the whole knowledge base above.</p></section>';
 html+='<div class="home-label">YOUR FIRST 5 MINUTES</div><div class="quick-guides">';
 for(const slug of ['welcome','file-formats','reading-your-log','lambda-afr']){
  const p=bySlug.get(slug);html+='<a class="guide-card" href="'+articleUrl(p.slug)+'"><span class="symbol">'+esc(icons[p.icon])+'</span><strong>'+esc(p.title)+'</strong><p>'+esc(p.description)+'</p></a>';
 }
 html+='</div><div class="home-label">EXPLORE THE KNOWLEDGE BASE</div>';
 for(const g of groups){
  const sub=catalog.filter(x=>x.category===g);
  html+='<a class="group-row" href="'+articleUrl(sub[0].slug)+'"><strong>'+esc(g)+'</strong><span>'+sub.length+' guides ↗</span></a>';
 }
 html+='<div class="article-actions"><a href="../">Launch RAWEST SIGNAL ↗</a><a href="https://github.com/whiiskerz/pullsheet/tree/main/docs/pages" target="_blank" rel="noopener noreferrer">Browse Markdown pages ↗</a></div>';
 content.innerHTML=html;document.title='RAWEST SIGNAL · Knowledge Base';
}
function route(){
 const hash=location.hash.replace(/^#\/?/,'');
 const [slug,query]=hash.split('?');
 return {slug:slug||'',section:new URLSearchParams(query||'').get('section')||''};
}
function top(){window.scrollTo({top:0,behavior:'auto'});}
async function show(){
 const {slug,section}=route(),seq=++requestNumber;hideNav();
 if(!bySlug.has(slug)){home();top();return;}
 if(active===slug&&section){document.getElementById(section)?.scrollIntoView({block:'start'});return;}
 const p=bySlug.get(slug);active=slug;selected(slug);
 content.innerHTML='<p class="article-breadcrumb">Docs / '+esc(p.category)+' / '+esc(p.title)+'</p><p>Loading guide…</p>';
 try{
  const md=await fetchText(slug);if(seq!==requestNumber)return;
  const parsed=renderMarkdown(md),idx=catalog.findIndex(x=>x.slug===slug),prev=catalog[idx-1],next=catalog[idx+1];
  let html='<div class="article-breadcrumb"><a href="#/">Docs</a><span>›</span><span>'+esc(p.category)+'</span><span>›</span><span>'+esc(p.title)+'</span></div>';
  html+='<div class="article-top"><span class="pill">'+esc(p.category)+'</span><span class="read-time">'+Math.max(1,Math.round(md.split(/\s+/).length/190))+' min read · v4.0.2</span></div>';
  html+='<article class="article-content">'+parsed.html+'</article>';
  html+='<div class="article-actions"><button type="button" id="copyPageLink">Copy article link</button><a href="https://github.com/whiiskerz/pullsheet/edit/main/docs/pages/'+encodeURIComponent(slug)+'.md" target="_blank" rel="noopener noreferrer">Edit on GitHub ↗</a></div>';
  html+='<nav class="pager" aria-label="Previous and next guides">';
  html+=prev?'<a href="'+articleUrl(prev.slug)+'"><span>← Previous</span><strong>'+esc(prev.title)+'</strong></a>':'<span></span>';
  if(next)html+='<a href="'+articleUrl(next.slug)+'"><span>Next →</span><strong>'+esc(next.title)+'</strong></a>';
  html+='</nav>';
  content.innerHTML=html;
  const container=el('tocLinks');container.replaceChildren();
  parsed.headings.forEach(h=>{const a=document.createElement('a');a.href=articleUrl(slug)+'?section='+encodeURIComponent(h.id);a.textContent=h.title;if(h.level===3)a.className='toc-h3';container.append(a);});
  toc.hidden=parsed.headings.length===0;document.title=p.title+' · RAWEST SIGNAL Docs';
  el('copyPageLink')?.addEventListener('click',async e=>{
   try{await navigator.clipboard.writeText(location.href);e.currentTarget.textContent='Copied ✓';}
   catch(err){e.currentTarget.textContent='Use your address bar to copy';}
  });
  if(section)document.getElementById(section)?.scrollIntoView({block:'start'});else top();
 }catch(e){if(seq!==requestNumber)return;content.innerHTML='<div class="article-breadcrumb"><a href="#/">Docs</a> / '+esc(p.title)+'</div><h1>Could not load this guide</h1><p>'+esc(e.message)+'</p><p>Reconnect and try the link again.</p>';toc.hidden=true;}
}
async function search(text){
 const terms=text.trim().toLowerCase().split(/\s+/).filter(x=>x.length>1).slice(0,8);
 if(!terms.length){results.innerHTML='<p class="search-hint">Try: lambda, sensor, upload, pressure or Garage.</p>';hint.textContent='Search across all guides.';return;}
 hint.textContent='Searching all pages…';
 const matches=await Promise.allSettled(catalog.map(p=>fetchText(p.slug)));
 if(q.value.trim().toLowerCase()!==text.trim().toLowerCase())return;
 const found=catalog.map((p,i)=>{
  const md=matches[i].status==='fulfilled'?matches[i].value:'',title=p.title.toLowerCase(),full=(p.title+' '+p.description+' '+md).toLowerCase();
  const match=terms.every(t=>full.includes(t)),score=terms.reduce((n,t)=>n+(title.includes(t)?10:0)+(p.description.toLowerCase().includes(t)?4:0)+(md.toLowerCase().includes(t)?1:0),0);
  const pos=md.toLowerCase().indexOf(terms[0]);
  const excerpt=(pos<0?p.description:md.slice(Math.max(0,pos-30),pos+135)).replace(/[#*|]/g,'').replace(/\s+/g,' ').slice(0,160);
  return {p,match,score,excerpt};
 }).filter(x=>x.match).sort((a,b)=>b.score-a.score);
 results.replaceChildren();
 found.slice(0,15).forEach(x=>{
  const b=document.createElement('button');b.className='search-result';b.type='button';
  const title=document.createElement('strong');title.textContent=x.p.title;
  const sub=document.createElement('span');sub.textContent=x.p.category+' · '+x.excerpt;
  b.append(title,sub);b.addEventListener('click',()=>{close();location.hash=articleUrl(x.p.slug);});results.append(b);
 });
 hint.textContent=found.length+' matching guide'+(found.length===1?'':'s');
}
function open(){
 if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
 q.value='';search('');q.focus();
}
function close(){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
el('searchTrigger').addEventListener('click',open);
el('searchClose').addEventListener('click',close);
q.addEventListener('input',()=>search(q.value).catch(()=>{hint.textContent='Search currently unavailable.';}));
document.addEventListener('keydown',e=>{
 const editable=e.target.matches('input,textarea,[contenteditable]')||e.target.isContentEditable;
 if((e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!editable&&!e.altKey&&!e.ctrlKey)){
  e.preventDefault();open();
 }
});
el('mobileNav').addEventListener('click',()=>{
 const opened=aside.classList.toggle('open');el('mobileNav').setAttribute('aria-expanded',String(opened));
});
document.addEventListener('click',e=>{
 if(aside.classList.contains('open')&&!aside.contains(e.target)&&!el('mobileNav').contains(e.target))hideNav();
});
nav();window.addEventListener('hashchange',()=>show().catch(console.warn));show().catch(console.warn);
if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(()=>catalog.forEach(p=>fetchText(p.slug).catch(()=>{})),{timeout:4500});
window.RAWEST_DOCS_APP={renderMarkdown,catalog};
})();