import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Plane, AlertTriangle, Thermometer, Droplets, CloudRain, MapPin, TrendingUp, CheckCircle2, Sparkles, Activity } from 'lucide-react';
import type { TrafficNode, Drone, PredictionWindow, RoadLinkMetadata } from '../../types';
import { 
  AI_RECOMMENDATIONS, 
  WEATHER, 
  getPrediction, 
  PREDICTION_WINDOW_LABELS, 
  congestionToStatus, 
  ROAD_LINKS_METADATA, 
  ROAD_HEALTH, 
  roadHealthColor 
} from '../../data/constants';
import { statusColor, statusLabel } from '../../utils';

interface IntelPanelProps {
  selectedNode: TrafficNode | null;
  selectedLink: string | null;
  drones: Drone[];
  predictionWindow: PredictionWindow;
  nodes: TrafficNode[];
  linkStatuses: Record<string, {
    status: 'free' | 'moderate' | 'heavy' | 'critical';
    density: number;
    speed: number;
    volume: number;
    travelTime: number;
    queueLength?: number;
  }>;
}

export default function IntelPanel({ selectedNode, selectedLink, drones, predictionWindow, nodes, linkStatuses }: IntelPanelProps) {
  const recs = selectedNode ? (AI_RECOMMENDATIONS[selectedNode.id] || []) : [];
  const nearbyDrones = selectedNode
    ? drones.filter(d => d.location === selectedNode.name || d.targetNodeId === selectedNode.id)
    : drones;
  const prediction = selectedNode ? getPrediction(selectedNode, predictionWindow) : null;
  const isPredicting = predictionWindow !== 'current';

  // Find nodes and metadata for selectedLink
  const { linkNodes, linkMetadata, linkStats, linkRecommendations } = (() => {
    if (!selectedLink || selectedNode) {
      return { linkNodes: null, linkMetadata: null, linkStats: null, linkRecommendations: [] };
    }
    const [aId, bId] = selectedLink.split('-');
    const a = nodes.find(n => n.id === aId);
    const b = nodes.find(n => n.id === bId);
    if (!a || !b) {
      return { linkNodes: null, linkMetadata: null, linkStats: null, linkRecommendations: [] };
    }

    const metadata = ROAD_LINKS_METADATA[selectedLink] || ROAD_LINKS_METADATA[`${bId}-${aId}`] || {
      name: `${a.name} ↔ ${b.name}`,
      type: 'City Connector',
      lengthKm: 0.6,
      healthId: 'unknown',
      baseSpeed: 45,
    };

    const predA = getPrediction(a, predictionWindow);
    const predB = getPrediction(b, predictionWindow);

    const statusA = predictionWindow === 'current' ? a.status : congestionToStatus(predA.congestion);
    const statusB = predictionWindow === 'current' ? b.status : congestionToStatus(predB.congestion);
    
    const CONGESTION_ORDER = ['free', 'moderate', 'heavy', 'critical'] as const;
    const worseStatus = CONGESTION_ORDER.indexOf(statusA) > CONGESTION_ORDER.indexOf(statusB) ? statusA : statusB;

    const avgDensity = Math.round((predA.density + predB.density) / 2);
    const totalVehicles = predA.vehicleCount + predB.vehicleCount;
    const avgSpeed = Math.round((predA.avgSpeed + predB.avgSpeed) / 2);

    // Travel time calculation: length / speed + signal delay
    const speedKmh = Math.max(5, avgSpeed);
    const baseMins = (metadata.lengthKm / speedKmh) * 60;
    const delayMins = worseStatus === 'critical' ? 3.5 : worseStatus === 'heavy' ? 2.0 : worseStatus === 'moderate' ? 0.5 : 0;
    const travelMins = parseFloat((baseMins + delayMins).toFixed(1));

    const linkStatsVal = linkStatuses[selectedLink] || linkStatuses[`${bId}-${aId}`];
    const stats = linkStatsVal ? {
      avgDensity: linkStatsVal.density,
      totalVehicles: linkStatsVal.volume,
      avgSpeed: linkStatsVal.speed,
      worseStatus: linkStatsVal.status,
      travelMins: linkStatsVal.travelTime,
      queueLength: linkStatsVal.queueLength,
    } : {
      avgDensity,
      totalVehicles,
      avgSpeed,
      worseStatus,
      travelMins,
    };

    // AI Recommendations for the corridor
    const linkRecs = [];
    if (worseStatus === 'critical' || worseStatus === 'heavy') {
      linkRecs.push(`Reroute traffic at ${a.name} via secondary loops`);
      linkRecs.push(`Adjust green signal offset on ${metadata.name}`);
      linkRecs.push('Advise real-time speed reduction alert to GPS apps');
    } else if (worseStatus === 'moderate') {
      linkRecs.push(`Monitor merge lane activity at endpoint signals`);
      linkRecs.push(`Optimal speed threshold maintained at ${avgSpeed} km/h`);
    } else {
      linkRecs.push(`Corridor operating under nominal flow. Green wave active.`);
    }

    // Associated health check
    const healthItem = ROAD_HEALTH.find(h => h.id === metadata.healthId);
    if (healthItem && (healthItem.status === 'critical' || healthItem.status === 'poor')) {
      linkRecs.push(`CAUTION: ${healthItem.issues[0] || 'Road degradation detected'}`);
      linkRecs.push('Prioritize dispatch of maintenance crew');
    } else {
      linkRecs.push(`Signal timings optimized for ${metadata.baseSpeed} km/h design speed`);
    }

    return {
      linkNodes: { a, b },
      linkMetadata: metadata,
      linkStats: stats,
      linkRecommendations: linkRecs,
    };
  })();

  return (
    <div className="h-full flex flex-col border-l border-white/[0.06] overflow-hidden bg-[#0F1117]"
      style={{ width: 330 }}>
      
      {/* Panel header */}
      <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0">
        <span className="text-xs font-mono text-gray-400 tracking-wider uppercase font-bold">Intelligence</span>
        <div className="flex items-center gap-1">
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          <span className="text-[10px] font-mono text-orange-400 font-bold">LIVE</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Selected node info */}
        <AnimatePresence mode="wait">
          <motion.div key={selectedNode?.id || selectedLink || 'default'}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            
            {selectedNode ? (
              <div className="space-y-3">
                {/* Location header */}
                <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-sm font-bold text-white">{selectedNode.name}</span>
                  </div>
                  {['stadium', 'midtown', 'bus_stand', 'mavoor'].includes(selectedNode.id) && (
                    <div className="flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 px-2 py-0.5 rounded text-[10px] font-mono w-max mb-2 font-bold">
                      🚦 Signalized Intersection
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor(isPredicting ? congestionToStatus(prediction!.congestion) : selectedNode.status) }} />
                      <span className="text-xs font-mono font-bold" style={{ color: statusColor(isPredicting ? congestionToStatus(prediction!.congestion) : selectedNode.status) }}>
                        {statusLabel(isPredicting ? congestionToStatus(prediction!.congestion) : selectedNode.status).toUpperCase()}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded font-bold ${
                      isPredicting ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'
                    }`}>
                      {isPredicting ? <Sparkles className="w-2.5 h-2.5" /> : <Activity className="w-2.5 h-2.5" />}
                      {PREDICTION_WINDOW_LABELS[predictionWindow].toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {isPredicting && prediction ? (
                    <>
                      {[
                        { label: 'Predicted Density', value: `${prediction.density}%`, color: prediction.density > 80 ? '#EF4444' : prediction.density > 60 ? '#F97316' : '#22C55E' },
                        { label: 'Predicted Vehicles', value: prediction.vehicleCount.toLocaleString(), color: '#F97316' },
                        { label: 'Predicted Speed', value: `${prediction.avgSpeed} km/h`, color: '#3B82F6' },
                        { label: 'Confidence', value: `${prediction.confidence}%`, color: '#A855F7' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
                          <div className="text-[10px] text-gray-400 font-sans font-bold mb-1">{label}</div>
                          <div className="text-base font-extrabold font-mono" style={{ color }}>{value}</div>
                        </div>
                      ))}
                      <div className="col-span-2 bg-white/[0.03] rounded-lg p-2 border border-white/[0.05] flex items-center justify-between">
                        <div className="text-[10px] text-gray-400 font-sans font-bold">Predicted Congestion</div>
                        <div className="text-xs font-bold font-mono capitalize" style={{ color: statusColor(congestionToStatus(prediction.congestion)) }}>
                          {prediction.congestion}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {[
                        { label: 'Current Density', value: `${selectedNode.density}%`, color: selectedNode.density > 80 ? '#EF4444' : selectedNode.density > 60 ? '#F97316' : '#22C55E' },
                        { label: 'Current Vehicles', value: selectedNode.vehicleCount.toLocaleString(), color: '#F97316' },
                        { label: 'Current Speed', value: `${selectedNode.avgSpeed} km/h`, color: '#3B82F6' },
                        { label: 'Incidents', value: selectedNode.incidentCount.toString(), color: selectedNode.incidentCount > 0 ? '#EF4444' : '#22C55E' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
                          <div className="text-[10px] text-gray-400 font-sans font-bold mb-1">{label}</div>
                          <div className="text-base font-extrabold font-mono" style={{ color }}>{value}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* AI Block */}
                <div className="rounded-lg border border-orange-500/20 overflow-hidden">
                  <div className="bg-orange-500/10 px-3 py-1.5 flex items-center gap-2">
                    <Brain className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono text-orange-400 tracking-wider font-bold">AI RECOMMENDATIONS</span>
                    <span className="ml-auto text-[10px] text-orange-300 font-mono font-bold">96% conf.</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {recs.map((rec, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-200 leading-relaxed font-sans">{rec}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Nearby drones */}
                {nearbyDrones.length > 0 && (
                  <div className="rounded-lg border border-blue-500/20 overflow-hidden">
                    <div className="bg-blue-500/10 px-3 py-1.5 flex items-center gap-2">
                      <Plane className="w-3 h-3 text-blue-400" />
                      <span className="text-xs font-mono text-blue-400 tracking-wider font-bold">DRONE COVERAGE</span>
                    </div>
                    <div className="p-2 space-y-2">
                      {nearbyDrones.map(drone => (
                        <div key={drone.id} className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-mono text-white font-bold">{drone.name}</div>
                            <div className="text-[10px] text-gray-400">{drone.altitude}m · {drone.battery}% batt.</div>
                          </div>
                          <span className="text-[10px] font-mono text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded font-bold">
                            ACTIVE
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Incidents */}
                {selectedNode.incidentCount > 0 && (
                  <div className="rounded-lg border border-red-500/20 overflow-hidden">
                    <div className="bg-red-500/10 px-3 py-1.5 flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-red-400" />
                      <span className="text-xs font-mono text-red-400 font-bold">{selectedNode.incidentCount} INCIDENT(S)</span>
                    </div>
                    <div className="p-2">
                      <span className="text-xs text-gray-400">Active incidents at this node. Review Incident Center.</span>
                    </div>
                  </div>
                )}
              </div>
            ) : selectedLink && linkNodes && linkMetadata && linkStats ? (
              <div className="space-y-3">
                {/* Location / Route Header */}
                <div className="bg-white/[0.04] rounded-lg p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="text-sm font-bold text-white">{linkMetadata.name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-sans mb-2 font-semibold">
                    {linkNodes.a.name} ↔ {linkNodes.b.name} ({linkMetadata.type})
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColor(linkStats.worseStatus) }} />
                      <span className="text-xs font-mono font-bold" style={{ color: statusColor(linkStats.worseStatus) }}>
                        {statusLabel(linkStats.worseStatus).toUpperCase()}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded font-bold ${
                      isPredicting ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'
                    }`}>
                      {isPredicting ? <Sparkles className="w-2.5 h-2.5" /> : <Activity className="w-2.5 h-2.5" />}
                      {PREDICTION_WINDOW_LABELS[predictionWindow].toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Avg Density', value: `${linkStats.avgDensity}%`, color: linkStats.avgDensity > 80 ? '#EF4444' : linkStats.avgDensity > 60 ? '#F97316' : '#22C55E' },
                    { label: 'Est. Travel Time', value: `${linkStats.travelMins} min`, color: linkStats.worseStatus === 'critical' ? '#EF4444' : linkStats.worseStatus === 'heavy' ? '#F97316' : '#22C55E' },
                    { label: 'Avg Speed', value: `${linkStats.avgSpeed} km/h`, color: '#3B82F6' },
                    { label: 'Combined Volume', value: linkStats.totalVehicles.toLocaleString(), color: '#A855F7' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
                      <div className="text-[10px] text-gray-400 font-sans mb-1 font-bold">{label}</div>
                      <div className="text-base font-extrabold font-mono" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Road Health Section */}
                {(() => {
                  const healthItem = ROAD_HEALTH.find(h => h.id === linkMetadata.healthId);
                  if (!healthItem) return null;
                  return (
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-400 tracking-wider font-bold">ROAD HEALTH INDEX</span>
                        <span className="text-xs font-mono font-bold" style={{ color: roadHealthColor(healthItem.status) }}>
                          {healthItem.score}/100 ({healthItem.status.toUpperCase()})
                        </span>
                      </div>
                      {healthItem.issues.length > 0 ? (
                        <div className="space-y-1">
                          {healthItem.issues.map((issue, idx) => (
                            <div key={idx} className="text-xs text-red-300 flex items-start gap-1 font-sans">
                              <span className="text-red-400 shrink-0 mt-0.5">⚠️</span>
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-green-400 flex items-center gap-1 font-sans">
                          <CheckCircle2 className="w-2.5 h-2.5 text-green-400 shrink-0" />
                          <span>No structural defects reported</span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* AI Recommendations */}
                <div className="rounded-lg border border-orange-500/20 overflow-hidden">
                  <div className="bg-orange-500/10 px-3 py-1.5 flex items-center gap-2">
                    <Brain className="w-3 h-3 text-orange-400" />
                    <span className="text-xs font-mono text-orange-400 tracking-wider font-bold">CORRIDOR DIRECTIVES</span>
                    <span className="ml-auto text-[10px] text-orange-300 font-mono font-bold">94% conf.</span>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {linkRecommendations.map((rec, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex items-start gap-2">
                        <Zap className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                        <span className="text-xs text-gray-200 leading-relaxed font-sans">{rec}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.05] text-center">
                  <MapPin className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 font-sans">Select a traffic node or corridor on the map to view intelligence</p>
                </div>

                {/* System overview when no node selected */}
                <div className="space-y-2">
                  <div className="text-xs font-mono text-gray-400 tracking-wider uppercase px-1 font-bold">System Overview</div>
                  {[
                    { label: 'Total Vehicles', value: '4,869', icon: TrendingUp, color: 'text-orange-400' },
                    { label: 'Active Drones', value: '2', icon: Plane, color: 'text-blue-400' },
                    { label: 'AI Confidence', value: '96.2%', icon: Brain, color: 'text-purple-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2.5 border border-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                        <span className="text-xs text-gray-300">{label}</span>
                      </div>
                      <span className={`text-sm font-mono font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Weather */}
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          <div className="px-3 py-1.5 border-b border-white/[0.05] flex items-center gap-2">
            <Thermometer className="w-3 h-3 text-cyan-400" />
            <span className="text-xs font-mono text-gray-400 tracking-wider font-bold">WEATHER — KOZHIKODE</span>
          </div>
          <div className="p-2 grid grid-cols-2 gap-2">
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-xs text-gray-400 font-sans font-bold">Temperature</div>
              <div className="text-base font-extrabold text-cyan-400 font-mono">{WEATHER.temperature}°C</div>
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="text-xs text-gray-400 font-sans font-bold">Humidity</div>
              <div className="text-base font-extrabold text-blue-400 font-mono">{WEATHER.humidity}%</div>
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="flex items-center gap-1 text-xs text-gray-400 font-sans font-bold mb-0.5">
                <CloudRain className="w-2.5 h-2.5" /> Rain
              </div>
              <div className="text-base font-extrabold text-blue-300 font-mono">{WEATHER.rainProbability}%</div>
            </div>
            <div className="bg-white/[0.03] rounded p-2">
              <div className="flex items-center gap-1 text-xs text-gray-400 font-sans font-bold mb-0.5">
                <Droplets className="w-2.5 h-2.5" /> Impact
              </div>
              <div className="text-sm font-extrabold text-yellow-400 font-mono capitalize">{WEATHER.trafficImpact}</div>
            </div>
          </div>
        </div>

        {/* System health */}
        <div className="space-y-1">
          <div className="text-xs font-mono text-gray-400 tracking-wider uppercase px-1 font-bold">System Health</div>
          {['AI Model', 'Drone Network', 'Map Services', 'Token Engine'].map(sys => (
            <div key={sys} className="flex items-center justify-between bg-white/[0.03] rounded px-2.5 py-1.5 border border-white/[0.04]">
              <span className="text-xs text-gray-300">{sys}</span>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                <span className="text-xs font-mono text-green-400 font-bold">ONLINE</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
