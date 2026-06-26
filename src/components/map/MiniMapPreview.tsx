import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface MiniMapPreviewProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  color?: string;
  polygon?: [number, number][];
  isDark?: boolean;
}

export default function MiniMapPreview({ lat, lng, label, height = 180, color = '#F97316', polygon, isDark = true }: MiniMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });
    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    L.tileLayer(tileUrl, {
      subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="1">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
        </svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });
    L.marker([lat, lng], { icon: pinIcon }).addTo(map);

    if (polygon && polygon.length >= 3) {
      const poly = L.polygon(polygon, { color, fillColor: color, fillOpacity: 0.15, weight: 2 }).addTo(map);
      map.fitBounds(poly.getBounds(), { padding: [20, 20] });
    }

    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (leafletMap.current) leafletMap.current.setView([lat, lng], 15);
  }, [lat, lng]);

  return (
    <div className="rounded-lg overflow-hidden border border-white/[0.08] relative">
      <div ref={mapRef} style={{ height }} className="w-full" />
      {label && (
        <div className="absolute top-2 left-2 bg-[#0F1117]/90 border border-white/[0.08] rounded px-2 py-1 text-[10px] font-mono text-orange-400 z-[400]">
          {label}
        </div>
      )}
    </div>
  );
}