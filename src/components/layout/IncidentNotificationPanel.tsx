import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronRight, ChevronLeft, Clock, MapPin, Plane, Radio, ShieldAlert, Cpu } from 'lucide-react';
import type { Incident, Drone, UserRole } from '../../types';
import { formatRelative, priorityBadgeClass } from '../../utils';

interface IncidentNotificationPanelProps {
  incidents: Incident[];
  drones: Drone[];
  isAutoDispatch: boolean;
  setIsAutoDispatch: (val: boolean) => void;
  onDispatchDrone: (droneId: string, nodeId: string) => void;
  currentRole: UserRole;
  isDark: boolean;
}

const junctionMap: Record<string, string> = {
  'Mavoor Road Junction': 'mavoor',
  'Bus Stand Junction': 'bus_stand',
  'Arayidathupalam Junction': 'arayidathupalam',
  'Mananchira Junction': 'mananchira',
  'Stadium Junction': 'stadium',
  'Midtown Junction': 'midtown',
  'Palayam Junction': 'palayam',
  'Poonthanam Junction': 'poonthanam',
  'East Bypass Junction': 'east_bypass',
  // Backwards compatibility for old names
  'KSRTC Jn': 'bus_stand',
  'New Bus Stand': 'bus_stand',
  'BMH Hospital Jn': 'arayidathupalam',
  'GTech Junction': 'mavoor',
  'Mananchira Jn': 'mananchira',
  'Puthiyara Junction': 'midtown',
  'Palayam Jn': 'palayam',
  'Chinthavalappu Jn': 'poonthanam',
  'Kalluthankadavu Jn': 'east_bypass',
};

export default function IncidentNotificationPanel({
  incidents,
  drones,
  isAutoDispatch,
  setIsAutoDispatch,
  onDispatchDrone,
  currentRole,
  isDark
}: IncidentNotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Calculate priority score out of 100
  const getPriorityScore = (incident: Incident) => {
    let score = 30;
    if (incident.priority === 'critical') score = 95;
    else if (incident.priority === 'high') score = 78;
    else if (incident.priority === 'medium') score = 54;
    else score = 28;

    // Shift score slightly based on the length of description
    const shift = (incident.description.length % 7) - 3;
    return Math.max(10, Math.min(100, score + shift));
  };

  const activeIncidents = incidents
    .filter(i => i.status === 'active' || i.status === 'pending')
    .sort((a, b) => getPriorityScore(b) - getPriorityScore(a));

  const getTrafficImpact = (incident: Incident) => {
    if (incident.priority === 'critical') {
      return 'Critical: Major gridlock. Speed reduced below 8 km/h. Expected delays > 40 min.';
    }
    if (incident.priority === 'high') {
      return 'High: Congested corridor. Speed reduced below 18 km/h. Expected delays 15–25 min.';
    }
    if (incident.priority === 'medium') {
      return 'Moderate: Light queue building. Speed reduced to 28 km/h. Expected delays 5–10 min.';
    }
    return 'Low: Marginal impact. Speeds normal. Expected delays < 3 min.';
  };

  const getRecommendedActions = (incident: Incident) => {
    const actions = [
      `Deploy nearest UAV to verify details.`,
      `Adjust coordinate signal phases on adjacent corridors.`
    ];
    if (incident.priority === 'critical' || incident.priority === 'high') {
      actions.push(`Push route diversion directive via Mini Bypass.`);
      actions.push(`Alert emergency response services.`);
    } else {
      actions.push(`Maintain standard monitoring pattern.`);
    }
    return actions;
  };

  const getNearestDrone = (incident: Incident) => {
    if (!incident.lat || !incident.lng) return drones[0] || null;
    let closest: Drone | null = null;
    let minDist = Infinity;
    for (const d of drones) {
      if (d.status === 'offline') continue;
      const dist = Math.sqrt((d.lat - incident.lat) ** 2 + (d.lng - incident.lng) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    return closest;
  };

  return (
    <div className="absolute lg:relative left-0 top-14 lg:top-0 h-[calc(100vh-3.5rem)] lg:h-full flex shrink-0 z-[90] lg:z-20">
      <motion.div
        animate={{ width: isOpen ? 340 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="h-full border-r border-white/[0.06] overflow-hidden flex flex-col bg-[#0F1117]/95 backdrop-blur-md"
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <div>
              <span className="text-xs font-mono text-gray-400 font-bold tracking-wider">INCIDENTS</span>
              <div className="text-[10px] font-mono text-gray-500">PRIORITY FEED</div>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
            {activeIncidents.length} Active
          </span>
        </div>

        {/* Dispatch Settings */}
        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/[0.04] flex items-center justify-between shrink-0">
          <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1 font-bold">
            <Cpu className="w-3.5 h-3.5 text-orange-400" /> UAV AUTO-DISPATCH
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAutoDispatch}
              onChange={(e) => setIsAutoDispatch(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500 peer-checked:after:bg-white peer-checked:after:border-orange-500"></div>
          </label>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {activeIncidents.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <ShieldAlert className="w-8 h-8 text-gray-700 mx-auto" />
              <p className="text-xs text-gray-500 font-mono">NO ACTIVE DISRUPTIONS</p>
            </div>
          ) : (
            activeIncidents.map((incident) => {
              const isExpanded = expandedId === incident.id;
              const priorityScore = getPriorityScore(incident);
              const trafficImpact = getTrafficImpact(incident);
              const nearestDrone = getNearestDrone(incident);
              const targetNodeId = junctionMap[incident.nearestJunction || ''] || 'stadium';

              return (
                <motion.div
                  key={incident.id}
                  layout
                  className={`border rounded-xl overflow-hidden transition-all ${
                    isExpanded
                      ? 'bg-white/[0.03] border-orange-500/20 shadow-[0_0_12px_rgba(249,115,22,0.05)]'
                      : 'bg-white/[0.01] border-white/[0.06] hover:border-white/[0.12] cursor-pointer'
                  }`}
                  onClick={() => !isExpanded && setExpandedId(incident.id)}
                >
                  {/* Card Header */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 shrink-0 ${
                            incident.priority === 'critical' ? 'text-red-400' : 'text-orange-400'
                          }`}
                        />
                        <span className="text-sm font-bold text-white truncate">{incident.type}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 rounded font-bold">
                          Rank #{activeIncidents.findIndex(i => i.id === incident.id) + 1}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold ${priorityBadgeClass(incident.priority)}`}>
                          {incident.priority.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-300 font-sans flex items-center gap-1.5 font-semibold">
                      <span>📍 {incident.location}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.03] text-[10px] font-mono text-gray-400">
                      <span>{formatRelative(incident.timestamp)}</span>
                      <span className="text-orange-400 font-bold">Ledger: {incident.tokenId}</span>
                    </div>
                  </div>

                  {/* Accordion Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/[0.04] bg-black/25 px-3 py-2.5 space-y-2.5 text-xs"
                      >
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded p-1.5">
                            <span className="text-[9px] text-gray-500 font-mono block font-bold">GPS COORDS</span>
                            <span className="font-mono text-cyan-400 text-[10px] leading-tight block">
                              {incident.lat ? `${incident.lat.toFixed(4)}°N` : '—'}
                              <br />
                              {incident.lng ? `${incident.lng.toFixed(4)}°E` : '—'}
                            </span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded p-1.5 flex flex-col justify-center">
                            <span className="text-[9px] text-gray-500 font-mono block font-bold">NEAREST JN</span>
                            <span className="font-mono text-orange-400 text-[10px] leading-tight truncate">
                              {incident.nearestJunction || 'None'}
                            </span>
                          </div>
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded p-1.5 flex flex-col justify-center">
                            <span className="text-[9px] text-gray-500 font-mono block font-bold">SEVERITY</span>
                            <div className="flex items-baseline gap-0.5 mt-0.5">
                              <span className="text-xs font-bold text-white font-mono">{priorityScore}</span>
                              <span className="text-[8px] text-gray-500">/100</span>
                            </div>
                          </div>
                        </div>

                        {incident.affectedRoads && incident.affectedRoads.length > 0 && (
                          <div>
                            <span className="text-[10px] text-gray-500 font-mono block mb-1 font-bold">AFFECTED ROADS</span>
                            <div className="flex flex-wrap gap-1">
                              {incident.affectedRoads.map((road) => (
                                <span key={road} className="text-[9px] bg-orange-500/10 text-orange-300 border border-orange-500/20 px-1.5 rounded font-bold">
                                  {road}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] text-gray-500 font-mono block mb-0.5 font-bold">TRAFFIC FLOW IMPACT</span>
                          <p className="text-gray-300 leading-normal font-sans">{trafficImpact}</p>
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-500 font-mono block mb-1 font-bold">RECOMMENDED DIRECTIVES</span>
                          <div className="space-y-1">
                            {getRecommendedActions(incident).map((action, i) => (
                              <div key={i} className="flex gap-1.5 text-gray-300 font-sans">
                                <span className="text-orange-400 shrink-0">⚡</span>
                                <span className="leading-tight">{action}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* UAV Dispatch verification area */}
                        {nearestDrone && (
                          <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-blue-400 font-mono font-bold flex items-center gap-1">
                                <Plane className="w-3.5 h-3.5" /> NEAREST UAV
                              </span>
                              <span className="text-[10px] font-mono text-gray-300">{nearestDrone.name} ({nearestDrone.battery.toFixed(0)}% bat)</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDispatchDrone(nearestDrone.id, targetNodeId);
                              }}
                              disabled={nearestDrone.status === 'transit'}
                              className={`w-full py-1.5 rounded font-mono text-[10px] font-bold uppercase transition-all ${
                                nearestDrone.status === 'transit'
                                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 cursor-default'
                                  : 'bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                              }`}
                            >
                              {nearestDrone.status === 'transit' ? '✈ Transiting to Site...' : '⚡ Dispatch UAV for verification'}
                            </button>
                          </div>
                        )}

                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedId(null);
                            }}
                            className="flex-1 py-1 bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] rounded text-gray-400 hover:text-white font-mono text-[10px] uppercase font-bold"
                          >
                            Collapse
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </motion.div>

      {/* Side toggle handle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="absolute top-1/2 -translate-y-1/2 -right-3 w-6 h-6 rounded-full bg-[#1C202B] border border-white/[0.08] flex items-center justify-center text-gray-500 hover:text-white transition-colors z-30"
      >
        {isOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </div>
  );
}
