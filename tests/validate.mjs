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
if (!Array.isArray(d.services) || d.services.length!==6) err('services');
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
    if (/[\uFFFD]|ã|â€/.test(JSON.stringify(it))) err(`${tag}: mojibake`);
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
const ST = JSON.parse(readFileSync(new URL('../ingest/state.json', import.meta.url), 'utf8'));
if (!ISO_Z.test(ST.last_run_utc)) err('state.last_run_utc');
console.log(fail ? `${fail} failure(s)` : `OK: ${seenId.size} entries`); process.exit(fail?1:0);
