'use client';
import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { MAP_CENTER, SEVERITY, STATUS_COLORS } from '@/lib/config';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const popupHtml = (r) => `<b>${esc(r.issue_type.replace('_', ' '))}</b> · ${esc(r.status)} · ${SEVERITY[r.severity]}<br>
  ${r.photo_url ? `<img class="thumb" src="${esc(r.photo_url)}" alt="Reported photo" loading="lazy"><br>` : ''}
  ${esc(r.description)}<br><small>${new Date(r.created_at).toLocaleString()}</small><br>
  <small>Approximate location (about 100 m). Not an official water test.</small>`;

// leaflet.markercluster extends the global L, so expose it before loading the plugin.
function Clusters({ reports }) {
  const map = useMap();
  useEffect(() => {
    let group;
    let cancelled = false;
    window.L = L;
    import('leaflet.markercluster').then(() => {
      if (cancelled) return;
      group = L.markerClusterGroup();
      reports.forEach((r) =>
        L.circleMarker([r.public_lat, r.public_lng], { radius: 9, color: STATUS_COLORS[r.status], fillOpacity: 0.6 }).bindPopup(popupHtml(r)).addTo(group));
      map.addLayer(group);
    });
    return () => { cancelled = true; if (group) map.removeLayer(group); };
  }, [map, reports]);
  return null;
}

export default function ReportMap({ reports }) {
  return (
    <MapContainer center={MAP_CENTER} zoom={13} className="fullmap">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <Clusters reports={reports} />
    </MapContainer>
  );
}
