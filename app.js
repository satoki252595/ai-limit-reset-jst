const F=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});
const fmt=s=>F.format(new Date(s))+'（日本時間）';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let cds=[];
function tick(){document.getElementById('now').textContent='現在：'+fmt(new Date());
 cds.forEach(([el,t])=>{let d=t-Date.now();if(d<=0){el.textContent='リセット実施済み';return}
 const D=Math.floor(d/864e5),h=Math.floor(d/36e5)%24,m=Math.floor(d/6e4)%60,s=Math.floor(d/1e3)%60;el.textContent=`リセットまで あと ${D}日 ${h}時間 ${m}分 ${s}秒`;});}
fetch('data.json').then(r=>r.json()).then(d=>{
 document.getElementById('updated').textContent='データ更新：'+fmt(d.updated_jst);
 document.getElementById('toc').innerHTML=d.services.map(s=>`<a href="#${s.id}">${esc(s.name)}（${s.items.length}）</a>`).join('');
 const app=document.getElementById('app');app.innerHTML='';
 d.services.forEach(s=>{const items=[...s.items].sort((a,b)=>new Date(b.announced_utc)-new Date(a.announced_utc));
  const sec=document.createElement('section');sec.id=s.id;
  sec.innerHTML=`<h2>${esc(s.name)}</h2><div class="off">公式名：${esc(s.official_name)}</div>`+(items.length?items.map((it,i)=>`<div class="item">
   <div class="dt">発表：${fmt(it.announced_utc)}</div><div class="sub">元の時刻：${it.announced_utc.replace('T',' ').replace('Z','')} ${esc(it.original_timezone)}</div>
   <div class="eff">リセット適用：${esc(it.effective)}${it.effective_jst_iso?'／'+fmt(it.effective_jst_iso)+'まで':''}</div>
   ${it.effective_jst_iso?`<div class="cd" data-t="${it.effective_jst_iso}"></div>`:''}
   <div>${esc(it.summary)}</div>${it.note?`<div class="note">※${esc(it.note)}</div>`:''}
   <div class="sub">投稿者：${esc(it.poster)}</div><a href="${esc(it.url)}" target="_blank" rel="noopener">原文を見る</a></div>`).join(''):'<p class="none">確認できた発表なし</p>');
  app.appendChild(sec);});
 cds=[...document.querySelectorAll('.cd')].map(el=>[el,new Date(el.dataset.t).getTime()]);tick();setInterval(tick,1000);
}).catch(()=>document.getElementById('app').textContent='data.jsonの読み込みに失敗しました。');
tick();
