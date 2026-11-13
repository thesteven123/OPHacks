// Offline queue (F2): reports wait in localStorage and resend with the same id, so the server deduplicates retries.
const TapQueue = (() => {
  const KEY = 'tapcheck-queue';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const write = (q) => localStorage.setItem(KEY, JSON.stringify(q));

  const add = (report) => write([...read(), report]);

  async function flush() {
    const remaining = [];
    for (const r of read()) {
      try {
        const res = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) });
        if (res.status >= 500) remaining.push(r);
      } catch {
        remaining.push(r);
      }
    }
    write(remaining);
    return remaining.length;
  }

  window.addEventListener('online', flush);
  return { add, flush };
})();
