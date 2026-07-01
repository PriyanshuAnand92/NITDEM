import { motion } from 'framer-motion';
import { Plane, Battery, Navigation, Radio, Activity, AlertTriangle } from 'lucide-react';
import type { Drone, TrafficNode } from '../../types';

interface DroneOpsProps {
  drones: Drone[];
  nodes: TrafficNode[];
}

function BatteryBar({ level }: { level: number }) {
  const color = level > 60 ? '#22C55E' : level > 30 ? '#EAB308' : '#EF4444';
  return (
    <div className="flex items-center gap-2">
      <Battery className="w-3.5 h-3.5" style={{ color }} />
      <div className="flex-1 bg-white/[0.06] rounded-full h-1.5">
        <motion.div className="h-1.5 rounded-full" style={{ backgroundColor: color, width: `${level}%` }}
          initial={{ width: 0 }} animate={{ width: `${level}%` }} transition={{ duration: 1 }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{level.toFixed(0)}%</span>
    </div>
  );
}

export default function DroneOperations({ drones, nodes }: DroneOpsProps) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Drone Operations</h1>
          <p className="text-xs text-gray-500 font-sans mt-0.5">UAV Fleet · Real-Time Monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-green-400">{drones.filter(d => d.status !== 'offline').length} DRONES ACTIVE</span>
        </div>
      </div>

      {/* Fleet overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {drones.map((drone, i) => {
          const targetNode = nodes.find(n => n.id === drone.targetNodeId);
          return (
            <motion.div key={drone.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="bg-[#0F1117] border border-blue-500/20 rounded-xl overflow-hidden">
              
              {/* Top bar */}
              <div className="bg-blue-500/10 border-b border-blue-500/15 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ y: [0, -3, 0], rotate: [0, 5, 0, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                    <Plane className="w-5 h-5 text-blue-400" />
                  </motion.div>
                  <div>
                    <div className="text-sm font-bold text-white">{drone.name}</div>
                    <div className="text-[11px] font-mono text-blue-400">ID: UAV-{drone.id.toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-[11px] font-mono text-green-400">STREAMING LIVE</span>
                </div>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-3">
                {/* Battery */}
                <BatteryBar level={drone.battery} />

                {/* Metrics grid */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Altitude', value: `${drone.altitude}m`, icon: Navigation, color: '#3B82F6' },
                    { label: 'Coverage', value: '250m', icon: Radio, color: '#A855F7' },
                    { label: 'Signal', value: '98%', icon: Activity, color: '#22C55E' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white/[0.04] rounded-lg p-2 text-center">
                      <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
                      <div className="text-xs font-bold font-mono" style={{ color }}>{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-500">
                    <span>CURRENT POSITION</span>
                    <span>NAVIGATING TO</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{drone.location}</span>
                    <div className="flex-1 mx-3 h-px bg-gradient-to-r from-blue-500/50 to-blue-500/10 relative">
                      <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity }}
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.8)]" />
                    </div>
                    <span className="text-xs text-blue-400 font-medium">{targetNode?.name || '—'}</span>
                  </div>
                </div>

                {/* Coordinates */}
                <div className="bg-white/[0.03] rounded-lg p-2 border border-white/[0.05]">
                  <div className="text-[11px] font-mono text-gray-500 mb-1">LIVE COORDINATES</div>
                  <div className="font-mono text-xs text-cyan-400">
                    {drone.lat.toFixed(4)}°N · {drone.lng.toFixed(4)}°E
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {['Recall', 'Hold', 'Reroute'].map(action => (
                    <button key={action}
                      className="text-xs font-mono py-1.5 rounded border border-white/[0.08] text-gray-400 hover:text-white hover:border-blue-500/30 hover:bg-blue-500/10 transition-all">
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mission log */}
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.05]">
          <span className="text-sm font-semibold text-white">Mission Log</span>
        </div>
        <div className="p-4 space-y-2">
          {[
            { time: '14:32', drone: 'Alpha', event: 'Deployed to Stadium Junction for crowd monitoring', type: 'info' },
            { time: '14:18', drone: 'Bravo', event: 'Completed patrol of Palayam corridor — No incidents detected', type: 'success' },
            { time: '14:05', drone: 'Alpha', event: 'Low battery warning at 15% — Auto-return initiated', type: 'warning' },
            { time: '13:45', drone: 'Bravo', event: 'Vehicle breakdown detected on Mavoor Road — Token TK-8124 generated', type: 'incident' },
          ].map(({ time, drone, event, type }, i) => (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 text-xs">
              <span className="font-mono text-gray-600 shrink-0 pt-0.5">{time}</span>
              <span className={`shrink-0 font-mono font-bold ${drone === 'Alpha' ? 'text-blue-400' : 'text-purple-400'}`}>{drone}</span>
              <span className={`${type === 'warning' ? 'text-yellow-400' : type === 'incident' ? 'text-red-400' : type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                {type === 'warning' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                {event}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
