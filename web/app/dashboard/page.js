import { publicFetch } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = await publicFetch('/api/stats').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const kpis = stats && [
    ['Total reports', stats.total],
    ['Open', stats.open],
    ['Verified or forwarded', stats.verified + stats.forwarded],
    ['Resolved', stats.resolved],
  ];
  return (
    <main>
      <h1>Report status</h1>
      {kpis ? (
        <>
          <div className="kpis">{kpis.map(([label, n]) => <div key={label}><span>{n}</span>{label}</div>)}</div>
          <p className="small">{stats.last_updated ? `Last updated ${new Date(stats.last_updated).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} (Pacific)` : 'No reports yet.'}</p>
        </>
      ) : (
        <p className="status">Could not load status right now. Try again in a minute.</p>
      )}
      <p className="disclaimer">This is not a substitute for official water testing.</p>
    </main>
  );
}
