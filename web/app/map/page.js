'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ISSUE_LABELS, PUBLIC_API_URL, STATUS_COLORS } from '@/lib/config';
import { useOnline } from '@/components/OfflineStatus';

const ReportMap = dynamic(() => import('@/components/ReportMap'), { ssr: false, loading: () => <div className="fullmap" /> });
const DAY_MS = 864e5;
const LEGEND = ['open', 'verified', 'forwarded', 'resolved'];

export default function MapPage() {
  const [reports, setReports] = useState([]);
  const [type, setType] = useState('');
  const [days, setDays] = useState('7');
  const [error, setError] = useState('');
  const online = useOnline();

  useEffect(() => {
    fetch(`${PUBLIC_API_URL}/api/reports`).then((r) => r.json()).then(setReports).catch(() => setError('Could not load reports. Check your connection.'));
  }, []);

  const shown = useMemo(
    () => reports.filter((r) => (!type || r.issue_type === type) && (!Number(days) || Date.now() - new Date(r.created_at) < Number(days) * DAY_MS)),
    [reports, type, days],
  );

  return (
    <>
      <div className="filters">
        <label htmlFor="type" className="sr-only">Issue type</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(ISSUE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label htmlFor="age" className="sr-only">Age</label>
        <select id="age" value={days} onChange={(e) => setDays(e.target.value)}>
          <option value="1">Last 24 h</option>
          <option value="7">Last 7 days</option>
          <option value="0">All</option>
        </select>
        <span className="legend">{LEGEND.map((s) => <span key={s}><i style={{ background: STATUS_COLORS[s] }} />{s}</span>)}</span>
        <a href={`${PUBLIC_API_URL}/api/export?format=csv`}>CSV</a>
        <a href={`${PUBLIC_API_URL}/api/export?format=geojson`}>GeoJSON</a>
        {!online && <span className="status">Viewing cached reports. Reconnect for updates.</span>}
        {error && <span className="status">{error}</span>}
      </div>
      <ReportMap reports={shown} />
    </>
  );
}
