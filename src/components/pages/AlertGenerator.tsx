import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Hash, CheckCircle } from 'lucide-react';
import type { Token } from '../../types';

interface AlertGenProps {
  onCreateToken: (data: Omit<Token, 'id' | 'timestamp'>) => Token;
}

const ALERT_TYPES = [
  { id: 'accident', label: 'Accident Alert', icon: '🚨', priority: 'critical' as const, color: '#EF4444' },
  { id: 'congestion', label: 'Congestion Alert', icon: '🚦', priority: 'high' as const, color: '#F97316' },
  { id: 'event', label: 'Event Warning', icon: '📢', priority: 'medium' as const, color: '#EAB308' },
  { id: 'drone', label: 'Drone Observation', icon: '🚁', priority: 'low' as const, color: '#3B82F6' },
  { id: 'weather', label: 'Weather Alert', icon: '⛈', priority: 'medium' as const, color: '#06B6D4' },
  { id: 'custom', label: 'Custom Alert', icon: '⚙', priority: 'low' as const, color: '#A855F7' },
];

const LOCATIONS = ['Stadium Junction', 'Mavoor Road', 'Palayam', 'KSRTC Bus Stand', 'Mini Bypass', 'City Wide'];

export default function AlertGenerator({ onCreateToken }: AlertGenProps) {
  const [selectedType, setSelectedType] = useState(ALERT_TYPES[0]);
  const [form, setForm] = useState({ location: LOCATIONS[0], message: '', source: 'Operator: admin' });
  const [lastToken, setLastToken] = useState<Token | null>(null);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = () => {
    const token = onCreateToken({
      type: selectedType.label,
      priority: selectedType.priority,
      location: form.location,
      status: 'active',
      description: form.message || `${selectedType.label} at ${form.location}`,
      generatedBy: form.source,
    });
    setLastToken(token);
    setGenerated(true);
    setTimeout(() => setGenerated(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Alert Generator</h1>
        <p className="text-xs text-gray-500 font-sans mt-0.5">Demo & Testing — Create intelligence tokens for any scenario</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Alert type selector */}
        <div className="space-y-2">
          <div className="text-xs font-sans font-semibold tracking-wider uppercase px-1 text-gray-400">Alert Type</div>
          {ALERT_TYPES.map(type => (
            <motion.button key={type.id} onClick={() => setSelectedType(type)}
              whileHover={{ x: 3 }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left ${
                selectedType.id === type.id
                  ? 'border-opacity-50 text-white'
                  : 'border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
              }`}
              style={selectedType.id === type.id ? {
                background: `${type.color}15`,
                borderColor: `${type.color}40`,
              } : {}}>
              <span className="text-xl">{type.icon}</span>
              <div className="flex-1">
                <div className="text-xs font-medium">{type.label}</div>
                <div className="text-[11px] font-mono capitalize" style={{ color: selectedType.id === type.id ? type.color : '#6B7280' }}>
                  {type.priority} priority
                </div>
              </div>
              {selectedType.id === type.id && (
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
              )}
            </motion.button>
          ))}
        </div>

        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{selectedType.icon}</span>
              <div>
                <div className="text-sm font-bold text-white">{selectedType.label}</div>
                <div className="text-xs font-mono" style={{ color: selectedType.color }}>
                  {selectedType.priority.toUpperCase()} PRIORITY
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Location</label>
              <select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all">
                {LOCATIONS.map(l => <option key={l} value={l} className="bg-[#151820]">{l}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Message / Description</label>
              <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                placeholder={`Describe the ${selectedType.label.toLowerCase()}...`}
                rows={4}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-sans focus:outline-none focus:border-orange-500/50 transition-all resize-none" />
            </div>

            <div>
              <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Source / Reporter</label>
              <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white font-sans focus:outline-none focus:border-orange-500/50 transition-all" />
            </div>

            <div className="flex gap-3">
              <motion.button onClick={handleGenerate}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-lg font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: `linear-gradient(135deg, ${selectedType.color}, ${selectedType.color}AA)`, color: 'white' }}>
                <Zap className="w-4 h-4" /> Generate Alert
              </motion.button>
              <motion.button onClick={handleGenerate}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-lg border font-mono text-sm font-bold flex items-center justify-center gap-2 transition-all hover:bg-white/[0.04]"
                style={{ borderColor: `${selectedType.color}50`, color: selectedType.color }}>
                <Hash className="w-4 h-4" /> Generate Token
              </motion.button>
            </div>
          </div>

          {/* Generated token display */}
          <AnimatePresence>
            {lastToken && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-[#0F1117] border border-orange-500/20 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  {generated ? (
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: 2 }}>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </motion.div>
                  ) : <Hash className="w-5 h-5 text-orange-400" />}
                  <div>
                    <div className="text-sm font-bold text-white">{generated ? 'Token Generated!' : 'Last Token'}</div>
                    <div className="text-xs text-gray-500 font-sans">Added to intelligence ledger</div>
                  </div>
                  <div className="ml-auto font-mono text-xl font-bold text-orange-400">{lastToken.id}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { k: 'Type', v: lastToken.type },
                    { k: 'Priority', v: lastToken.priority },
                    { k: 'Location', v: lastToken.location },
                    { k: 'Status', v: lastToken.status },
                  ].map(({ k, v }) => (
                    <div key={k} className="bg-white/[0.03] rounded p-2">
                      <div className="text-gray-500 font-sans">{k}</div>
                      <div className="text-white capitalize font-bold mt-0.5">{v}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
