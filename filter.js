// Shared by the page and tests: show posts from the last `days` days, plus any future scheduled reset.
(function (g) {
  function isVisible(it, nowMs, days) {
    if (!it) return false;
    const posted = Date.parse(it.announced_utc);
    const eff = Date.parse(it.effective_jst_iso);
    if (!Number.isNaN(eff) && eff > nowMs) return true;
    return !Number.isNaN(posted) && posted >= nowMs - days * 86400000 && posted <= nowMs + 60000;
  }
  function newestFirst(a, b) { return (Date.parse(b.announced_utc) || 0) - (Date.parse(a.announced_utc) || 0); }
  g.LimitFilter = { isVisible, newestFirst, DAYS: 30 };
})(typeof globalThis !== 'undefined' ? globalThis : window);
