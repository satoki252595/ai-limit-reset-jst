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
g.Core={ZONES,INTL_LOCALE,fmtDate,relTime,parts,localized,buildIcs,badge};
})(typeof globalThis!=='undefined'?globalThis:window);
