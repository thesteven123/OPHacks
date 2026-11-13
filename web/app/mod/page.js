'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import { SEVERITY } from '@/lib/config';

const ACTIONS = [['open', 'Open'], ['verified', 'Verify'], ['forwarded', 'Forward to utility'], ['resolved', 'Resolve'], ['rejected', 'Spam / remove']];
const SORTS = { created_at: 'Newest', issue_type: 'Type', status: 'Status', severity: 'Severity' };
const DESCENDING = new Set(['created_at', 'severity']);

function ReportCard({ report: r, onSave }) {
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.moderator_note);
  return (
    <div className={`card status-${r.status}`}>
      <div><b>{r.issue_type.replace('_', ' ')}</b> <span>· {r.status} · {SEVERITY[r.severity]} · {new Date(r.created_at).toLocaleString()}</span></div>
      <p>{r.description || 'No details.'}</p>
      <p className="small">
        Lasted: {r.duration.replace('_', ' ')} · Usable: {r.water_usable} · GPS {r.precise_lat.toFixed(5)}, {r.precise_lng.toFixed(5)}
        {r.contact_email && ` · Contact: ${r.contact_email}`}
      </p>
      {r.photo_url && <img className="thumb" src={r.photo_url} alt="Reported photo" />}
      <div className="row">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input aria-label="Internal note" placeholder="Internal note (moderators only)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button onClick={() => onSave(r.id, status, note)}>Save</button>
      </div>
    </div>
  );
}

export default function ModPage() {
  const [reports, setReports] = useState(null);
  const [sort, setSort] = useState('created_at');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/mod/reports');
    if (res.status === 401) return signOut({ callbackUrl: '/login' });
    if (!res.ok) return setMessage('Could not load reports.');
    setReports(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(id, status, note) {
    const res = await fetch(`/api/mod/reports/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status, note }) });
    if (res.status === 401) return signOut({ callbackUrl: '/login' });
    setMessage(res.ok ? 'Saved.' : 'Save failed.');
    load();
  }

  const sorted = useMemo(() => [...(reports || [])].sort((a, b) => {
    const cmp = String(a[sort]).localeCompare(String(b[sort]));
    return DESCENDING.has(sort) ? -cmp : cmp;
  }), [reports, sort]);

  return (
    <main className="wide">
      <div className="toolbar">
        <h1>Moderation queue</h1>
        <button className="link" onClick={() => signOut({ callbackUrl: '/login' })}>Log out</button>
      </div>
      <label htmlFor="sort" className="inline">Sort by</label>
      <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
        {Object.entries(SORTS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <p className="status" role="status">{message || (reports && !reports.length ? 'No reports yet.' : '')}</p>
      {sorted.map((r) => <ReportCard key={`${r.id}-${r.status}-${r.moderator_note}`} report={r} onSave={save} />)}
    </main>
  );
}
