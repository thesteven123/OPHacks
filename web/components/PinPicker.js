'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_CENTER } from '@/lib/config';

const PIN_ZOOM = 16;

function Picker({ coords, onPick }) {
  const map = useMap();
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng, 'Pin dropped on the map.') });
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), PIN_ZOOM));
  }, [coords, map]);
  return coords ? <CircleMarker center={[coords.lat, coords.lng]} radius={10} pathOptions={{ color: '#111827', fillOpacity: 0.5 }} /> : null;
}

export default function PinPicker({ coords, onPick }) {
  return (
    <MapContainer center={MAP_CENTER} zoom={13} className="pickmap">
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
      <Picker coords={coords} onPick={onPick} />
    </MapContainer>
  );
}
