'use strict';
(function(){
const {S,NAMES,LOCALES,pick}=I18N; const C=Core;
const qs=new URLSearchParams(location.search);
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const sysTz=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Tokyo'}catch(e){return 'Asia/Tokyo'}})();
let lang=LOCALES.includes(qs.get('lang'))?qs.get('lang'):(LOCALES.includes(store.get('lang'))?store.get('lang'):pick(navigator.languages||[navigator.language]));
let tz=qs.get('tz')||store.get('tz')||sysTz; try{new Intl.DateTimeFormat('en',{timeZone:tz})}catch(e){tz=sysTz}
let view=qs.get('view')==='service'?'service':'timeline'; let svcFilter=qs.get('svc')||'all';
let DATA=null, timers=[], lastAnnounce=0;
const t=k=>(S[lang]&&S[lang][k])||S.en[k]||S.ja[k]||k;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safe=u=>/^https:\/\//.test(u||'')?u:null;
const $=id=>document.getElementById(id);
const svcName=s=>(lang==='ja'?s.name:(s.name_en||s.name));
function syncUrl(){ const p=new URLSearchParams(); if(lang!=='ja')p.set('lang',lang); if(view!=='timeline')p.set('view',view); if(svcFilter!=='all')p.set('svc',svcFilter); if(qs.get('tz')||tz!==sysTz)p.set('tz',tz); const q=p.toString(); history.replaceState(null,'',location.pathname+(q?'?'+q:'')); }
function applyStatic(){
  document.documentElement.lang=lang; document.title=t('title');
  document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)});
  $('lang').innerHTML=LOCALES.map(l=>`<option value="${l}"${l===lang?' selected':''} lang="${l}">${esc(NAMES[l])}</option>`).join('');
  const now=Date.now(); const zones=[...new Set([...C.ZONES,sysTz,tz])];
  $('tz').innerHTML=zones.map(z=>`<option value="${esc(z)}"${z===tz?' selected':''}>${esc(C.tzLabel(z,lang,now))}</option>`).join('');
  const th=store.get('theme')||'auto';
  $('theme').textContent=t('th_'+th); $('theme').setAttribute('aria-label',t('theme')+': '+t('th_'+th));
  $('chips').setAttribute('aria-label',t('filter')); $('viewsel').setAttribute('aria-label',t('view'));
  document.querySelectorAll('#viewsel button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.v===view)));
}
function services(){ const days=Number(DATA.retention_days)||LimitFilter.DAYS, now=Date.now();
  return (DATA.services||[]).map(s=>({...s,items:(Array.isArray(s.items)?s.items:[]).filter(it=>LimitFilter.isVisible(it,now,days)).sort(LimitFilter.newestFirst)})); }
function countHtml(ms){ const p=C.parts(ms); return ['d','h','m','s'].map(k=>`<div><b>${k==='d'?p[k]:String(p[k]).padStart(2,'0')}</b><span>${esc(t(k))}</span></div>`).join(''); }
function card(it,s,now){
  const b=C.badge(it,now), eff=Date.parse(it.effective_jst_iso), conf=Date.parse(it.confirmed_utc), url=safe(it.url), curl=safe(it.confirmed_url);
  const sum=C.localized(it,'summary',lang), translated=lang!=='ja'&&(it.summary_i18n||{})[lang];
  const effTxt=C.localized(it,'effective',lang), scope=C.localized(it,'scope',lang), note=C.localized(it,'note',lang);
  const posted=Date.parse(it.announced_utc);
  return `<article class="entry" aria-label="${esc(svcName(s))}">
  <div class="e-date"><time datetime="${esc(it.announced_utc)}">${esc(C.fmtShort(posted,lang,tz))}</time><span class="rel">${esc(C.relTime(posted,now,lang))}</span></div>
  <div class="e-main">
   <div class="e-kicker"><span class="e-svc">${esc(svcName(s))}</span><span class="status ${b}">${esc(t('st_'+b))}</span></div>
   <p class="e-sum"${translated?` title="${esc(t('translated_note'))}"`:''}>${esc(sum)}</p>
   <dl class="meta">
    <dt>${esc(t('announced'))}</dt><dd>${esc(C.fmtDate(posted,lang,tz))}${tz!=='UTC'?` <span class="muted">· ${esc(C.fmtDate(posted,lang,'UTC'))}</span>`:''}</dd>
    ${Number.isNaN(eff)?'':`<dt>${esc(t('scheduled_for'))}</dt><dd class="strong">${esc(C.fmtDate(eff,lang,tz))}${it.source_time_text?` <span class="muted">“${esc(it.source_time_text)}” · ${esc(it.source_tz||'')}</span>`:''}</dd>`}
    <dt>${esc(t('effective'))}</dt><dd>${esc(effTxt)}</dd>
    ${Number.isNaN(conf)?'':`<dt>${esc(t('confirmed_at'))}</dt><dd>${esc(C.fmtDate(conf,lang,tz))}</dd>`}
    ${scope?`<dt>${esc(t('scope'))}</dt><dd>${esc(scope)}</dd>`:''}
    <dt>${esc(t('poster'))}</dt><dd>${esc(C.localized(it,'poster',lang))}</dd>
   </dl>
   ${note?`<p class="e-note">${esc(note)}</p>`:''}
   <div class="e-links">${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a>`:''}${curl?`<a href="${esc(curl)}" target="_blank" rel="noopener">${esc(t('confirmed'))} ↗</a>`:''}${(!Number.isNaN(eff)&&eff>now)?`<button type="button" class="link" data-ics="${esc(it.id)}">${esc(t('ics'))}</button>`:''}</div>
  </div>
  </article>`;
}
function renderHero(svcs,now){
  const fut=svcs.flatMap(s=>s.items.map(it=>({s,it,t:Date.parse(it.effective_jst_iso)}))).filter(x=>x.t>now).sort((a,b)=>a.t-b.t);
  const body=$('hero-body'); timers=[];
  if(!fut.length){ body.innerHTML=`<p class="h-none">${esc(t('none_next'))}</p>`; return; }
  const n=fut[0];
  body.innerHTML=`<p class="h-svc">${esc(svcName(n.s))}</p>
   <p class="h-when"><time datetime="${esc(n.it.effective_jst_iso)}">${esc(C.fmtDate(n.t,lang,tz))}</time></p>
   <div class="count" id="count" role="timer" aria-label="${esc(t('until'))}">${countHtml(n.t-now)}</div>
   <p class="h-sum">${esc(C.localized(n.it,'summary',lang))}</p>
   <div class="actions"><button type="button" class="link primary" data-ics="${esc(n.it.id)}">${esc(t('ics'))}</button><button type="button" class="link" id="share">${esc(t('share'))}</button><a href="${esc(n.it.url)}" target="_blank" rel="noopener">${esc(t('source'))} ↗</a></div>`;
  timers.push(n);
}
function render(){
  if(!DATA) return; applyStatic(); const now=Date.now(); const svcs=services();
  renderHero(svcs,now);
  const total=svcs.reduce((a,s)=>a+s.items.length,0);
  $('chips').innerHTML=[`<button type="button" aria-pressed="${svcFilter==='all'}" data-svc="all">${esc(t('all'))}<span class="n">${total}</span></button>`]
    .concat(svcs.map(s=>`<button type="button" aria-pressed="${svcFilter===s.id}" data-svc="${esc(s.id)}">${esc(svcName(s))}<span class="n">${s.items.length}</span></button>`)).join('');
  const shown=svcs.filter(s=>svcFilter==='all'||s.id===svcFilter); let html='';
  if(view==='timeline'){ const all=shown.flatMap(s=>s.items.map(it=>({s,it}))).sort((a,b)=>LimitFilter.newestFirst(a.it,b.it));
    html=all.length?all.map(x=>card(x.it,x.s,now)).join(''):`<p class="empty">${esc(t(svcFilter==='all'?'empty':'empty_filter'))}</p>`;
  } else html=shown.map(s=>`<section aria-labelledby="g-${esc(s.id)}"><h2 class="group-h" id="g-${esc(s.id)}">${esc(svcName(s))}</h2>${s.items.length?s.items.map(it=>card(it,s,now)).join(''):`<p class="empty">${esc(t('empty_filter'))}</p>`}</section>`).join('');
  $('list').innerHTML=html;
  $('updated').textContent=t('updated')+': '+(Date.parse(DATA.updated_jst)?C.fmtDate(Date.parse(DATA.updated_jst),lang,tz):'');
  syncUrl();
}
function tick(){ const now=Date.now(); for(const n of timers){ const el=$('count'); if(!el) continue; const left=n.t-now;
  if(left<=0){ el.innerHTML=`<p class="passed">${esc(t('passed'))}</p>`; $('live').textContent=t('passed'); timers=[]; setTimeout(render,1500); return; }
  el.innerHTML=countHtml(left);
  if(now-lastAnnounce>60000){ lastAnnounce=now; const p=C.parts(left); $('live').textContent=`${t('until')} ${p.d}${t('d')} ${p.h}${t('h')} ${p.m}${t('m')}`; } } }
function toast(msg){ const el=$('toast'); el.textContent=msg; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,1800); }
function findItem(id){ for(const s of DATA.services||[]) for(const it of s.items||[]) if(it.id===id) return {s,it}; return null; }
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-svc]'); if(c){ svcFilter=c.dataset.svc; render(); return; }
  const v=e.target.closest('#viewsel [data-v]'); if(v){ view=v.dataset.v; render(); return; }
  const i=e.target.closest('[data-ics]'); if(i){ const f=findItem(i.dataset.ics); if(!f) return; const ics=C.buildIcs(f.it,f.s.name_en||f.s.name,Date.now()); if(!ics) return;
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([ics],{type:'text/calendar'})); a.download=`reset-${f.it.id}.ics`; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500); return; }
  if(e.target.closest('#share')){ const u=location.href; if(navigator.share&&matchMedia('(pointer:coarse)').matches){navigator.share({title:t('title'),url:u}).catch(()=>{});} else if(navigator.clipboard){navigator.clipboard.writeText(u).then(()=>toast(t('copied')),()=>toast(u));} else toast(u); return; }
  if(e.target.closest('#theme')){ const order=['auto','light','dark']; const cur=store.get('theme')||'auto'; const nx=order[(order.indexOf(cur)+1)%3]; store.set('theme',nx);
    if(nx==='auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=nx; applyStatic(); }
});
document.addEventListener('keydown',e=>{ const g=e.target.closest('#viewsel'); if(g&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){ view=view==='timeline'?'service':'timeline'; render(); document.querySelector(`#viewsel [data-v="${view}"]`).focus(); } });
$('lang').addEventListener('change',e=>{ lang=e.target.value; store.set('lang',lang); render(); });
$('tz').addEventListener('change',e=>{ tz=e.target.value; store.set('tz',tz); render(); });
applyStatic(); setInterval(tick,1000);
setInterval(()=>{ if(DATA) render(); },60000); // refresh relative times
fetch('data.json?v='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{DATA=d;render();})
 .catch(e=>{ $('list').innerHTML=`<p class="empty">${esc(t('load_error'))} (${esc(e.message)})</p>`; $('hero-body').textContent=''; });
})();
