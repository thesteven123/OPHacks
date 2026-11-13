'use client';
import { useCallback, useEffect, useState } from 'react';
import { QUEUE_EVENT, flushQueue, queuedCount } from '@/lib/queue';

const SUCCESS_MESSAGE_MS = 5000;
const plural = (n) => `${n} report${n === 1 ? '' : 's'}`;

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return online;
}

export function OfflinePill() {
  return useOnline() ? null : <span className="pill-offline">Offline</span>;
}

// OfflineSyncBanner (SPEC_TEMPLATE.md): queue count, sync status and a manual "Send now" trigger, announced politely.
export function OfflineSyncBanner() {
  const online = useOnline();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(0);

  const refresh = useCallback(() => queuedCount().then(setCount).catch(() => {}), []);

  const syncNow = useCallback(async () => {
    if (!(await queuedCount().catch(() => 0))) return;
    setSyncing(true);
    try {
      const { sent, limited, offline, failed: rejected } = await flushQueue();
      setFailed(rejected);
      if (limited) setMessage("Daily report limit reached. Saved reports will send automatically tomorrow.");
      else if (rejected) setMessage(`The server did not accept ${plural(rejected)}. ${rejected === 1 ? 'It remains' : 'They remain'} saved on this device.`);
      else if (sent && !offline) setMessage(`${plural(sent)} sent. Thank you.`);
    } catch {
      setMessage('Reports could not be read from this device storage. Free up storage or allow site data, then press Send now.');
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    if (navigator.onLine) syncNow();
    const onSwMessage = (e) => {
      if (e.data?.type !== 'queue-synced') return;
      setFailed(e.data.failed || 0);
      refresh();
    };
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener('online', syncNow);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener('online', syncNow);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [refresh, syncNow]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), SUCCESS_MESSAGE_MS);
    return () => clearTimeout(t);
  }, [message]);

  let text = message;
  if (!online) text = count ? `You're offline. ${plural(count)} saved on this device will send when you reconnect.` : "You're offline. New reports will be saved on this device and sent when you reconnect.";
  else if (failed && count && !message) text = `The server did not accept ${plural(failed)}. ${failed === 1 ? 'It remains' : 'They remain'} saved on this device.`;
  else if (count && !message) text = syncing ? `Sending ${plural(count)}…` : `${plural(count)} waiting to send.`;

  return (
    <div className={text ? `sync-banner${online ? '' : ' offline'}` : 'sr-only'} role="status" aria-live="polite">
      <span>{text}</span>
      {online && count > 0 && !message && (
        <button type="button" className="secondary" onClick={syncNow} disabled={syncing}>{syncing ? 'Sending…' : failed ? 'Try again' : 'Send now'}</button>
      )}
    </div>
  );
}
