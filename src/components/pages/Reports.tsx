import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, TrendingUp, AlertTriangle, Plane, Brain, Calendar, Clock, Filter, CheckCircle } from 'lucide-react';
import type { Token, Incident, Drone, TrafficNode } from '../../types';
import { formatDate, formatTime } from '../../utils';

interface ReportsProps {
  tokens: Token[];
  incidents: Incident[];
  drones: Drone[];
  nodes: TrafficNode[];
}

const REPORT_TYPES = [
  { id: 'traffic', label: 'Traffic Summary', icon: TrendingUp, color: '#F97316', desc: 'Node-level density, speed, and vehicle counts' },
  { id: 'incident', label: 'Incident Summary', icon: AlertTriangle, color: '#EF4444', desc: 'All logged incidents and resolution status' },
  { id: 'drone', label: 'Drone Summary', icon: Plane, color: '#3B82F6', desc: 'UAV fleet status, coverage, and missions' },
  { id: 'ai', label: 'AI Prediction Summary', icon: Brain, color: '#A855F7', desc: 'Model accuracy and forecast outcomes' },
];

export default function Reports({ tokens, incidents, drones, nodes }: ReportsProps) {
  const now = new Date().toISOString();

  // Period report picker states
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState('23:59');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Filter incidents and tokens by time period and priority
  const filteredData = useMemo(() => {
    const startLimit = new Date(`${startDate}T${startTime}:00`).getTime();
    const endLimit = new Date(`${endDate}T${endTime}:59`).getTime();

    const filteredIncidents = incidents.filter(i => {
      const ts = new Date(i.timestamp).getTime();
      const matchTime = ts >= startLimit && ts <= endLimit;
      const matchPri = selectedPriority === 'ALL' || i.priority.toUpperCase() === selectedPriority.toUpperCase();
      return matchTime && matchPri;
    });

    const filteredTokens = tokens.filter(t => {
      const ts = new Date(t.timestamp).getTime();
      const matchTime = ts >= startLimit && ts <= endLimit;
      const matchPri = selectedPriority === 'ALL' || t.priority.toUpperCase() === selectedPriority.toUpperCase();
      return matchTime && matchPri;
    });

    // Average stats for the nodes
    const avgDensity = Math.round(nodes.reduce((sum, n) => sum + n.density, 0) / (nodes.length || 1));
    const avgSpeed = Math.round(nodes.reduce((sum, n) => sum + n.avgSpeed, 0) / (nodes.length || 1));

    return {
      filteredIncidents,
      filteredTokens,
      avgDensity,
      avgSpeed
    };
  }, [startDate, startTime, endDate, endTime, selectedPriority, incidents, tokens, nodes]);

  // Generate and download text report file
  const handleDownloadReport = () => {
    const content = `============================================================
NIT DEM COMMAND CENTER - OPERATIONAL PERIOD REPORT
============================================================
Generated: ${new Date().toLocaleString()}
Reporting Range: ${startDate} ${startTime} to ${endDate} ${endTime}
Priority Filter: ${selectedPriority}

1. EXECUTIVE SUMMARY
------------------------------------------------------------
During this reporting period, the NITDEM command platform processed 
corridor telemetry, managed drone patrols, and generated spatial-temporal 
directives to optimize the Kozhikode traffic network.

- Average Network Density  : ${filteredData.avgDensity}%
- Average Network Speed    : ${filteredData.avgSpeed} km/h
- Monitored Nodes Count    : ${nodes.length}
- Total Incidents Logged   : ${filteredData.filteredIncidents.length}
- Tactical Tokens Created  : ${filteredData.filteredTokens.length}

2. INCIDENTS LOGGED IN PERIOD
------------------------------------------------------------
${filteredData.filteredIncidents.length === 0 
  ? 'No incidents logged during this time window.' 
  : filteredData.filteredIncidents.map((inc, index) => 
      `${index + 1}. [${inc.priority.toUpperCase()}] ${inc.type} at ${inc.location}
   Timestamp: ${new Date(inc.timestamp).toLocaleString()}
   Status   : ${inc.status.toUpperCase()}
   Details  : ${inc.description}
   Token ID : ${inc.tokenId}
`
    ).join('\n')
}

3. TACTICAL DIRECTIVES & ACTIONS DEPLOYED
------------------------------------------------------------
${filteredData.filteredTokens.length === 0 
  ? 'No tactical directives deployed during this time window.' 
  : filteredData.filteredTokens.map((tok, index) => 
      `${index + 1}. [${tok.priority.toUpperCase()}] Directive: ${tok.type}
   Location   : ${tok.location}
   Issued By  : ${tok.generatedBy} (${tok.id})
   Details    : ${tok.description}
`
    ).join('\n')
}

4. UAV DRONE FLEET STATUS
------------------------------------------------------------
${drones.map(d => 
    `- ${d.name}: Battery ${d.battery.toFixed(0)}% | Altitude ${d.altitude}m | Status: ${d.status.toUpperCase()}`
  ).join('\n')
}

============================================================
END OF REPORT · CONFIDENTIAL · FOR REGULATORY REVIEW ONLY
============================================================`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nitdem_ops_report_${startDate}_${startTime.replace(':', '')}_to_${endDate}_${endTime.replace(':', '')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold text-white">Reports & Audit Log</h1>
        <p className="text-xs text-gray-500 font-sans mt-0.5">Generate, audit, and download period-specific operational reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Period Report Picker Sidebar */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 space-y-4 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Period Selector</span>
          </div>

          {/* Start Date & Time */}
          <div className="space-y-3 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase font-bold">
              <Clock className="w-3 h-3 text-orange-400" /> Start Bound
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold">Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded p-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 font-bold"
                />
              </div>
              <div>
                <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold">Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded p-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 font-bold"
                />
              </div>
            </div>
          </div>

          {/* End Date & Time */}
          <div className="space-y-3 bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg">
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-gray-400 uppercase font-bold">
              <Clock className="w-3 h-3 text-red-400" /> End Bound
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold">Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded p-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 font-bold"
                />
              </div>
              <div>
                <label className="text-[7.5px] font-mono text-gray-500 uppercase font-bold">Time</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded p-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Priority filter */}
          <div>
            <label className="block text-[8px] font-mono text-gray-500 uppercase font-bold mb-1.5">Priority Filter</label>
            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded px-8 py-2 text-[10px] font-mono text-white focus:outline-none focus:border-orange-500/50 font-bold"
              >
                <option value="ALL" className="bg-[#0F1117]">ALL PRIORITIES</option>
                <option value="LOW" className="bg-[#0F1117]">LOW</option>
                <option value="MEDIUM" className="bg-[#0F1117]">MEDIUM</option>
                <option value="HIGH" className="bg-[#0F1117]">HIGH</option>
                <option value="CRITICAL" className="bg-[#0F1117]">CRITICAL</option>
              </select>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleDownloadReport}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-mono text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-orange-500/10 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Period Report
          </button>
        </div>

        {/* Live Period Report Preview */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 lg:col-span-2 space-y-3.5">
          <div className="flex items-center justify-between border-b border-white/[0.04] pb-2">
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Operational Audit Preview</span>
            <span className="text-[9px] font-mono text-gray-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/[0.05]">
              Previewing matches: {filteredData.filteredIncidents.length} incidents · {filteredData.filteredTokens.length} directives
            </span>
          </div>

          {/* Incidents preview */}
          <div className="space-y-2">
            <div className="text-[9px] font-mono text-gray-500 uppercase font-bold tracking-wider">Incidents Logged in Period</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredData.filteredIncidents.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 font-sans border border-dashed border-white/[0.05] rounded-lg">
                  No incidents logged during selected time window.
                </div>
              ) : (
                filteredData.filteredIncidents.map(inc => {
                  const priColor =
                    inc.priority === 'critical' ? '#EF4444'
                    : inc.priority === 'high' ? '#F97316'
                    : inc.priority === 'medium' ? '#EAB308' : '#22C55E';
                  return (
                    <div key={inc.id} className="bg-white/[0.02] border border-white/[0.04] rounded p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <span className="text-[8px] font-mono bg-white/[0.04] px-1 py-0.5 rounded" style={{ color: priColor }}>{inc.priority.toUpperCase()}</span>
                          {inc.type}
                        </div>
                        <div className="text-[10px] text-gray-500 font-sans mt-0.5">{inc.location} · {new Date(inc.timestamp).toLocaleString()}</div>
                      </div>
                      <span className="text-[9px] font-mono uppercase text-gray-400">{inc.status}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Directives preview */}
          <div className="space-y-2 pt-2 border-t border-white/[0.04]">
            <div className="text-[9px] font-mono text-gray-500 uppercase font-bold tracking-wider">Tactical Directives Deployed</div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredData.filteredTokens.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-500 font-sans border border-dashed border-white/[0.05] rounded-lg">
                  No tactical directives generated during selected time window.
                </div>
              ) : (
                filteredData.filteredTokens.map(tok => (
                  <div key={tok.id} className="bg-white/[0.02] border border-white/[0.04] rounded p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span className="text-[8px] font-mono bg-orange-500/10 border border-orange-500/20 px-1 py-0.5 rounded text-orange-400 font-bold uppercase">{tok.id}</span>
                        {tok.type}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 font-sans leading-relaxed">{tok.description}</div>
                    </div>
                    <span className="text-[8px] font-mono text-gray-500 self-start mt-0.5 shrink-0 uppercase">BY: {tok.generatedBy}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reports Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORT_TYPES.map((report, i) => (
          <motion.div key={report.id}
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${report.color}20` }}>
                <report.icon className="w-5 h-5" style={{ color: report.color }} />
              </div>
            </div>
            <div className="text-sm font-bold text-white mb-1">{report.label}</div>
            <div className="text-xs text-gray-500 mb-3">{report.desc}</div>

            {report.id === 'traffic' && (
              <div className="space-y-1.5">
                {nodes.slice(0, 3).map(n => (
                  <div key={n.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2 py-1.5">
                    <span className="text-gray-400 font-sans">{n.name}</span>
                    <span className="text-orange-400">{n.density}%</span>
                  </div>
                ))}
              </div>
            )}
            {report.id === 'incident' && (
              <div className="space-y-1.5">
                {incidents.slice(0, 3).map(inc => (
                  <div key={inc.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2 py-1.5">
                    <span className="text-gray-400 font-sans truncate max-w-[120px]">{inc.type}</span>
                    <span className="text-red-400 font-sans capitalize">{inc.priority}</span>
                  </div>
                ))}
              </div>
            )}
            {report.id === 'drone' && (
              <div className="space-y-1.5">
                {drones.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2 py-1.5">
                    <span className="text-gray-400 font-sans">{d.name}</span>
                    <span className="text-blue-400">{d.battery.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
            {report.id === 'ai' && (
              <div className="space-y-1.5">
                {[
                  { k: 'Prediction Accuracy', v: '96.2%' },
                  { k: 'Inference latency', v: '0.18s' },
                ].map(({ k, v }) => (
                  <div key={k} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2 py-1.5">
                    <span className="text-gray-400 font-sans">{k}</span>
                    <span className="text-purple-400">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
