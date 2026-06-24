import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Zap, Plane, AlertTriangle, Thermometer, Droplets, CloudRain, MapPin, TrendingUp, CheckCircle2, Sparkles, Activity, ArrowLeft, ChevronDown, ChevronUp, Siren, Clock } from 'lucide-react';
import type { TrafficNode, Drone, PredictionWindow, RoadLinkMetadata, Incident, GCSLinkData, GCSPredictionData } from '../../types';
import { 
  AI_RECOMMENDATIONS, 
  WEATHER, 
  getPrediction, 
  PREDICTION_WINDOW_LABELS, 
  congestionToStatus, 
  ROAD_LINKS_METADATA, 
  ROAD_HEALTH, 
  roadHealthColor,
  TRAFFIC_NODES
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
  incidents?: Incident[];
  onClearSelection?: () => void;
  selectedTime?: string;
  coordsLinkData?: GCSLinkData[];
  gcsPredictions?: GCSPredictionData[];
  onSelectLink?: (linkId: string | null) => void;

  // What-If Simulation Sandbox states
  isWhatIfActive?: boolean;
  setIsWhatIfActive?: (val: boolean) => void;
  whatIfLanesBlocked?: number;
  setWhatIfLanesBlocked?: (val: number) => void;
  whatIfEventIntensity?: number;
  setWhatIfEventIntensity?: (val: number) => void;
  whatIfRetimingSeconds?: number;
  setWhatIfRetimingSeconds?: (val: number) => void;
  isRetimingApplied?: boolean;
  setIsRetimingApplied?: (val: boolean) => void;

  // Playback/Timeline control states
  uniqueTimestamps?: string[];
  onTimeChange?: (time: string) => void;
  playbackIndex?: number;
  setPlaybackIndex?: (idx: number) => void;
  isPlaybackPlaying?: boolean;
  setIsPlaybackPlaying?: (val: boolean) => void;
  playbackSpeed?: number;
  setPlaybackSpeed?: (val: number) => void;
  selectedDate?: string;
  setSelectedDate?: (date: string) => void;
}

export default function IntelPanel({ 
  selectedNode, 
  selectedLink, 
  drones, 
  predictionWindow, 
  nodes, 
  linkStatuses,
  incidents = [], 
  onClearSelection,
  selectedTime = '00:00:00',
  coordsLinkData = [],
  gcsPredictions = [],
  onSelectLink,

  // Simulation Sandbox states
  isWhatIfActive = false,
  setIsWhatIfActive = () => {},
  whatIfLanesBlocked = 0,
  setWhatIfLanesBlocked = () => {},
  whatIfEventIntensity = 0,
  setWhatIfEventIntensity = () => {},
  whatIfRetimingSeconds = 18,
  setWhatIfRetimingSeconds = () => {},
  isRetimingApplied = false,
  setIsRetimingApplied = () => {},

  // Playback states
  uniqueTimestamps = [],
  onTimeChange = () => {},
  playbackIndex = 0,
  setPlaybackIndex = () => {},
  isPlaybackPlaying = true,
  setIsPlaybackPlaying = () => {},
  playbackSpeed = 1,
  setPlaybackSpeed = () => {},
  selectedDate = '',
  setSelectedDate = () => {},
}: IntelPanelProps) {
  const [activeTab, setActiveTab] = useState<'live' | 'forecast20'>('live');
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const recs = selectedNode ? (AI_RECOMMENDATIONS[selectedNode.id] || []) : [];
  const nearbyDrones = selectedNode
    ? drones.filter(d => d.location === selectedNode.name || d.targetNodeId === selectedNode.id)
    : drones;
  const prediction = selectedNode ? getPrediction(selectedNode, predictionWindow) : null;
  const isPredicting = predictionWindow !== 'current';

  const handleTimeSelectorChange = (newTime: string) => {
    if (uniqueTimestamps.length === 0) return;
    let closestIdx = 0;
    let minDiff = Infinity;
    
    const parseToSec = (t: string) => {
      const [h, m, s] = t.split(':').map(Number);
      return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
    };
    
    const targetSec = parseToSec(newTime);
    for (let i = 0; i < uniqueTimestamps.length; i++) {
      const diff = Math.abs(parseToSec(uniqueTimestamps[i]) - targetSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    setPlaybackIndex(closestIdx);
    onTimeChange(uniqueTimestamps[closestIdx]);
  };

  const connectionToLinks: Record<string, [string, string]> = {
    'mavoor-bus_stand': ['L23', 'L11'],
    'bus_stand-arayidathupalam': ['L19', 'L13'],
    'arayidathupalam-midtown': ['L1', 'L18'],
    'midtown-east_bypass': ['L2', 'L24'],
    'east_bypass-poonthanam': ['L20', 'L7'],
    'poonthanam-palayam': ['L21', 'L9'],
    'palayam-mananchira': ['L22', 'L8'],
    'mavoor-mananchira': ['L26', 'L14'],
    'bus_stand-stadium': ['L6', 'L17'],
    'stadium-midtown': ['L3', 'L16'],
    'stadium-poonthanam': ['L4', 'L10'],
    'stadium-mananchira': ['L5', 'L15'],
  };

  const directionData = (() => {
    if (!selectedLink || selectedNode) return [];
    const mappedIds = connectionToLinks[selectedLink] || [];
    const [aId, bId] = selectedLink.split('-');
    const aNode = nodes.find(n => n.id === aId);
    const bNode = nodes.find(n => n.id === bId);
    if (!aNode || !bNode) return [];
    
    const [lOut, lIn] = mappedIds;
    
    const outRow = coordsLinkData.find(row => row.timestamp === selectedTime && row.linkId === lOut);
    const inRow = coordsLinkData.find(row => row.timestamp === selectedTime && row.linkId === lIn);
    
    const res = [];
    if (outRow) {
      res.push({
        direction: `${aNode.name} → ${bNode.name}`,
        linkId: lOut,
        row: outRow
      });
    }
    if (inRow) {
      res.push({
        direction: `${bNode.name} → ${aNode.name}`,
        linkId: lIn,
        row: inRow
      });
    }
    return res;
  })();

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
      style={{ width: 380 }}>
      
      {/* Panel header */}
      <div className="border-b border-white/[0.06] shrink-0">
        <div className="h-14 flex items-center justify-between px-3">
          {(selectedNode || selectedLink) && onClearSelection ? (
            <button
              onClick={onClearSelection}
              className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-orange-400 transition-colors"
              aria-label="Back to overview"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to overview
            </button>
          ) : (
            <span className="text-xs font-mono text-gray-400 tracking-wider uppercase font-bold">Intelligence</span>
          )}
          <div className="flex items-center gap-1">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <span className="text-[10px] font-mono text-orange-400 font-bold">LIVE</span>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-2 pb-2 flex gap-1">
          <button onClick={() => setActiveTab('live')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all ${
              activeTab === 'live' ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-white border border-transparent'
            }`}>
            <Activity className="w-3 h-3" /> Live
          </button>
          <button onClick={() => setActiveTab('forecast20')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-[9px] font-mono uppercase tracking-wider transition-all ${
              activeTab === 'forecast20' ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30' : 'text-gray-500 hover:text-white border border-transparent'
            }`}>
            <Sparkles className="w-3 h-3" /> 20-Min Forecast
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'forecast20' ? (
          <Forecast20Panel 
            selectedNode={selectedNode}
            selectedLink={selectedLink}
            gcsPredictions={gcsPredictions}
            linkStatuses={linkStatuses}
            onSelectLink={onSelectLink}
            nodes={nodes}
            selectedTime={selectedTime}
            isWhatIfActive={isWhatIfActive}
            setIsWhatIfActive={setIsWhatIfActive}
            whatIfLanesBlocked={whatIfLanesBlocked}
            setWhatIfLanesBlocked={setWhatIfLanesBlocked}
            whatIfEventIntensity={whatIfEventIntensity}
            setWhatIfEventIntensity={setWhatIfEventIntensity}
            whatIfRetimingSeconds={whatIfRetimingSeconds}
            setWhatIfRetimingSeconds={setWhatIfRetimingSeconds}
            isRetimingApplied={isRetimingApplied}
            setIsRetimingApplied={setIsRetimingApplied}
          />
        ) : (
        /* Selected node info */
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

                {/* Embedded Temporal Control Center */}
                {uniqueTimestamps.length > 0 && (
                  <div className="bg-[#0F1117]/90 border border-white/[0.08] rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400 tracking-wider uppercase font-bold">Timeline Seeker</span>
                      <div className="text-xs font-mono font-extrabold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2 py-0.5 rounded flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 animate-pulse" />
                        {selectedTime}
                      </div>
                    </div>

                    {/* Time & Date Inputs Row */}
                    <div className="flex items-center justify-between gap-1.5 bg-white/[0.02] border border-white/[0.04] p-1.5 rounded-lg">
                      {/* Date Picker */}
                      <div className="flex flex-col gap-0.5">
                        <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold">Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="bg-white/[0.04] border border-white/[0.08] rounded px-1.5 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 w-24 shrink-0 font-bold"
                        />
                      </div>

                      {/* Time Selectors */}
                      <div className="flex flex-col gap-0.5 flex-1 items-end">
                        <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold pr-1">Target Time (HH:MM:SS)</label>
                        <div className="flex items-center gap-1">
                          {/* Hour select */}
                          <select
                            value={selectedTime.split(':')[0] || '00'}
                            onChange={(e) => {
                              const [_, m, s] = selectedTime.split(':');
                              handleTimeSelectorChange(`${e.target.value}:${m || '00'}:${s || '00'}`);
                            }}
                            className="bg-white/[0.04] border border-white/[0.08] rounded px-1 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 w-[38px] text-center font-bold"
                          >
                            {Array.from({ length: 24 }, (_, i) => {
                              const val = String(i).padStart(2, '0');
                              return <option key={val} value={val} className="bg-[#0F1117] text-white">{val}</option>;
                            })}
                          </select>

                          <span className="text-[9px] text-gray-500 font-mono">:</span>

                          {/* Minute select */}
                          <select
                            value={selectedTime.split(':')[1] || '00'}
                            onChange={(e) => {
                              const [h, _, s] = selectedTime.split(':');
                              handleTimeSelectorChange(`${h || '00'}:${e.target.value}:${s || '00'}`);
                            }}
                            className="bg-white/[0.04] border border-white/[0.08] rounded px-1 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 w-[38px] text-center font-bold"
                          >
                            {Array.from({ length: 60 }, (_, i) => {
                              const val = String(i).padStart(2, '0');
                              return <option key={val} value={val} className="bg-[#0F1117] text-white">{val}</option>;
                            })}
                          </select>

                          <span className="text-[9px] text-gray-500 font-mono">:</span>

                          {/* Second select */}
                          <select
                            value={selectedTime.split(':')[2] || '00'}
                            onChange={(e) => {
                              const [h, m, _] = selectedTime.split(':');
                              handleTimeSelectorChange(`${h || '00'}:${m || '00'}:${e.target.value}`);
                            }}
                            className="bg-white/[0.04] border border-white/[0.08] rounded px-1 py-0.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 w-[38px] text-center font-bold"
                          >
                            {Array.from({ length: 12 }, (_, i) => {
                              const val = String(i * 5).padStart(2, '0');
                              return <option key={val} value={val} className="bg-[#0F1117] text-white">{val}</option>;
                            })}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Playback Controls Row */}
                    <div className="flex items-center justify-between gap-3">
                      {/* Step back */}
                      <button
                        onClick={() => {
                          const nextIdx = (playbackIndex - 1 + uniqueTimestamps.length) % uniqueTimestamps.length;
                          setPlaybackIndex(nextIdx);
                        }}
                        title="Step Back"
                        className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[10px] text-gray-300 hover:text-white"
                      >
                        ◀
                      </button>

                      {/* Play/Pause */}
                      <button
                        onClick={() => setIsPlaybackPlaying(!isPlaybackPlaying)}
                        title={isPlaybackPlaying ? "Pause Playback" : "Start Playback"}
                        className={`flex-1 h-8 rounded-lg border flex items-center justify-center font-bold text-[10px] gap-1 ${
                          isPlaybackPlaying 
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20' 
                            : 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20'
                        }`}
                      >
                        {isPlaybackPlaying ? 'PAUSE' : 'PLAY'}
                      </button>

                      {/* Step forward */}
                      <button
                        onClick={() => {
                          const nextIdx = (playbackIndex + 1) % uniqueTimestamps.length;
                          setPlaybackIndex(nextIdx);
                        }}
                        title="Step Forward"
                        className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-[10px] text-gray-300 hover:text-white"
                      >
                        ▶
                      </button>
                    </div>

                    {/* Range Scrubber */}
                    <div className="space-y-1">
                      <input
                        type="range"
                        min="0"
                        max={uniqueTimestamps.length - 1}
                        value={playbackIndex}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value, 10);
                          setPlaybackIndex(idx);
                          if (uniqueTimestamps[idx]) {
                            onTimeChange(uniqueTimestamps[idx]);
                          }
                        }}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                      />
                      <div className="flex justify-between text-[8px] font-mono text-gray-500">
                        <span>START (00:00)</span>
                        <span>Index: {playbackIndex + 1} / {uniqueTimestamps.length}</span>
                        <span>END (24:00)</span>
                      </div>
                    </div>

                    {/* Playback speed selector */}
                    <div className="flex items-center justify-between border-t border-white/[0.04] pt-2">
                      <span className="text-[9px] font-mono text-gray-500 uppercase">Playback Speed</span>
                      <div className="flex gap-1">
                        {[1, 5, 15, 30].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => setPlaybackSpeed(speed)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all ${
                              playbackSpeed === speed
                                ? 'bg-orange-500 text-[#0F1117]'
                                : 'bg-white/[0.03] text-gray-400 hover:text-white border border-white/[0.04]'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stats grid / Telemetry details at selectedTime */}
                {directionData.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-mono text-gray-400 tracking-wider uppercase px-1 font-bold">
                      Corridor Telemetry Data
                    </div>
                    {directionData.map(({ direction, linkId, row }) => (
                      <div key={linkId} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                          <span className="text-[11px] font-extrabold text-orange-400 font-sans truncate pr-2" title={direction}>
                            {direction}
                          </span>
                          <span className="text-[9px] font-mono text-gray-500 bg-white/[0.04] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                            ID: {linkId}
                          </span>
                        </div>

                        {/* 3x3 Traffic Metrics Grid */}
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {[
                            { label: 'Speed', value: `${row.speed} km/h`, color: 'text-blue-400' },
                            { label: 'Travel Time', value: `${row.travelTime} s`, color: 'text-green-400' },
                            { label: 'Volume', value: row.volume.toLocaleString(), color: 'text-purple-400' },
                            { label: 'Occupancy', value: `${row.occupancy}%`, color: 'text-red-400' },
                            { label: 'Queue Length', value: row.queueLength, color: 'text-orange-400' },
                            { label: 'Queue Delay', value: `${row.queueDelay} s`, color: 'text-yellow-400' },
                            { label: 'Vehicle Delay', value: `${row.vehDelay} s`, color: 'text-pink-400' },
                            { label: 'Stops Count', value: row.stops, color: 'text-cyan-400' },
                            { label: 'Max Queue', value: row.maxQueueLength, color: 'text-indigo-400' },
                          ].map((item) => (
                            <div key={item.label} className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.04] flex flex-col justify-between h-[45px]">
                              <div className="text-[7.5px] text-gray-500 font-sans font-bold leading-tight uppercase truncate">{item.label}</div>
                              <div className={`text-xs font-extrabold font-mono mt-0.5 ${item.color}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {/* Geospatial Coordinate Alignment Section */}
                        <div className="bg-white/[0.02] rounded-lg p-2 border border-white/[0.04] space-y-1.5">
                          <div className="flex items-center gap-1.5 text-[8.5px] font-mono text-gray-400 uppercase tracking-wider font-bold">
                            <MapPin className="w-3 h-3 text-orange-400" /> Geographic Path Alignment
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-sans">
                            <div className="border-r border-white/[0.04] pr-1.5">
                              <span className="text-gray-500 font-bold text-[7.5px] font-mono block">START POINT</span>
                              <div className="text-gray-300 truncate text-[9.5px] font-mono" title={row.startLat}>{row.startLat}</div>
                              <div className="text-gray-300 truncate text-[9.5px] font-mono mt-0.5" title={row.startLon}>{row.startLon}</div>
                            </div>
                            <div className="pl-0.5">
                              <span className="text-gray-500 font-bold text-[7.5px] font-mono block">END POINT</span>
                              <div className="text-gray-300 truncate text-[9.5px] font-mono" title={row.endLat}>{row.endLat}</div>
                              <div className="text-gray-300 truncate text-[9.5px] font-mono mt-0.5" title={row.endLon}>{row.endLon}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
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
                )}

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
        )}

        {/* Live Incidents */}
        {activeTab === 'live' && incidents.length > 0 && (
          <div className="rounded-lg border border-red-500/20 overflow-hidden">
            <div className="bg-red-500/10 px-3 py-1.5 flex items-center gap-2">
              <Siren className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 tracking-wider">LIVE INCIDENTS</span>
              <span className="ml-auto text-[9px] font-mono text-red-300">{incidents.length}</span>
            </div>
            <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
              {[...incidents]
                .sort((a, b) => {
                  const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
                  return order[a.priority] - order[b.priority];
                })
                .slice(0, 8)
                .map((inc) => {
                  const isOpen = expandedIncident === inc.id;
                  const priColor =
                    inc.priority === 'critical' ? '#EF4444'
                    : inc.priority === 'high' ? '#F97316'
                    : inc.priority === 'medium' ? '#EAB308' : '#22C55E';
                  const measures = suggestedMeasures(inc);
                  return (
                    <div key={inc.id} className="bg-white/[0.03] rounded border border-white/[0.05] overflow-hidden">
                      <button
                        onClick={() => setExpandedIncident(isOpen ? null : inc.id)}
                        className="w-full px-2 py-1.5 flex items-center gap-2 hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priColor }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-semibold text-white truncate">{inc.type}</div>
                          <div className="text-[9px] text-gray-500 font-mono truncate">{inc.location}</div>
                        </div>
                        <span className="text-[8px] font-mono uppercase shrink-0" style={{ color: priColor }}>
                          {inc.priority}
                        </span>
                        {isOpen ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                      </button>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="px-2 pb-2 border-t border-white/[0.05] space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 pt-1.5 text-[9px] font-mono text-gray-500">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(inc.timestamp).toLocaleTimeString()}
                            <span className="ml-auto text-orange-400">{inc.tokenId}</span>
                          </div>
                          {inc.description && (
                            <div className="text-[9px] text-gray-300 leading-relaxed">{inc.description}</div>
                          )}
                          <div className="rounded border border-orange-500/20 overflow-hidden">
                            <div className="bg-orange-500/10 px-2 py-1 flex items-center gap-1.5">
                              <Brain className="w-2.5 h-2.5 text-orange-400" />
                              <span className="text-[9px] font-mono text-orange-400 tracking-wider">SUGGESTED MEASURES</span>
                            </div>
                            <div className="p-1.5 space-y-1">
                              {measures.map((m: string, i: number) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <Zap className="w-2.5 h-2.5 text-orange-400 shrink-0 mt-0.5" />
                                  <span className="text-[9px] text-gray-300 leading-snug">{m}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[8px] font-mono">
                            <span className="text-gray-500">STATUS:</span>
                            <span className="uppercase" style={{ color: inc.status === 'active' ? '#22C55E' : inc.status === 'pending' ? '#EAB308' : '#9CA3AF' }}>
                              {inc.status}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Weather */}
        {activeTab === 'live' && (
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
        )}

        {/* System health */}
        {activeTab === 'live' && (
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
        )}
      </div>
    </div>
  );
}

function suggestedMeasures(inc: Incident): string[] {
  const t = inc.type.toLowerCase();
  const measures: string[] = [];
  if (t.includes('accident') || t.includes('crash')) {
    measures.push('Dispatch nearest patrol unit and ambulance to scene');
    measures.push('Divert through-traffic via alternate corridor');
    measures.push('Deploy nearest drone for live overhead feed');
  } else if (t.includes('fire')) {
    measures.push('Alert fire services and clear access lanes');
    measures.push('Evacuate 200m radius; halt cross-traffic');
    measures.push('Activate emergency green corridor to nearest hospital');
  } else if (t.includes('block') || t.includes('road block') || t.includes('obstruction')) {
    measures.push('Send maintenance crew to clear obstruction');
    measures.push('Reroute via parallel link; update GPS advisories');
  } else if (t.includes('breakdown') || t.includes('vehicle')) {
    measures.push('Dispatch tow vehicle; lane closure advisory');
    measures.push('Adjust signal timing on upstream junction');
  } else if (t.includes('crowd') || t.includes('gathering') || t.includes('protest')) {
    measures.push('Deploy crowd-control officers to the location');
    measures.push('Pre-emptive diversion at upstream junctions');
    measures.push('Issue public advisory via SMS broadcast');
  } else if (t.includes('parking') || t.includes('illegal')) {
    measures.push('Dispatch traffic warden for clearance / towing');
    measures.push('Issue penalty token via enforcement unit');
  } else if (t.includes('flood') || t.includes('water')) {
    measures.push('Close affected stretch; barricade and signage');
    measures.push('Activate alternate route plan; notify drainage team');
  } else {
    measures.push('Acknowledge and assign nearest field officer');
    measures.push('Monitor via drone feed; review every 5 min');
  }
  if (inc.priority === 'critical') {
    measures.unshift('CRITICAL: Trigger Twilio + SendGrid emergency broadcast');
  } else if (inc.priority === 'high') {
    measures.unshift('HIGH: Notify supervisor on duty immediately');
  }
  return measures.slice(0, 4);
}

interface Forecast20PanelProps {
  selectedNode: TrafficNode | null;
  selectedLink: string | null;
  gcsPredictions: GCSPredictionData[];
  linkStatuses: Record<string, any>;
  onSelectLink?: (linkId: string | null) => void;
  nodes: TrafficNode[];
  selectedTime: string;
  isWhatIfActive: boolean;
  setIsWhatIfActive: (val: boolean) => void;
  whatIfLanesBlocked: number;
  setWhatIfLanesBlocked: (val: number) => void;
  whatIfEventIntensity: number;
  setWhatIfEventIntensity: (val: number) => void;
  whatIfRetimingSeconds: number;
  setWhatIfRetimingSeconds: (val: number) => void;
  isRetimingApplied: boolean;
  setIsRetimingApplied: (val: boolean) => void;
}

function Forecast20Panel({ 
  selectedNode, 
  selectedLink, 
  gcsPredictions, 
  linkStatuses,
  onSelectLink,
  nodes,
  selectedTime,
  isWhatIfActive,
  setIsWhatIfActive,
  whatIfLanesBlocked,
  setWhatIfLanesBlocked,
  whatIfEventIntensity,
  setWhatIfEventIntensity,
  whatIfRetimingSeconds,
  setWhatIfRetimingSeconds,
  isRetimingApplied,
  setIsRetimingApplied
}: Forecast20PanelProps) {
  const isLinkActive = selectedLink !== null;
  const isNodeActive = selectedNode !== null;

  const connectionToLinks: Record<string, [string, string]> = {
    'mavoor-bus_stand': ['L23', 'L11'],
    'bus_stand-arayidathupalam': ['L19', 'L13'],
    'arayidathupalam-midtown': ['L1', 'L18'],
    'midtown-east_bypass': ['L2', 'L24'],
    'east_bypass-poonthanam': ['L20', 'L7'],
    'poonthanam-palayam': ['L21', 'L9'],
    'palayam-mananchira': ['L22', 'L8'],
    'mavoor-mananchira': ['L26', 'L14'],
    'bus_stand-stadium': ['L6', 'L17'],
    'stadium-midtown': ['L3', 'L16'],
    'stadium-poonthanam': ['L4', 'L10'],
    'stadium-mananchira': ['L5', 'L15'],
  };

  const linkToConnectionMap: Record<string, string> = {
    L23: 'mavoor-bus_stand',
    L11: 'mavoor-bus_stand',
    L19: 'bus_stand-arayidathupalam',
    L13: 'bus_stand-arayidathupalam',
    L1: 'arayidathupalam-midtown',
    L18: 'arayidathupalam-midtown',
    L2: 'midtown-east_bypass',
    L24: 'midtown-east_bypass',
    L20: 'east_bypass-poonthanam',
    L7: 'east_bypass-poonthanam',
    L21: 'poonthanam-palayam',
    L9: 'poonthanam-palayam',
    L22: 'palayam-mananchira',
    L8: 'palayam-mananchira',
    L26: 'mavoor-mananchira',
    L14: 'mavoor-mananchira',
    L6: 'bus_stand-stadium',
    L17: 'bus_stand-stadium',
    L3: 'stadium-midtown',
    L16: 'stadium-midtown',
    L4: 'stadium-poonthanam',
    L10: 'stadium-poonthanam',
    L5: 'stadium-mananchira',
    L15: 'stadium-mananchira',
  };

  const linkDescriptions: Record<string, string> = {
    L1: 'Mini Bypass Road (Northbound)',
    L18: 'Mini Bypass Road (Southbound)',
    L3: 'Puthiyara Road (Stadium → Midtown)',
    L16: 'Puthiyara Road (Midtown → Stadium)',
    L6: 'Rajaji Road (Bus Stand → Stadium)',
    L17: 'Rajaji Road (Stadium → Bus Stand)',
    L13: 'Mavoor Road Middle (Arayidathupalam → Bus Stand)',
    L19: 'Mavoor Road Middle (Bus Stand → Arayidathupalam)',
  };

  const severityColor = (lvl: string) => {
    switch (lvl.toUpperCase()) {
      case 'LOW': return '#22C55E';
      case 'MODERATE': return '#EAB308';
      case 'HIGH': return '#F97316';
      case 'CRITICAL': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const elapsedSec = (() => {
    const parts = selectedTime.split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return (h * 3600 + m * 60 + s) % 840;
  })();

  if (isNodeActive) {
    const nodesToRender = selectedNode ? [selectedNode] : TRAFFIC_NODES;
    return (
      <div className="space-y-2">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <div>
            <div className="text-[10px] font-mono text-orange-400 tracking-wider">20-MIN PREDICTION</div>
            <div className="text-[9px] text-gray-400">{selectedNode ? `Forecast for ${selectedNode.name}` : 'Forecast across all monitored junctions'}</div>
          </div>
        </div>
        {nodesToRender.map(node => {
          const pred = getPrediction(node, '20min');
          const status = congestionToStatus(pred.congestion);
          const color = statusColor(status);
          return (
            <div key={node.id} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[11px] font-semibold text-white truncate">{node.name}</span>
                </div>
                <span className="text-[9px] font-mono uppercase shrink-0" style={{ color }}>{statusLabel(status)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-white/[0.03] rounded p-1.5">
                  <div className="text-[8px] text-gray-500 font-mono">Density</div>
                  <div className="text-[11px] font-bold font-mono" style={{ color }}>{pred.density}%</div>
                </div>
                <div className="bg-white/[0.03] rounded p-1.5">
                  <div className="text-[8px] text-gray-500 font-mono">Vehicles</div>
                  <div className="text-[11px] font-bold font-mono text-orange-400">{pred.vehicleCount.toLocaleString()}</div>
                </div>
                <div className="bg-white/[0.03] rounded p-1.5">
                  <div className="text-[8px] text-gray-500 font-mono">Speed</div>
                  <div className="text-[11px] font-bold font-mono text-blue-400">{pred.avgSpeed}<span className="text-[8px] text-gray-500"> km/h</span></div>
                </div>
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-gray-500">Confidence</span>
                <span className="text-purple-400">{pred.confidence}%</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (isLinkActive) {
    const mappedIds = connectionToLinks[selectedLink] || [];
    const linkForecasts = mappedIds.map(linkId => {
      const preds = gcsPredictions.filter(p => p.link === linkId);
      if (preds.length === 0) return null;
      
      const baseForecast = preds.find(p => p.predictionHorizonSec === elapsedSec) ||
             preds.reduce((max, p) => p.predictionHorizonSec > max.predictionHorizonSec ? p : max, preds[0]);

      if (isWhatIfActive) {
        // Calculate simulated queue length
        const lanesAdjustment = whatIfLanesBlocked * 0.22;
        const intensityAdjustment = whatIfEventIntensity * 0.0025;
        const retimingAdjustment = isRetimingApplied ? whatIfRetimingSeconds * 0.015 : 0;
        const queuePred = Math.min(1.0, Math.max(0.0, baseForecast.queuePred + lanesAdjustment + intensityAdjustment - retimingAdjustment));
        
        // Calculate simulated delay seconds
        const delayAdjustmentLanes = whatIfLanesBlocked * 25;
        const delayAdjustmentIntensity = whatIfEventIntensity * 0.35;
        const delayAdjustmentRetiming = isRetimingApplied ? whatIfRetimingSeconds * 1.2 : 0;
        const delayPred = Math.max(0.0, baseForecast.delayPred + delayAdjustmentLanes + delayAdjustmentIntensity - delayAdjustmentRetiming);
        
        // Calculate simulated severity index
        const severityIndex = Math.min(100, Math.max(0, baseForecast.severityIndex + whatIfLanesBlocked * 20 + whatIfEventIntensity * 0.25 - (isRetimingApplied ? whatIfRetimingSeconds * 1.0 : 0)));
        
        let severityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (severityIndex >= 75) severityLevel = 'CRITICAL';
        else if (severityIndex >= 50) severityLevel = 'HIGH';
        else if (severityIndex >= 25) severityLevel = 'MODERATE';
        
        const recommendedStrategy = 
          severityLevel === 'LOW' ? "Monitor Traffic Conditions" :
          severityLevel === 'MODERATE' ? "Activate VMS + Traveler Information" :
          severityLevel === 'HIGH' ? "Diversion Route + Signal Retiming" :
                                     "Full Detour + Emergency Response";

        return {
          ...baseForecast,
          queuePred,
          delayPred,
          severityIndex,
          severityLevel,
          recommendedStrategy
        };
      }
      return baseForecast;
    }).filter(Boolean) as GCSPredictionData[];

    return (
      <div className="space-y-3">
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-orange-400 shrink-0" />
          <div>
            <div className="text-[10px] font-mono text-orange-400 tracking-wider">STGNN MODEL FORECAST</div>
            <div className="text-[9px] text-gray-400">Deep Spatial-Temporal predictions</div>
          </div>
        </div>

        {/* What-If Simulation Sandbox Panel */}
        <div className="bg-[#0F1117]/80 backdrop-blur-md border border-white/[0.06] rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-orange-400" />
              <div>
                <h4 className="text-xs font-bold text-white leading-none">What-If Sandbox</h4>
                <p className="text-[9px] text-gray-500 font-sans mt-0.5">Simulate incident conditions</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isWhatIfActive} 
                onChange={(e) => {
                  setIsWhatIfActive(e.target.checked);
                  if (!e.target.checked) {
                    setIsRetimingApplied(false);
                  }
                }}
                className="sr-only peer" 
              />
              <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-3 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          {isWhatIfActive && (
            <div className="space-y-3 pt-2 border-t border-white/[0.04]">
              {/* Lanes Blocked Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-gray-400">
                  <span>Simulated Lanes Blocked</span>
                  <span className="text-orange-400 font-bold font-mono">{whatIfLanesBlocked} / 3 Lanes</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="3" 
                  value={whatIfLanesBlocked}
                  onChange={(e) => {
                    setWhatIfLanesBlocked(parseInt(e.target.value, 10));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              {/* Event Intensity Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono text-gray-400">
                  <span>Simulated Event Intensity</span>
                  <span className="text-orange-400 font-bold font-mono">{whatIfEventIntensity}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={whatIfEventIntensity}
                  onChange={(e) => {
                    setWhatIfEventIntensity(parseInt(e.target.value, 10));
                  }}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          )}
        </div>

        {linkForecasts.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 text-center text-xs text-gray-400">
            No forecast data available for selected link.
          </div>
        ) : (
          linkForecasts.map(f => {
            const desc = linkDescriptions[f.link] || `Link ${f.link}`;
            const sevColor = severityColor(f.severityLevel);
            const isQueueIncreasing = f.queuePred > f.queueTrue;
            const isDelayIncreasing = f.delayPred > f.delayTrue;
            const horizonMin = (f.predictionHorizonSec / 60).toFixed(1);
            const needsRetiming = f.severityLevel === 'HIGH' || f.severityLevel === 'CRITICAL';

            return (
              <div key={f.link} className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="text-xs font-bold text-white leading-snug flex items-center gap-1.5 min-w-0">
                    <span className="text-[8.5px] font-mono bg-white/[0.06] border border-white/[0.1] px-1.5 py-0.5 rounded text-orange-400 font-extrabold shrink-0 uppercase tracking-wider">
                      {f.link}
                    </span>
                    <span className="truncate" title={desc}>{desc}</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
                    style={{ color: sevColor, backgroundColor: `${sevColor}15`, border: `1px solid ${sevColor}30` }}>
                    {f.severityLevel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Queue Prediction */}
                  <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded">
                    <div className="text-[9px] text-gray-400 uppercase font-mono mb-1 font-bold">Queue Length</div>
                    <div className="flex items-baseline gap-1.5 justify-between">
                      <span className="text-gray-400 font-mono text-[9px]">T: {f.queueTrue.toFixed(3)}</span>
                      <span className="font-mono font-bold text-white">P: {f.queuePred.toFixed(3)}</span>
                    </div>
                    <div className="text-[9px] mt-1 text-right flex items-center justify-end gap-1">
                      {isQueueIncreasing ? (
                        <span className="text-red-400 font-semibold font-sans">▲ Increasing</span>
                      ) : (
                        <span className="text-green-400 font-semibold font-sans">▼ Decreasing</span>
                      )}
                    </div>
                  </div>

                  {/* Delay Prediction */}
                  <div className="bg-white/[0.02] border border-white/[0.04] p-2 rounded">
                    <div className="text-[9px] text-gray-400 uppercase font-mono mb-1 font-bold">Veh Delay</div>
                    <div className="flex items-baseline gap-1.5 justify-between">
                      <span className="text-gray-400 font-mono text-[9px]">T: {f.delayTrue.toFixed(2)}s</span>
                      <span className="font-mono font-bold text-white">P: {f.delayPred.toFixed(2)}s</span>
                    </div>
                    <div className="text-[9px] mt-1 text-right flex items-center justify-end gap-1">
                      {isDelayIncreasing ? (
                        <span className="text-red-400 font-semibold font-sans">▲ Increasing</span>
                      ) : (
                        <span className="text-green-400 font-semibold font-sans">▼ Decreasing</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Horizon & severity index */}
                <div className="flex justify-between items-center text-[10px] font-mono text-gray-400 border-t border-white/[0.04] pt-2">
                  <span>Horizon: {horizonMin} min</span>
                  <span>Severity Index: <span className="text-white font-bold">{f.severityIndex.toFixed(1)}</span></span>
                </div>

                {/* Action Strategy */}
                <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-2 rounded flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[9px] font-mono font-bold uppercase tracking-wider">STGNN RECOMMENDED STRATEGY</div>
                    <div className="text-xs text-gray-200 mt-0.5 leading-relaxed font-sans">{f.recommendedStrategy}</div>
                  </div>
                </div>

                {/* Closed-Loop Traffic Signal Retiming Agent Recommendations */}
                {needsRetiming && (
                  <div className="mt-2 bg-green-500/10 border border-green-500/20 text-green-400 p-2.5 rounded-lg space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-green-400 animate-pulse" />
                      <div className="text-[9px] font-mono font-bold uppercase tracking-wider">AI SIGNAL RETIMING AGENT</div>
                    </div>
                    <p className="text-[10px] text-gray-300 leading-normal font-sans">
                      Recommendation: Increase green phase of link <span className="font-bold text-white font-mono">{f.link}</span> by <span className="font-bold text-white font-mono">{whatIfRetimingSeconds}s</span> to alleviate queue delay.
                    </p>
                    
                    {isRetimingApplied ? (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] font-mono text-green-400 flex items-center gap-1 font-bold">
                          ✓ Plan Applied (+{whatIfRetimingSeconds}s)
                        </span>
                        <button 
                          onClick={() => setIsRetimingApplied(false)}
                          className="text-[9px] font-mono font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 rounded hover:bg-red-500/25 transition-all"
                        >
                          Reset Timing
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsRetimingApplied(true)}
                        className="w-full text-center text-[10px] font-mono font-bold text-green-950 bg-green-400 border border-green-500/30 py-1.5 rounded hover:bg-green-300 transition-all flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-950" /> Apply Retiming Plan
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // Otherwise: neither node nor link selected - list all 8 links
  const allStgnnLinks = ['L19', 'L13', 'L6', 'L17', 'L18', 'L1', 'L16', 'L3'];
  const allLinkForecasts = allStgnnLinks.map(linkId => {
    const preds = gcsPredictions.filter(p => p.link === linkId);
    if (preds.length === 0) return null;
    const f = preds.find(p => p.predictionHorizonSec === elapsedSec) ||
              preds.reduce((max, p) => p.predictionHorizonSec > max.predictionHorizonSec ? p : max, preds[0]);
    return {
      linkId,
      forecast: f,
      description: linkDescriptions[linkId] || `Link ${linkId}`,
      connectionKey: linkToConnectionMap[linkId]
    };
  }).filter((x): x is { linkId: string; forecast: GCSPredictionData; description: string; connectionKey: string; } => x !== null);

  return (
    <div className="space-y-3">
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2.5 flex items-center gap-2">
        <Brain className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <div>
          <div className="text-[10px] font-mono text-orange-400 tracking-wider">STGNN NETWORK FORECAST</div>
          <div className="text-[9px] text-gray-400 font-bold">Predictions for 8 primary links</div>
        </div>
      </div>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {allLinkForecasts.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-4 text-center text-xs text-gray-500">
            No STGNN predictions loaded yet.
          </div>
        ) : (
          allLinkForecasts.map(({ linkId, forecast, description, connectionKey }) => {
            const sevColor = severityColor(forecast.severityLevel);
            return (
              <div
                key={linkId}
                onClick={() => {
                  if (onSelectLink && connectionKey) {
                    onSelectLink(connectionKey);
                  }
                }}
                className={`bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-lg p-2.5 transition-all text-left space-y-1.5 ${
                  connectionKey ? 'cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="text-[11px] font-bold text-white truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-[8px] font-mono bg-white/[0.06] border border-white/[0.1] px-1 py-0.5 rounded text-orange-400 font-extrabold shrink-0 uppercase tracking-wider">
                      {linkId}
                    </span>
                    <span className="truncate" title={description}>{description}</span>
                  </div>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded font-bold uppercase shrink-0"
                    style={{ color: sevColor, backgroundColor: `${sevColor}15`, border: `1px solid ${sevColor}20` }}>
                    {forecast.severityLevel}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono">
                  <div>Q Pred: <span className="text-white font-bold">{forecast.queuePred.toFixed(3)}</span></div>
                  <div>Delay Pred: <span className="text-white font-bold">{forecast.delayPred.toFixed(1)}s</span></div>
                </div>

                <div className="text-[9px] text-orange-400/90 truncate leading-snug font-sans flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                  <span>{forecast.recommendedStrategy}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
