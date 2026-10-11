// node tests/validate.mjs — no dependencies
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = {}; vm.runInNewContext(readFileSync(new URL('../filter.js', import.meta.url),'utf8'), ctx); const { isVisible, newestFirst } = ctx.LimitFilter;
const d = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
let fail = 0; const err = (m) => { fail++; console.error('FAIL:', m); };
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, ISO_J = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/;
const REQ = { id:'string', url:'string', poster:'string', summary:'string', announced_utc:'string', announced_jst:'string', effective:'string', type:'string', status:'string', scope:'string' };
const jstOf = (ms) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`; };
// local wall time in IANA zone -> UTC ms (iterative, DST-safe)
export function zonedToUtc(local, tz) {
  const [D, T] = local.split('T'); const [y,mo,da] = D.split('-').map(Number); const [h,mi] = T.split(':').map(Number);
  let guess = Date.UTC(y,mo-1,da,h,mi);
  for (let k=0;k<3;k++){ const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',hourCycle:'h23'}).formatToParts(new Date(guess)).map(x=>[x.type,x.value]));
    const asUtc = Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute); guess += Date.UTC(y,mo-1,da,h,mi) - asUtc; }
  return guess;
}
// self-test of tz conversion incl. DST end (first Sunday of Nov 2026 = Nov 1)
const t1 = jstOf(zonedToUtc('2026-10-31T10:00','America/Los_Angeles')); if (t1!=='2026-11-01T02:00:00+09:00') err('DST PDT conv '+t1);
const t2 = jstOf(zonedToUtc('2026-11-02T10:00','America/Los_Angeles')); if (t2!=='2026-11-03T03:00:00+09:00') err('PST conv '+t2);
if (!Array.isArray(d.services) || d.services.length!==12) err('services');
const SVC_IDS=['cursor','grok','meta','gemini','codex','claude','glm','bolt','kimi','kiro','copilot','windsurf'];
for (const id of SVC_IDS) { const s=d.services.find(x=>x.id===id); if(!s) { err('service missing '+id); continue; }
  if (!s.name_en) err(id+': name_en'); for (const l of ['en','zh-Hans','zh-Hant','ko','es','fr','de','pt-BR','hi','id']) if (!(s.name_i18n||{})[l]) err(`${id}: name_i18n.${l}`); }
const seenId = new Set(), seenUrl = new Set();
for (const s of d.services) {
  for (const k of ['id','name','official_name']) if (typeof s[k]!=='string') err(`${s.id}: ${k}`);
  if (!Array.isArray(s.items)) { err(`${s.id}: items`); continue; }
  for (let i=1;i<s.items.length;i++) if (s.items[i-1].announced_utc < s.items[i].announced_utc) err(`${s.id}: sort order at ${i}`);
  for (const it of s.items) {
    const tag = `${s.id}/${it.id}`;
    for (const [k,t] of Object.entries(REQ)) if (typeof it[k]!==t || !it[k]) err(`${tag}: ${k}`);
    if (!['immediate','scheduled','banked'].includes(it.type)) err(`${tag}: type`);
    if (!['done','scheduled'].includes(it.status)) err(`${tag}: status`);
    if (!ISO_Z.test(it.announced_utc)) err(`${tag}: announced_utc format`);
    if (!ISO_J.test(it.announced_jst)) err(`${tag}: announced_jst format`);
    if (!/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(it.url) || !it.url.endsWith('/'+it.id)) err(`${tag}: url`);
    if (seenId.has(it.id) || seenUrl.has(it.url)) err(`${tag}: duplicate`); seenId.add(it.id); seenUrl.add(it.url);
    const ms = Number((BigInt(it.id) >> 22n) + 1288834974657n);
    if (Math.floor(ms/1000)*1000 !== Date.parse(it.announced_utc)) err(`${tag}: snowflake ${new Date(ms).toISOString()} != ${it.announced_utc}`);
    if (jstOf(Date.parse(it.announced_utc)) !== it.announced_jst) err(`${tag}: announced_jst mismatch`);
    if (it.effective_jst_iso!=null && !ISO_J.test(it.effective_jst_iso)) err(`${tag}: effective_jst_iso format`);
    if (it.source_local_datetime) {
      if (!it.source_tz || !it.effective_jst_iso) err(`${tag}: tz/effective missing`);
      else { const j = jstOf(zonedToUtc(it.source_local_datetime, it.source_tz)); if (j!==it.effective_jst_iso) err(`${tag}: tz conv ${j} != ${it.effective_jst_iso}`); }
      if (Date.parse(it.effective_jst_iso) < Date.parse(it.announced_utc)) err(`${tag}: effective before announcement`);
    }
    if (it.confirmed_url && !/^https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+$/.test(it.confirmed_url)) err(`${tag}: confirmed_url`);
    if (it.confirmed_utc) { const cid=it.confirmed_url.split('/').pop(); const cms=Number((BigInt(cid)>>22n)+1288834974657n); if (Math.floor(cms/1000)*1000!==Date.parse(it.confirmed_utc)) err(`${tag}: confirmed snowflake`); }
    if (it.status==='done' && it.effective_jst_iso && Date.parse(it.effective_jst_iso) > Date.now() && !it.confirmed_url) err(`${tag}: future time but status done`);
    if (it.type==='scheduled' && !['exact','deadline','approximate'].includes(it.time_precision)) err(`${tag}: time_precision`);
    if (it.type!=='scheduled' && it.time_precision!=null) err(`${tag}: time_precision only for scheduled`);
    if (it.time_precision==='exact' && !it.source_local_datetime) err(`${tag}: exact needs source_local_datetime`);
    if (it.source_tz && typeof it.source_tz_assumed!=='boolean') err(`${tag}: source_tz_assumed must be boolean when source_tz set`);
    if (it.time_precision==='deadline' && it.source_local_datetime && !it.source_time_text) err(`${tag}: deadline needs original wording`);
    if (it.status==='done' && it.type==='scheduled' && it.effective_jst_iso && Date.parse(it.effective_jst_iso)>Date.parse(d.updated_jst) && !it.confirmed_utc) err(`${tag}: done before deadline w/o confirmation`);
    if (it.confirmed_utc && !ISO_Z.test(it.confirmed_utc)) err(`${tag}: confirmed_utc format`);
    if (/\uFFFD|Ã.|â€/.test(JSON.stringify(it))) err(`${tag}: mojibake`);
  }
}
// retention: stored data must be within retention_days of updated_jst, unless a future scheduled reset remains
const DAYS = Number(d.retention_days) || 30, upd = Date.parse(d.updated_jst);
if (Number.isNaN(upd)) err('updated_jst');
for (const s of d.services) for (const it of s.items) if (!isVisible(it, upd, DAYS)) err(`${s.id}/${it.id}: older than ${DAYS} days at updated_jst`);
// display filter spec
const NOW = Date.parse('2026-10-11T00:00:00Z');
const mk = (u, e) => ({ announced_utc: u, effective_jst_iso: e ?? null });
if (!isVisible(mk('2026-10-01T00:00:00Z'), NOW, 30)) err('filter: recent hidden');
if (isVisible(mk('2026-09-10T23:59:59Z'), NOW, 30)) err('filter: old shown');
if (!isVisible(mk('2026-08-01T00:00:00Z','2026-10-20T10:00:00+09:00'), NOW, 30)) err('filter: old post with future reset hidden');
if (isVisible(mk('2026-08-01T00:00:00Z','2026-10-01T10:00:00+09:00'), NOW, 30)) err('filter: old post with past reset shown');
if (isVisible(mk('bad'), NOW, 30) || isVisible(null, NOW, 30)) err('filter: invalid shown');
const arr = [mk('2026-09-20T00:00:00Z'), mk('2026-10-05T00:00:00Z'), mk('2026-09-30T00:00:00Z')].sort(newestFirst);
if (arr[0].announced_utc !== '2026-10-05T00:00:00Z' || arr[2].announced_utc !== '2026-09-20T00:00:00Z') err('newestFirst');
// allowlist: every entry's author must be on the allowlist for that service
const AL = JSON.parse(readFileSync(new URL('../ingest/allowlist.json', import.meta.url), 'utf8'));
const allowed = Object.fromEntries(Object.entries(AL.services).map(([k, v]) => [k, new Set(v.map(a => a.username.toLowerCase()))]));
const excluded = new Set((AL.excluded || []).map(a => a.username.toLowerCase()));
for (const [k, v] of Object.entries(AL.services)) for (const a of v) if (!a.role || !a.source) err(`allowlist ${k}/${a.username}: role/source missing`);
for (const s of d.services) for (const it of s.items) { const u = it.url.split('/')[3].toLowerCase();
  if (!allowed[s.id] || !allowed[s.id].has(u)) err(`${s.id}/${it.id}: author @${u} not on allowlist`);
  if (excluded.has(u)) err(`${s.id}/${it.id}: author @${u} is excluded`); }
// pending candidates must never be published
const PEND = JSON.parse(readFileSync(new URL('../ingest/pending.json', import.meta.url), 'utf8'));
for (const c of PEND.candidates || []) { if (seenId.has(c.id)) err(`pending ${c.id} is published`); if (!c.reason) err(`pending ${c.id}: reason missing`); }
const SRC = JSON.parse(readFileSync(new URL('../ingest/sources.json', import.meta.url), 'utf8'));
for (const x of SRC.sources || []) { if (!/^https:\/\//.test(x.url) || !x.type || !x.fetch || typeof x.official !== 'boolean' || !x.service) err(`sources: bad entry ${x.url}`); }
if (!(SRC.sources||[]).some(x=>x.official)) err('sources: no official sources');
for (const c of PEND.candidates || []) if (!c.channel) err(`pending ${c.id}: channel missing`);
const ST = JSON.parse(readFileSync(new URL('../ingest/state.json', import.meta.url), 'utf8'));
if (!ISO_Z.test(ST.last_run_utc)) err('state.last_run_utc');
// ---- i18n / core ----
const g2 = { }; vm.runInNewContext(readFileSync(new URL('../i18n.js', import.meta.url),'utf8')+';'+readFileSync(new URL('../core.js', import.meta.url),'utf8'), g2);
const { S: UI, LOCALES, NAMES, pick } = g2.I18N; const Core = g2.Core;
const REQUIRED_LOCALES = ['ja','en','zh-Hans','zh-Hant','ko','es','fr','de','pt-BR','hi','id'];
for (const l of REQUIRED_LOCALES) { if (!UI[l]) { err(`locale ${l} missing`); continue; } if (!NAMES[l]) err(`locale name ${l}`);
  for (const k of Object.keys(UI.ja)) if (typeof UI[l][k] !== 'string' || !UI[l][k].trim()) err(`i18n ${l}.${k} missing`);
  for (const k of Object.keys(UI[l])) if (!(k in UI.ja)) err(`i18n ${l}.${k} extra key`); }
const pk = [['ja-JP','ja'],['en-GB','en'],['zh-CN','zh-Hans'],['zh-TW','zh-Hant'],['zh-HK','zh-Hant'],['pt-PT','pt-BR'],['ko','ko'],['xx','ja']];
for (const [a,b] of pk) if (pick([a]) !== b) err(`pick ${a} -> ${pick([a])}`);
// every entry needs ja + en summary (source of truth ja; en required)
for (const s of d.services) for (const it of s.items) {
  if (!it.summary_i18n || !it.summary_i18n.en) err(`${s.id}/${it.id}: summary_i18n.en missing`);
  if (!it.effective_i18n || !it.effective_i18n.en) err(`${s.id}/${it.id}: effective_i18n.en missing`);
  if (it.note && !(it.note_i18n||{}).en) err(`${s.id}/${it.id}: note_i18n.en missing`);
  for (const l of Object.keys(it.summary_i18n||{})) if (!REQUIRED_LOCALES.includes(l)) err(`${s.id}/${it.id}: unknown locale ${l}`);
  if (Core.localized(it,'summary','xx') !== it.summary_i18n.en) err('fallback to en');
}
if (Core.localized({summary:'ja'},'summary','fr') !== 'ja') err('fallback to ja');
// times must come from structured fields, never be baked into text
for (const s of d.services) for (const it of s.items) for (const f of ['effective','note']) { const vals=[it[f]||'', ...Object.values(it[f+'_i18n']||{})];
  for (const v of vals) if (/日本時間|JST|\d+時\d+分|\b\d{1,2}:\d{2}\b/.test(v)) err(`${s.id}/${it.id}: hard-coded time in ${f}: ${v}`); }
for (const z of Core.ZONES) { const lab = Core.tzLabel(z,'ja',Date.parse('2026-10-11T00:00:00Z')); if (!/UTC/.test(lab)) err('tzLabel '+z+' '+lab); }
if (Core.tzLabel('America/Los_Angeles','en',Date.parse('2026-10-11T00:00:00Z')) !== 'Los Angeles UTC-7') err('tzLabel LA PDT '+Core.tzLabel('America/Los_Angeles','en',Date.parse('2026-10-11T00:00:00Z')));
if (Core.tzLabel('America/Los_Angeles','en',Date.parse('2026-11-05T00:00:00Z')) !== 'Los Angeles UTC-8') err('tzLabel LA PST');
if (Core.localized({summary:'日本語',summary_i18n:{en:'English'}},'summary','ja') !== '日本語') err('ja must use Japanese source');
// timezone rendering for several zones (same instant)
const inst = Date.parse('2026-10-11T16:00:00+09:00');
const tzCases = {'Asia/Tokyo':'16:00','America/New_York':'03:00','Europe/London':'08:00','Asia/Kolkata':'12:30','America/Los_Angeles':'00:00','UTC':'07:00','Asia/Shanghai':'15:00'};
for (const [z, hm] of Object.entries(tzCases)) { const out = Core.fmtDate(inst, 'en', z); if (!out.includes(hm)) err(`tz ${z}: ${out}`); }
// after DST end (Nov 1 2026) LA is UTC-8
if (!Core.fmtDate(Date.parse('2026-11-02T18:00:00Z'),'en','America/Los_Angeles').includes('10:00')) err('tz LA after DST end');
for (const z of Core.ZONES) { try { new Intl.DateTimeFormat('en',{timeZone:z}); } catch(e) { err(`bad zone ${z}`); } }
const pp = Core.parts(90061000); if (pp.d!==1||pp.h!==1||pp.m!==1||pp.s!==1) err('parts'); const pn = Core.parts(-5000); if (pn.d||pn.h||pn.m||pn.s) err('parts negative');
// ics generation
const ics = Core.buildIcs({id:'123',url:'https://x.com/a/status/123',effective_jst_iso:'2026-10-11T16:00:00+09:00',summary:'ja',summary_i18n:{en:'Reset; a, b'}}, 'OpenAI Codex', Date.parse('2026-10-11T04:00:00Z'));
for (const line of ['BEGIN:VCALENDAR','END:VCALENDAR','DTSTART:20261011T070000Z','DTEND:20261011T071500Z','UID:123@ai-limit-reset-jst','SUMMARY:OpenAI Codex usage-limit reset','DESCRIPTION:Reset\\; a\\, b\\nhttps://x.com/a/status/123']) if (!ics.includes(line+'\r\n')) err('ics missing '+line);
if (Core.buildIcs({id:'1',effective_jst_iso:null},'x',0) !== null) err('ics null');
const NOWB = Date.parse('2026-10-11T08:00:00Z');
if (Core.badge({type:'scheduled',status:'scheduled',effective_jst_iso:'2026-10-11T16:00:00+09:00'}, Date.parse('2026-10-11T06:00:00Z')) !== 'scheduled') err('badge scheduled');
if (Core.badge({type:'scheduled',status:'scheduled',effective_jst_iso:'2026-10-11T16:00:00+09:00'}, NOWB) !== 'done') err('badge passed');
if (Core.badge({type:'immediate',status:'done'}, NOWB) !== 'immediate') err('badge immediate');
// precision / hero
if (Core.precision({time_precision:'deadline'})!=='deadline' || Core.precision({source_local_datetime:'2026-10-11T00:00'})!=='exact' || Core.precision({})!=='approximate') err('precision');
const hs={id:'s'}, H=(it)=>({s:hs,it});
const dl={type:'scheduled',status:'scheduled',time_precision:'deadline',effective_jst_iso:'2026-10-11T16:00:00+09:00'};
let hp=Core.heroPick([H(dl)], Date.parse('2026-10-11T04:00:00Z')); if(!hp||hp.mode!=='upcoming'||hp.precision!=='deadline') err('hero upcoming deadline');
const dn={...dl,status:'done',confirmed_utc:'2026-10-11T04:01:09Z',confirmed_url:'https://x.com/a/status/1'};
hp=Core.heroPick([H(dn)], Date.parse('2026-10-11T04:45:00Z')); if(!hp||hp.mode!=='done') err('hero confirmed must show done, not countdown');
if (Core.heroPick([H(dn)], Date.parse('2026-10-12T05:00:00Z'))!==null) err('hero done expires after 24h');
if (Core.badge(dn, Date.parse('2026-10-11T04:45:00Z'))!=='done') err('badge confirmed before deadline');
if (Core.fmtTime(Date.parse('2026-10-11T04:01:09Z'),'ja','Asia/Tokyo')!=='13:01') err('fmtTime');
for (const l of REQUIRED_LOCALES) for (const k of ['hero_deadline','hero_approx','done_at']) if (!UI[l][k].includes('{t}')) err(`i18n ${l}.${k} needs {t}`);
for (const l of REQUIRED_LOCALES) if (!UI[l].tz_assumed.includes('{z}')) err(`i18n ${l}.tz_assumed needs {z}`);
// multiple upcoming: order by time, ties by precision, rest list
{ const N=Date.parse('2026-10-11T00:00:00Z'), sv=id=>({id});
  const mk=(sid,id,iso,p)=>({s:sv(sid),it:{id,type:'scheduled',status:'scheduled',effective_jst_iso:iso,time_precision:p}});
  const L=[mk('b','4','2026-10-12T10:00:00+09:00','approximate'),mk('a','1','2026-10-12T10:00:00+09:00','deadline'),mk('c','2','2026-10-11T12:00:00+09:00','exact'),mk('d','3','2026-10-12T10:00:00+09:00','exact'),
    mk('a','5','2026-10-13T00:00:00+09:00','exact'),{...mk('a','6','2026-10-12T00:00:00+09:00','exact'),it:{...mk('a','6','2026-10-12T00:00:00+09:00','exact').it,confirmed_utc:'2026-10-11T00:00:00Z'}},mk('a','7','2026-10-10T00:00:00+09:00','exact')];
  const u=Core.upcoming(L,N).map(x=>x.it.id).join(',');
  if (u!=='2,3,1,4,5') err('upcoming order/tie-break/filter: '+u);
  const hp=Core.heroPick(L,N); if (hp.x.it.id!=='2' || hp.rest.length!==4 || hp.rest[0].it.id!=='3') err('heroPick rest');
  if (Core.heroPick([L[0]],N).rest.length!==0) err('single upcoming has no rest');
  const same=[mk('z','9','2026-10-12T10:00:00+09:00','exact'),mk('y','8','2026-10-12T10:00:00+09:00','exact')]; if (Core.upcoming(same,N)[0].s.id!=='y') err('tie by service id');
  for (const l of REQUIRED_LOCALES) for (const k of ['others_up','tag_deadline','tag_approximate']) if (!UI[l][k]) err(`i18n ${l}.${k}`); }
{ const o=Core.lastPerService([{id:'a',items:[{announced_utc:'2026-10-01T00:00:00Z'},{announced_utc:'2026-09-01T00:00:00Z',confirmed_utc:'2026-10-05T00:00:00Z'}]},{id:'b',items:[]},{id:'c',items:[{announced_utc:'2026-10-03T00:00:00Z'}]}]);
  if (o.withItems.map(x=>x.s.id).join()!=='a,c' || o.empty.map(s=>s.id).join()!=='b' || o.withItems[0].count!==2) err('lastPerService');
  if (Core.shortUrl('https://x.com/a/status/2109132167112782291')!=='x.com/a/status/…2291') err('shortUrl'); }
console.log(fail ? `${fail} failure(s)` : `OK: ${seenId.size} entries`); process.exit(fail?1:0);
