'use strict';
const F = new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const valid = (s) => s != null && !Number.isNaN(new Date(s).getTime());
const fmt = (s) => valid(s) ? F.format(new Date(s)) + '（日本時間）' : '不明';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (u) => /^https:\/\//.test(u || '') ? u : null;
const TYPE = {immediate:'即時', scheduled:'予告', banked:'保存型'};
let cds = [];
function remain(ms){ const t=Math.max(0,Math.floor(ms/1000)); return `${Math.floor(t/86400)}日 ${Math.floor(t/3600)%24}時間 ${Math.floor(t/60)%60}分 ${t%60}秒`; }
function tick(){
  const now = Date.now(); const n = document.getElementById('now'); if (n) n.textContent = '現在：' + fmt(now);
  for (const [el,t] of cds) { const d = t - now;
    if (d <= 0) { el.textContent = '予告日時は経過済み'; el.classList.add('past'); }
    else el.textContent = 'リセット予定まで あと ' + remain(d); }
}
function itemHtml(it){
  const url = safeUrl(it.url), curl = safeUrl(it.confirmed_url);
  const orig = valid(it.announced_utc) ? new Date(it.announced_utc).toISOString().replace('T',' ').replace('.000Z','') + ' UTC' : '';
  return `<div class="item">
  <div class="dt">発表：${fmt(it.announced_utc)} <span class="badge">${esc(TYPE[it.type] || '')}</span></div>
  ${orig ? `<div class="sub">元の時刻：${esc(orig)}（X投稿のタイムスタンプ）</div>` : ''}
  <div class="eff">リセット適用：${esc(it.effective || '不明')}${valid(it.effective_jst_iso) ? '／予告日時 ' + fmt(it.effective_jst_iso) : ''}</div>
  ${it.source_time_text ? `<div class="sub">原文の時刻表記：「${esc(it.source_time_text)}」${it.source_tz ? '（' + esc(it.source_tz) + '）' : ''}</div>` : ''}
  ${valid(it.effective_jst_iso) ? `<div class="cd" data-t="${esc(it.effective_jst_iso)}"></div>` : ''}
  <div>${esc(it.summary || '')}</div>
  ${it.scope ? `<div class="sub">対象：${esc(it.scope)}</div>` : ''}
  ${it.note ? `<div class="note">※${esc(it.note)}</div>` : ''}
  <div class="sub">投稿者：${esc(it.poster || '不明')}</div>
  ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">原文を見る</a>` : ''}${curl ? ` ／ <a href="${esc(curl)}" target="_blank" rel="noopener">反映完了の投稿</a>` : ''}
  </div>`;
}
let DATA = null, VIEW = location.hash === '#svc' ? 'svc' : 'all';
function render(d){
  DATA = d;
  const days = (d && Number(d.retention_days)) || LimitFilter.DAYS;
  const services = (Array.isArray(d && d.services) ? d.services : []).map(s => ({...s, items: (Array.isArray(s.items) ? s.items : []).filter(it => LimitFilter.isVisible(it, Date.now(), days)).sort(LimitFilter.newestFirst)}));
  document.getElementById('range').textContent = `表示範囲：直近${days}日間の投稿（未実施の予告リセットは期間外でも表示）`;
  document.getElementById('updated').textContent = 'データ更新：' + fmt(d && d.updated_jst);
  document.getElementById('toc').innerHTML = services.map(s => `<a href="#${esc(s.id)}">${esc(s.name)}（${(s.items||[]).length}）</a>`).join('');
  const now = Date.now(); const future = [];
  const app = document.getElementById('app'); app.innerHTML = '';
  services.forEach(s => s.items.forEach(it => { const t = Date.parse(it.effective_jst_iso); if (t > now) future.push({s, it, t}); }));
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === VIEW));
  document.getElementById('toc').style.display = VIEW === 'all' ? 'none' : '';
  if (VIEW === 'all') {
    const all = services.flatMap(s => s.items.map(it => ({...it, _svc: s.name}))).sort(LimitFilter.newestFirst);
    const sec = document.createElement('section'); sec.id = 'all';
    sec.innerHTML = `<h2>全サービス（新しい順・${all.length}件）</h2>` + (all.length ? all.map(it => `<div class="svc">${esc(it._svc)}</div>` + itemHtml(it)).join('') : '<p class="none">直近の発表はありません</p>');
    app.appendChild(sec);
  } else for (const s of services) {
    const items = s.items;
    const sec = document.createElement('section'); sec.id = s.id || '';
    sec.innerHTML = `<h2>${esc(s.name)}</h2>${s.official_name ? `<div class="off">公式名：${esc(s.official_name)}</div>` : ''}`
      + (s.next_reset_note ? `<div class="nextnote">${esc(s.next_reset_note)}</div>` : '')
      + (items.length ? items.map(itemHtml).join('') : '<p class="none">確認できた発表なし（直近' + days + '日間）</p>');
    app.appendChild(sec);
  }
  future.sort((a,b) => a.t - b.t);
  const nx = document.getElementById('next');
  nx.innerHTML = future.length ? `次のリセット予定：<b>${esc(future[0].s.name)}</b> ${fmt(future[0].it.effective_jst_iso)}<div class="cd" data-t="${esc(future[0].it.effective_jst_iso)}"></div>` : '日時が発表された今後のリセット予定はありません。';
  cds = [...document.querySelectorAll('.cd[data-t]')].map(el => [el, Date.parse(el.dataset.t)]).filter(([,t]) => !Number.isNaN(t));
  tick();
}
setInterval(tick, 1000); tick();
document.getElementById('views').addEventListener('click', e => { const v = e.target.dataset && e.target.dataset.v; if (v && DATA) { VIEW = v; history.replaceState(null, '', v === 'svc' ? '#svc' : location.pathname); render(DATA); } });
fetch('data.json?v=' + Date.now(), {cache:'no-store'}).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(render).catch(e => { document.getElementById('app').textContent = 'data.jsonの読み込みに失敗しました（' + e.message + '）。'; });
