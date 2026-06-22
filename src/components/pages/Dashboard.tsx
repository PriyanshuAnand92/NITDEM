import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, AlertTriangle, Activity, MapPin, Car, Cpu, TrendingUp, TrendingDown, Minus, Sparkles, Radio, Video, Zap } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Drone, Incident, TrafficNode } from '../../types';
import { statusColor } from '../../utils';

interface DashboardProps {
  drones: Drone[];
  incidents: Incident[];
  nodes: TrafficNode[];
  telemetryLogs?: any[];
  predictionLogs?: any[];
  playbackIndex?: number;
  isAutoDispatch?: boolean;
  onDispatchDrone?: (droneId: string, nodeId: string) => void;
}

function useAnimatedValue(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function KPICard({ label, value, unit, icon: Icon, color, trend }: {
  label: string; value: number; unit?: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string; trend?: 'up' | 'down' | 'flat';
}) {
  const animated = useAnimatedValue(value);
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-5 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at top right, ${color}, transparent 60%)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5.5 h-5.5" style={{ color }} />
        </div>
        {trend && (
          <TrendIcon className={`w-4 h-4 ${trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-gray-500'}`} />
        )}
      </div>
      <div className="text-3xl font-extrabold font-mono" style={{ color }}>
        {animated.toLocaleString()}{unit}
      </div>
      <div className="text-xs text-gray-400 mt-1.5 font-sans font-semibold tracking-wider uppercase">{label}</div>
    </motion.div>
  );
}

// Generate time-series fallback data
function genData() {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(now - (23 - i) * 3600000).getHours() + ':00',
    vehicles: 800 + Math.floor(Math.random() * 1200),
    incidents: Math.floor(Math.random() * 5),
    flow: 60 + Math.floor(Math.random() * 35),
  }));
}

const CHART_DATA = genData();

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

export default function Dashboard({
  drones,
  incidents,
  nodes,
  telemetryLogs,
  predictionLogs,
  playbackIndex,
  isAutoDispatch,
  onDispatchDrone
}: DashboardProps) {
  const totalVehicles = nodes.reduce((s, n) => s + n.vehicleCount, 0);
  const activeIncidents = incidents.filter(i => i.status === 'active' || i.status === 'pending').length;
  const congestionZones = nodes.filter(n => n.status === 'heavy' || n.status === 'critical').length;
  const flowScore = Math.round(100 - nodes.reduce((s, n) => s + n.density, 0) / nodes.length);

  // Map dynamic CSV telemetry logs to chart data
  const liveChartData = telemetryLogs && telemetryLogs.length > 0 && playbackIndex !== undefined
    ? telemetryLogs.slice(Math.max(0, playbackIndex - 15), playbackIndex + 1).map((log, index) => {
        const timePart = log.timestamp.split(' ')[1] || log.timestamp;
        const flowVal = Math.round(100 - log.densityPercent);
        return {
          time: timePart.slice(0, 5),
          vehicles: Math.round(log.densityPercent * 14.5),
          flow: flowVal,
        };
      })
    : CHART_DATA;

  // 20-minute future predictions lookup (lookahead index in logs)
  const lookaheadIndex = playbackIndex !== undefined && predictionLogs 
    ? Math.min(predictionLogs.length - 1, playbackIndex + 10) 
    : 0;

  const futureLog = predictionLogs && predictionLogs[lookaheadIndex];
  const predictedMavoorDensity = futureLog ? Math.round(futureLog.densityPercent) : 56;
  const predictedFlow = 100 - predictedMavoorDensity;
  const predictedStatus = predictedMavoorDensity >= 85 ? 'critical' :
                          predictedMavoorDensity >= 65 ? 'heavy' :
                          predictedMavoorDensity >= 40 ? 'moderate' : 'free';

  // Capture active incident junction
  const activeIncident = incidents.find(i => i.status === 'active' || i.status === 'pending');

  // Trigger bottleneck alert popup
  const isBottleneckPredicted = predictedMavoorDensity > 65 || activeIncident;
  
  const alertData = isBottleneckPredicted ? {
    type: activeIncident ? `Surge: ${activeIncident.type}` : 'Predicted Bottleneck Alert',
    location: activeIncident ? activeIncident.location : 'Mavoor Road Junction',
    severity: activeIncident ? activeIncident.priority : (predictedMavoorDensity > 80 ? 'critical' : 'high'),
    measures: activeIncident 
      ? `Deploy nearest UAV to ${activeIncident.nearestJunction || 'site'}, deploy manual overridden signals, divert incoming traffic.` 
      : 'Divert heavy vehicles to East Bypass, optimize cycle time to +15s green phase on Mavoor corridor.'
  } : null;

  // Locate active drone on-site at the incident junction
  const activeIncidentJunctionName = activeIncident?.nearestJunction || '';
  const activeIncidentJunctionNodeId = junctionMap[activeIncidentJunctionName] || '';

  const activeDroneOnSite = drones.find(d => {
    if (d.status !== 'streaming') return false;
    const loc = d.location.toLowerCase();
    const incidentJunc = activeIncidentJunctionName.toLowerCase();
    const nodeJunc = activeIncidentJunctionNodeId.toLowerCase();
    return loc.includes(incidentJunc) || (nodeJunc && loc.includes(nodeJunc));
  });

  // Load JPEG snapshot frame from GCS bucket corresponding to active drone's position
  let snapshotImageSrc = '';
  if (activeDroneOnSite) {
    const loc = activeDroneOnSite.location.toLowerCase();
    if (loc.includes('stadium')) snapshotImageSrc = '/drone_stadium.png';
    else if (loc.includes('bus stand') || loc.includes('bus_stand')) snapshotImageSrc = '/drone_bus_stand.png';
    else if (loc.includes('palayam')) snapshotImageSrc = '/drone_palayam.png';
    else if (loc.includes('mananchira')) snapshotImageSrc = '/drone_mananchira.png';
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Operations Dashboard</h1>
          <p className="text-xs text-gray-400 font-sans mt-0.5">Kozhikode Traffic Intelligence · Live Overview</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="text-xs font-mono text-green-400 font-bold">ALL SYSTEMS NOMINAL</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Active Drones" value={drones.filter(d => d.status !== 'offline').length} icon={Plane} color="#3B82F6" trend="flat" />
        <KPICard label="Active Incidents" value={activeIncidents} icon={AlertTriangle} color="#EF4444" trend="up" />
        <KPICard label="Flow Score" value={flowScore} unit="%" icon={Activity} color="#22C55E" trend="down" />
        <KPICard label="Congestion Zones" value={congestionZones} icon={MapPin} color="#F97316" trend="up" />
        <KPICard label="Vehicles Detected" value={totalVehicles} icon={Car} color="#F59E0B" trend="up" />
        <KPICard label="AI Accuracy" value={96} unit="%" icon={Cpu} color="#A855F7" trend="flat" />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Real-Time Charts & Status Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1 */}
            <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-base font-bold text-white">Vehicle Flow telemetry</div>
                  <div className="text-xs text-gray-400 font-sans mt-0.5">Dynamic CSV log playback</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={liveChartData}>
                  <defs>
                    <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }} />
                  <Tooltip contentStyle={{ background: '#151820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="vehicles" stroke="#F97316" fill="url(#vGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2 */}
            <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-base font-bold text-white">Traffic Flow Score</div>
                  <div className="text-xs text-gray-400 font-sans mt-0.5">Dynamic Efficiency % over time</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={liveChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'JetBrains Mono' }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: '#151820', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="flow" stroke="#22C55E" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Node Status Table */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <span className="text-base font-bold text-white">Node Status Overview</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04] bg-white/[0.01]">
                    {['Node', 'Status', 'Density', 'Vehicles', 'Speed', 'Incidents'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-mono text-gray-400 tracking-wider uppercase font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node, i) => (
                    <motion.tr key={node.id}
                      layout
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-sm font-semibold text-white">
                        <div className="flex items-center gap-2">
                          {['stadium', 'midtown', 'bus_stand', 'mavoor'].includes(node.id) && (
                            <span className="text-[10px] bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">🚦 Signal</span>
                          )}
                          <span>{node.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor(node.status) }} />
                          <span className="text-xs font-mono capitalize font-bold" style={{ color: statusColor(node.status) }}>{node.status}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-white/[0.06] rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${node.density}%`, backgroundColor: statusColor(node.status) }} />
                          </div>
                          <span className="text-xs font-mono text-gray-300">{node.density}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-gray-200">{node.vehicleCount.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-xs font-mono text-gray-200">{node.avgSpeed} km/h</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-mono font-bold ${node.incidentCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {node.incidentCount}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: UAV Snapshot Feed & 20-minute Future Prediction Panel */}
        <div className="space-y-6">
          {/* Live UAV Snapshot Feed */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl overflow-hidden flex flex-col">
            <div className="bg-white/[0.03] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-bold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-cyan-400" /> LIVE UAV FEED
              </span>
              {activeDroneOnSite ? (
                <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full animate-pulse font-bold">
                  VERIFIED STREAMING
                </span>
              ) : (
                <span className="text-[10px] font-mono text-gray-400 bg-white/[0.05] px-2 py-0.5 rounded-full font-bold">
                  SCANNING FOR TRANSMISSIONS
                </span>
              )}
            </div>

            <div className="h-[190px] bg-black relative flex items-center justify-center overflow-hidden group">
              {snapshotImageSrc ? (
                <>
                  <img src={snapshotImageSrc} alt="UAV Snapshot" className="w-full h-full object-cover" />
                  {/* Scanline / HUD overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none" />
                  <div className="absolute top-2 left-2 font-mono text-[10px] text-white bg-black/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                    <Radio className="w-2.5 h-2.5 text-cyan-400 animate-ping" />
                    UAV TELEMETRY: {activeDroneOnSite?.name.toUpperCase()} (ALT: {activeDroneOnSite?.altitude}m)
                  </div>
                </>
              ) : (
                <div className="text-center p-5 space-y-3 relative z-10 w-full h-full flex flex-col justify-center bg-zinc-950">
                  <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                  {/* Dynamic CRT static lines */}
                  <div className="w-12 h-12 border border-dashed border-white/[0.1] rounded-full flex items-center justify-center mx-auto text-gray-500">
                    <Plane className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-mono text-gray-400 uppercase font-bold">No UAV Feed Connected</div>
                    <p className="text-[10px] text-gray-500 font-sans mt-1">Dispatch a UAV to active incident junctions for verification.</p>
                  </div>
                  {activeIncident && onDispatchDrone && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetNodeId = junctionMap[activeIncidentJunctionName] || 'stadium';
                        const closestDrone = drones.find(d => d.status !== 'offline');
                        if (closestDrone) onDispatchDrone(closestDrone.id, targetNodeId);
                      }}
                      className="px-4 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded text-[10px] font-mono uppercase font-bold mx-auto transition-all"
                    >
                      Dispatch nearest UAV
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 20-Minute Future Prediction Panel */}
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-5 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-grid-pattern" />
            <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06] mb-3">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <div>
                <span className="text-sm font-bold text-white">20-minute Future Prediction</span>
                <p className="text-[10px] text-gray-500 font-mono uppercase mt-0.5">ST-GNN Congestion Forecasting Model</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Predicted metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
                  <span className="text-gray-400 block mb-0.5 uppercase text-[9px] font-bold">Predicted Congestion</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-white">{predictedMavoorDensity}%</span>
                    <span className="text-[9px] text-gray-500">density</span>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
                  <span className="text-gray-400 block mb-0.5 uppercase text-[9px] font-bold">Predicted Flow</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-green-400">{predictedFlow}%</span>
                    <span className="text-[9px] text-gray-500">efficiency</span>
                  </div>
                </div>
              </div>

              {/* Potential bottlenecks */}
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 text-xs font-mono">
                <span className="text-gray-400 block mb-1 uppercase text-[9px] font-bold">POTENTIAL BOTTLENECK RISKS</span>
                {predictedMavoorDensity > 65 ? (
                  <div className="text-orange-400 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>Mavoor Road Junction is predicted to reach high congestion status within 20 mins.</span>
                  </div>
                ) : (
                  <div className="text-green-400 flex items-center gap-1.5">
                    <span className="shrink-0">✓</span>
                    <span>No structural gridlock predicted on main road corridors.</span>
                  </div>
                )}
              </div>

              {/* Alert popups within prediction panel */}
              <AnimatePresence mode="wait">
                {alertData && (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-xs space-y-3 relative overflow-hidden"
                  >
                    <div className="absolute inset-y-0 left-0 w-1 bg-red-500" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <AlertTriangle className="w-4 h-4" />
                        <span>{alertData.type}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 bg-red-500/20 text-red-400 rounded uppercase font-bold">
                        {alertData.severity}
                      </span>
                    </div>

                    <div className="font-mono text-white">
                      Predicted Bottleneck Zone: <span className="text-orange-400">{alertData.location}</span>
                    </div>

                    <p className="text-gray-300 font-mono text-[10px] leading-relaxed">
                      <span className="text-white block font-bold mb-0.5 text-[9px] uppercase tracking-wider">AI Recommendation Directive:</span>
                      {alertData.measures}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI generated recommendations list */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 text-xs space-y-3">
                <span className="text-[9px] text-gray-500 font-mono tracking-widest uppercase block border-b border-white/[0.04] pb-1 font-bold">AI OPERATIONS ACTION DIRECTIVES</span>
                
                <div className="flex gap-2">
                  <Zap className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Signal Timing Optimization</span>
                    <span className="text-gray-400">Extend green phase of Mavoor approach by 15s to discharge queued transit segments.</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Car className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Pre-emptive Route Diversions</span>
                    <span className="text-gray-400">Divert southbound bypass segments at Arayidathupalam to Midtown links.</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Plane className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white block">Resource Deployment</span>
                    <span className="text-gray-400">Station traffic officers at bottleneck approaches; hold UAV coverage overhead.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
