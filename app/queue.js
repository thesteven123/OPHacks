// Offline queue (F2): reports wait in localStorage and resend with the same id, so the server deduplicates retries.
const TapQueue = (() => {
  const KEY = 'tapcheck-queue';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const write = (q) => localStorage.setItem(KEY, JSON.stringify(q));

  // localStorage holds ~5 MB; if a photo doesn't fit, keep the report and drop the photo.
  function add(report) {
    try {
      write([...read(), report]);
      return { photoDropped: false };
    } catch {
      write([...read(), { ...report, photo: null }]);
      return { photoDropped: Boolean(report.photo) };
    }
  }

  async function flush() {
    const keep = [];
    let offline = 0, limited = 0, remaining;
    for (const r of read()) {
      try {
        const res = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) });
        if (res.status === 429) { limited++; keep.push(r); }
        else if (res.status >= 500) { offline++; keep.push(r); }
        else remaining = (await res.json()).remaining;
      } catch {
        offline++; keep.push(r);
      }
    }
    write(keep);
    return { offline, limited, remaining };
  }

  window.addEventListener('online', flush);
  return { add, flush };
})();
