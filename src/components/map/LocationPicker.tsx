import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { X, MapPin, Crosshair, Check } from 'lucide-react';
import { findNearestJunction } from '../../data/constants';

interface LocationPickerProps {
  onClose: () => void;
  onConfirm: (data: { lat: number; lng: number; nearestJunction: string; affectedRoads: string[] }) => void;
  initialLat?: number;
  initialLng?: number;
  mode?: 'pin' | 'zone';
  onConfirmZone?: (polygon: [number, number][]) => void;
}

const DEFAULT_CENTER: [number, number] = [11.2588, 75.7873];

export default function LocationPicker({ onClose, onConfirm, initialLat, initialLng, mode = 'pin', onConfirmZone }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [drawMode, setDrawMode] = useState<'pin' | 'polygon'>('pin');

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: position ? [position.lat, position.lng] : DEFAULT_CENTER,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    if (position) {
      const pinIcon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#F97316" stroke="#fff" stroke-width="1">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
          </svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const newMarker = L.marker([position.lat, position.lng], { icon: pinIcon, draggable: true }).addTo(map);
      newMarker.on('dragend', () => {
        const latLng = newMarker.getLatLng();
        setPosition({ lat: latLng.lat, lng: latLng.lng });
      });
      markerRef.current = newMarker;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (drawModeRef.current === 'pin') {
        const { lat, lng } = e.latlng;
        setPosition({ lat, lng });
      } else {
        setPolygonPoints(prev => {
          const next: [number, number][] = [...prev, [e.latlng.lat, e.latlng.lng]];
          if (polygonRef.current) {
            polygonRef.current.setLatLngs(next);
          } else {
            polygonRef.current = L.polygon(next, {
              color: '#F97316', fillColor: '#F97316', fillOpacity: 0.15, weight: 2,
            }).addTo(map);
          }
          return next;
        });
      }
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state coordinates to Leaflet marker & map position
  useEffect(() => {
    if (!leafletMap.current || !position || drawMode !== 'pin') return;

    const pinIcon = L.divIcon({
      className: '',
      html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;transform:translate(-50%,-100%);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#F97316" stroke="#fff" stroke-width="1">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    if (markerRef.current) {
      const currentLatLng = markerRef.current.getLatLng();
      if (currentLatLng.lat !== position.lat || currentLatLng.lng !== position.lng) {
        markerRef.current.setLatLng([position.lat, position.lng]);
        leafletMap.current.panTo([position.lat, position.lng]);
      }
    } else {
      const newMarker = L.marker([position.lat, position.lng], { icon: pinIcon, draggable: true }).addTo(leafletMap.current);
      newMarker.on('dragend', () => {
        const latLng = newMarker.getLatLng();
        setPosition({ lat: latLng.lat, lng: latLng.lng });
      });
      markerRef.current = newMarker;
    }
  }, [position, drawMode]);

  // Remove marker if switching to polygon drawing
  useEffect(() => {
    if (drawMode !== 'pin' && markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [drawMode]);

  // Keep a ref to drawMode for the click handler closure
  const drawModeRef = useRef(drawMode);
  useEffect(() => { drawModeRef.current = drawMode; }, [drawMode]);

  const nearest = position ? findNearestJunction(position.lat, position.lng) : null;

  const handleConfirm = () => {
    if (mode === 'zone' && drawMode === 'polygon') {
      if (polygonPoints.length >= 3 && onConfirmZone) {
        onConfirmZone(polygonPoints);
        onClose();
      }
      return;
    }
    if (position && nearest) {
      onConfirm({
        lat: position.lat,
        lng: position.lng,
        nearestJunction: nearest.name,
        affectedRoads: nearest.roads,
      });
      onClose();
    }
  };

  const resetPolygon = () => {
    setPolygonPoints([]);
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-2xl rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0F1117]"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
        <div className="p-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-orange-400" />
            <div>
              <div className="text-sm font-bold text-white">
                {mode === 'zone' ? 'Select Area' : 'Select Incident Location'}
              </div>
              <div className="text-[10px] text-gray-500 font-mono">
                {mode === 'zone' ? 'Drop a pin or draw a zone polygon' : 'Click on the map to drop a pin'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'zone' && (
          <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2">
            <button
              onClick={() => { setDrawMode('pin'); resetPolygon(); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase transition-all ${
                drawMode === 'pin' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'border border-white/[0.08] text-gray-500'
              }`}>
              Drop Pin
            </button>
            <button
              onClick={() => setDrawMode('polygon')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase transition-all ${
                drawMode === 'polygon' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'border border-white/[0.08] text-gray-500'
              }`}>
              Draw Zone
            </button>
            {drawMode === 'polygon' && polygonPoints.length > 0 && (
              <button onClick={resetPolygon} className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase text-gray-500 hover:text-red-400 transition-all">
                Clear ({polygonPoints.length} pts)
              </button>
            )}
          </div>
        )}

        <div ref={mapRef} style={{ height: 360 }} className="w-full" />

        {/* Preview */}
        <div className="p-4 space-y-2">
          {drawMode === 'pin' && position && nearest && (
            <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06] space-y-2">
              <div className="flex items-center gap-2 text-xs text-white font-semibold">
                <MapPin className="w-3.5 h-3.5 text-orange-400" /> Location Preview
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="bg-white/[0.03] rounded p-2">
                  <div className="text-gray-500 mb-1">Latitude</div>
                  <input
                    type="number"
                    step="0.00001"
                    value={position.lat}
                    onChange={e => {
                      const lat = parseFloat(e.target.value);
                      if (!isNaN(lat)) setPosition(prev => ({ ...prev!, lat }));
                    }}
                    className="w-full bg-transparent border-b border-white/[0.1] text-cyan-400 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
                  />
                </div>
                <div className="bg-white/[0.03] rounded p-2">
                  <div className="text-gray-500 mb-1">Longitude</div>
                  <input
                    type="number"
                    step="0.00001"
                    value={position.lng}
                    onChange={e => {
                      const lng = parseFloat(e.target.value);
                      if (!isNaN(lng)) setPosition(prev => ({ ...prev!, lng }));
                    }}
                    className="w-full bg-transparent border-b border-white/[0.1] text-cyan-400 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
                  />
                </div>
                <div className="bg-white/[0.03] rounded p-2 col-span-2">
                  <div className="text-gray-500">Nearest Junction</div>
                  <div className="text-orange-400">{nearest.name}</div>
                </div>
                <div className="bg-white/[0.03] rounded p-2 col-span-2">
                  <div className="text-gray-500 mb-1">Affected Roads</div>
                  <div className="flex flex-wrap gap-1">
                    {nearest.roads.map(r => (
                      <span key={r} className="text-[9px] bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded px-1.5 py-0.5">{r}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {drawMode === 'polygon' && (
            <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06] text-[10px] font-mono text-gray-400">
              {polygonPoints.length < 3
                ? `Click on the map to add points (${polygonPoints.length}/3 minimum)`
                : `Zone defined with ${polygonPoints.length} points — ready to save`}
            </div>
          )}

          {!position && drawMode === 'pin' && (
            <div className="text-center text-[11px] text-gray-500 py-2">No location selected yet — click the map</div>
          )}

          <motion.button
            onClick={handleConfirm}
            disabled={(drawMode === 'pin' && !position) || (drawMode === 'polygon' && polygonPoints.length < 3)}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 rounded-lg font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white' }}
          >
            <Check className="w-4 h-4" /> Confirm Location
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
