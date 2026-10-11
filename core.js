// Pure helpers shared by the page and tests (no DOM access).
(function (g) {
const ZONES=['Asia/Tokyo','Asia/Seoul','Asia/Shanghai','Asia/Singapore','Asia/Kolkata','Asia/Dubai','Europe/London','Europe/Paris','Europe/Berlin','America/Sao_Paulo','America/New_York','America/Chicago','America/Los_Angeles','UTC'];
const INTL_LOCALE={ja:'ja-JP',en:'en-US','zh-Hans':'zh-CN','zh-Hant':'zh-TW',ko:'ko-KR',es:'es-ES',fr:'fr-FR',de:'de-DE','pt-BR':'pt-BR',hi:'hi-IN',id:'id-ID'};
function fmtDate(ms, lang, tz){ return new Intl.DateTimeFormat(INTL_LOCALE[lang]||lang,{timeZone:tz,year:'numeric',month:'short',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(ms)); }
function relTime(ms, now, lang){
  const rtf=new Intl.RelativeTimeFormat(INTL_LOCALE[lang]||lang,{numeric:'auto'}); const d=(ms-now)/1000, a=Math.abs(d);
  if (a<60) return rtf.format(Math.round(d),'second'); if (a<3600) return rtf.format(Math.round(d/60),'minute');
  if (a<86400) return rtf.format(Math.round(d/3600),'hour'); return rtf.format(Math.round(d/86400),'day');
}
function parts(ms){ const t=Math.max(0,Math.floor(ms/1000)); return {d:Math.floor(t/86400),h:Math.floor(t/3600)%24,m:Math.floor(t/60)%60,s:t%60}; }
function localized(it, field, lang){ if (lang==='ja') return it[field]||''; const m=it[field+'_i18n']||{}; return m[lang]||m.en||it[field]||''; }
function icsEscape(s){ return String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n'); }
function icsStamp(ms){ return new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
function buildIcs(it, serviceName, nowMs){
  const start=Date.parse(it.effective_jst_iso); if (Number.isNaN(start)) return null;
  const summary=serviceName+' usage-limit reset'; const desc=(localized(it,'summary','en'))+'\n'+it.url;
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ai-limit-reset-jst//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:'+it.id+'@ai-limit-reset-jst','DTSTAMP:'+icsStamp(nowMs),'DTSTART:'+icsStamp(start),'DTEND:'+icsStamp(start+15*60000),
    'SUMMARY:'+icsEscape(summary),'DESCRIPTION:'+icsEscape(desc),'URL:'+it.url,
    'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:'+icsEscape(summary),'END:VALARM','END:VEVENT','END:VCALENDAR'];
  return lines.join('\r\n')+'\r\n';
}
function badge(it, now){ if (it.type==='banked') return 'banked'; if (it.status==='scheduled'){ const t=Date.parse(it.effective_jst_iso); return (!Number.isNaN(t)&&t<=now)?'done':'scheduled'; } return it.type==='immediate'?'immediate':'done'; }
const CITY={
 en:{'Asia/Tokyo':'Tokyo','Asia/Seoul':'Seoul','Asia/Shanghai':'Shanghai','Asia/Singapore':'Singapore','Asia/Kolkata':'Kolkata','Asia/Dubai':'Dubai','Europe/London':'London','Europe/Paris':'Paris','Europe/Berlin':'Berlin','America/Sao_Paulo':'São Paulo','America/New_York':'New York','America/Chicago':'Chicago','America/Los_Angeles':'Los Angeles','UTC':'UTC'},
 ja:{'Asia/Tokyo':'東京','Asia/Seoul':'ソウル','Asia/Shanghai':'上海','Asia/Singapore':'シンガポール','Asia/Kolkata':'コルカタ','Asia/Dubai':'ドバイ','Europe/London':'ロンドン','Europe/Paris':'パリ','Europe/Berlin':'ベルリン','America/Sao_Paulo':'サンパウロ','America/New_York':'ニューヨーク','America/Chicago':'シカゴ','America/Los_Angeles':'ロサンゼルス','UTC':'UTC'},
 'zh-Hans':{'Asia/Tokyo':'东京','Asia/Seoul':'首尔','Asia/Shanghai':'上海','Asia/Singapore':'新加坡','Asia/Kolkata':'加尔各答','Asia/Dubai':'迪拜','Europe/London':'伦敦','Europe/Paris':'巴黎','Europe/Berlin':'柏林','America/Sao_Paulo':'圣保罗','America/New_York':'纽约','America/Chicago':'芝加哥','America/Los_Angeles':'洛杉矶','UTC':'UTC'},
 'zh-Hant':{'Asia/Tokyo':'東京','Asia/Seoul':'首爾','Asia/Shanghai':'上海','Asia/Singapore':'新加坡','Asia/Kolkata':'加爾各答','Asia/Dubai':'杜拜','Europe/London':'倫敦','Europe/Paris':'巴黎','Europe/Berlin':'柏林','America/Sao_Paulo':'聖保羅','America/New_York':'紐約','America/Chicago':'芝加哥','America/Los_Angeles':'洛杉磯','UTC':'UTC'},
 ko:{'Asia/Tokyo':'도쿄','Asia/Seoul':'서울','Asia/Shanghai':'상하이','Asia/Singapore':'싱가포르','Asia/Kolkata':'콜카타','Asia/Dubai':'두바이','Europe/London':'런던','Europe/Paris':'파리','Europe/Berlin':'베를린','America/Sao_Paulo':'상파울루','America/New_York':'뉴욕','America/Chicago':'시카고','America/Los_Angeles':'로스앤젤레스','UTC':'UTC'}};
function offset(tz, ms){ try{ const p=new Intl.DateTimeFormat('en-US',{timeZone:tz,timeZoneName:'shortOffset'}).formatToParts(new Date(ms)).find(x=>x.type==='timeZoneName'); return p?p.value.replace('GMT','UTC').replace(/^UTC$/,'UTC±0'):''; }catch(e){ return ''; } }
function tzLabel(tz, lang, ms){ const c=(CITY[lang]||CITY.en)[tz]||CITY.en[tz]||tz.split('/').pop().replace(/_/g,' '); return c+' '+offset(tz, ms); }
function fmtShort(ms, lang, tz){ return new Intl.DateTimeFormat(INTL_LOCALE[lang]||lang,{timeZone:tz,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)); }
g.Core={tzLabel,offset,fmtShort,ZONES,INTL_LOCALE,fmtDate,relTime,parts,localized,buildIcs,badge};
})(typeof globalThis!=='undefined'?globalThis:window);
