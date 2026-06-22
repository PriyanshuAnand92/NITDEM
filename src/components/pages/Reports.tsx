import { motion } from 'framer-motion';
import { FileText, Download, TrendingUp, AlertTriangle, Plane, Brain } from 'lucide-react';
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

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* Title */}
      <div>
        <h1 className="text-lg font-bold text-white">Reports</h1>
        <p className="text-xs text-gray-500 font-sans mt-0.5">Generate operational reports for Smart City Authority review</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORT_TYPES.map((report, i) => (
          <motion.div key={report.id}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${report.color}20` }}>
                <report.icon className="w-5 h-5" style={{ color: report.color }} />
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs font-sans text-gray-400 hover:text-white hover:border-white/[0.2] transition-all">
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
            </div>
            <div className="text-sm font-bold text-white mb-1">{report.label}</div>
            <div className="text-xs text-gray-500 mb-3">{report.desc}</div>

            {/* Preview content */}
            {report.id === 'traffic' && (
              <div className="space-y-1.5">
                {nodes.slice(0, 3).map(n => (
                  <div key={n.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2.5 py-2">
                    <span className="text-gray-400 font-sans">{n.name}</span>
                    <span className="text-orange-400">{n.density}% · {n.vehicleCount.toLocaleString()} veh</span>
                  </div>
                ))}
                <div className="text-xs text-gray-500 text-center pt-1">+ {nodes.length - 3} more nodes</div>
              </div>
            )}
            {report.id === 'incident' && (
              <div className="space-y-1.5">
                {(incidents.length > 0 ? incidents : tokens.filter(t => t.type.includes('Accident') || t.type.includes('Congestion'))).slice(0, 3).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2.5 py-2">
                    <span className="text-gray-400 font-sans">{item.type}</span>
                    <span className="text-red-400 capitalize font-sans font-semibold">{item.priority}</span>
                  </div>
                ))}
                {incidents.length === 0 && tokens.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-2">No incidents to report</div>
                )}
              </div>
            )}
            {report.id === 'drone' && (
              <div className="space-y-1.5">
                {drones.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2.5 py-2">
                    <span className="text-gray-400 font-sans">{d.name}</span>
                    <span className="text-blue-400">{d.battery.toFixed(0)}% · {d.altitude}m</span>
                  </div>
                ))}
              </div>
            )}
            {report.id === 'ai' && (
              <div className="space-y-1.5">
                {[
                  { k: 'Prediction Accuracy', v: '96.2%' },
                  { k: 'Inference Time', v: '0.18s' },
                  { k: 'Model Status', v: 'Online' },
                ].map(({ k, v }) => (
                  <div key={k} className="flex items-center justify-between text-xs font-mono bg-white/[0.03] rounded px-2.5 py-2">
                    <span className="text-gray-400 font-sans">{k}</span>
                    <span className="text-purple-400">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Full ledger export */}
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Master Intelligence Ledger</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/30 text-xs font-sans text-orange-400 hover:bg-orange-500/10 transition-all">
            <Download className="w-3.5 h-3.5" /> Export Full Report
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Tokens', value: tokens.length, color: '#F97316' },
            { label: 'Active', value: tokens.filter(t => t.status === 'active').length, color: '#EF4444' },
            { label: 'Resolved', value: tokens.filter(t => t.status === 'resolved').length, color: '#22C55E' },
            { label: 'Pending', value: tokens.filter(t => t.status === 'pending').length, color: '#EAB308' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/[0.03] rounded-lg p-3 text-center border border-white/[0.05]">
              <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
              <div className="text-xs text-gray-500 font-sans uppercase tracking-wide mt-1">{label}</div>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 font-sans text-center">
          Report generated on {formatDate(now)} at {formatTime(now)} IST · NIT DEM Command Center
        </div>
      </div>
    </div>
  );
}
