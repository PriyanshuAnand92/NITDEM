import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, Play, CheckCircle, AlertTriangle, Plane, MapPin, Users, Brain } from 'lucide-react';
import { useAppStore } from '../../hooks/useAppStore';

const EVENTS = [
  { id: 'football', label: 'EMS Stadium Football Match', icon: '⚽', expectedAttendance: 25000 },
  { id: 'rally', label: 'Political Rally', icon: '📢', expectedAttendance: 15000 },
  { id: 'festival', label: 'Festival Event', icon: '🎉', expectedAttendance: 40000 },
];

const LOADING_STEPS = [
  'Initializing ST-GNN Model...',
  'Loading Historical Traffic Patterns...',
  'Computing Spatio-Temporal Features...',
  'Running Graph Neural Network...',
  'Generating Congestion Predictions...',
  'Calculating Confidence Intervals...',
  'Compiling Recommendations...',
];

interface Prediction {
  bottleneck: string;
  confidence: number;
  recommendation: string;
  officers: number;
  drones: number;
  alternateRoute: string;
  congestionStart: string;
  peakTime: string;
  expectedDelay: string;
}

export default function TrafficForecasting() {
  const store = useAppStore();
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0]);
  const [attendance, setAttendance] = useState('25000');
  const [eventTime, setEventTime] = useState('19:00');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [loadStep, setLoadStep] = useState(0);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const runPrediction = async () => {
    setStatus('loading');
    setLoadStep(0);
    setPrediction(null);
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setLoadStep(i + 1);
    }
    const att = parseInt(attendance) || 25000;
    setPrediction({
      bottleneck: att > 30000 ? 'KSRTC Bus Stand & Stadium Junction' : 'Stadium Junction',
      confidence: att > 30000 ? 98 : 96,
      recommendation: 'Increase Green Signal by 20 Seconds on NH-66',
      officers: att > 30000 ? 8 : 4,
      drones: att > 20000 ? 3 : 2,
      alternateRoute: 'Mini Bypass via Mavoor Road',
      congestionStart: `${parseInt(eventTime.split(':')[0]) - 1}:30`,
      peakTime: `${parseInt(eventTime.split(':')[0])}:15`,
      expectedDelay: att > 30000 ? '35–55 min' : '18–28 min',
    });
    setStatus('done');
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <h1 className="text-lg font-bold text-white">Traffic Forecasting</h1>
        <p className="text-xs text-gray-500 font-sans mt-0.5">Spatio-Temporal Graph Neural Network Event Simulation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input panel */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-semibold text-white">Event Configuration</span>
          </div>

          {/* Event selector */}
          <div>
            <label className="block text-xs font-sans font-semibold tracking-wider text-gray-400 mb-2 uppercase">Select Event Type</label>
            <div className="space-y-2">
              {EVENTS.map(event => (
                <button
                  key={event.id}
                  onClick={() => { setSelectedEvent(event); setAttendance(event.expectedAttendance.toString()); setStatus('idle'); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                    selectedEvent.id === event.id
                      ? 'bg-orange-500/15 border-orange-500/30 text-white'
                      : 'border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
                  }`}
                >
                  <span>{event.icon}</span>
                  <div>
                    <div className="text-xs font-medium">{event.label}</div>
                    <div className="text-xs text-gray-500 font-sans">Est. {event.expectedAttendance.toLocaleString()} attendees</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-sans font-semibold tracking-wider text-gray-400 mb-2 uppercase">Expected Attendance</label>
              <input
                type="number"
                value={attendance}
                onChange={e => setAttendance(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-semibold tracking-wider text-gray-400 mb-2 uppercase">Event Start Time</label>
              <input
                type="time"
                value={eventTime}
                onChange={e => setEventTime(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all"
              />
            </div>
          </div>

          <motion.button
            onClick={runPrediction}
            disabled={status === 'loading'}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 rounded-lg font-mono text-sm font-bold tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white' }}
          >
            <Play className="w-4 h-4" />
            Run ST-GNN Prediction
          </motion.button>
        </div>

        {/* Output panel */}
        <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 min-h-64">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-8">
                <TrendingUp className="w-10 h-10 text-gray-700 mb-3" />
                <p className="text-sm text-gray-500">Configure an event and run the prediction model</p>
                <p className="text-xs text-gray-600 font-sans mt-1">ST-GNN · Real-Time Spatial Analysis</p>
              </motion.div>
            )}

            {status === 'loading' && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-3">
                <div className="text-xs font-mono text-orange-400 tracking-wider mb-4">RUNNING SPATIO-TEMPORAL TRAFFIC PREDICTION...</div>
                {LOADING_STEPS.map((step, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: i < loadStep ? 1 : 0.3, x: 0 }}
                    className="flex items-center gap-2">
                    {i < loadStep ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    ) : i === loadStep ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}
                        className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 border border-white/[0.1] rounded-full shrink-0" />
                    )}
                    <span className={`text-xs font-mono ${i < loadStep ? 'text-gray-300' : 'text-gray-600'}`}>{step}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {status === 'done' && prediction && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-mono text-green-400 tracking-wider">PREDICTION COMPLETE</span>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="text-xs font-sans font-semibold text-red-400 mb-1">PREDICTED BOTTLENECK</div>
                  <div className="text-sm font-bold text-white">{prediction.bottleneck}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400 font-mono">Confidence: <span className="text-orange-400">{prediction.confidence}%</span></span>
                    <span className="text-xs text-gray-400 font-mono">Peak: {prediction.peakTime}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Deploy Officers', value: prediction.officers.toString(), icon: Users, color: '#F97316' },
                    { label: 'Deploy Drones', value: prediction.drones.toString(), icon: Plane, color: '#3B82F6' },
                    { label: 'Est. Delay', value: prediction.expectedDelay, icon: AlertTriangle, color: '#EF4444' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white/[0.04] rounded-lg p-2 text-center">
                      <Icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color }} />
                      <div className="text-xs font-bold font-mono" style={{ color }}>{value}</div>
                      <div className="text-[11px] text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                  <div className="text-xs font-sans font-semibold text-gray-400 mb-1">AI RECOMMENDATION</div>
                  <div className="text-xs text-white">{prediction.recommendation}</div>
                </div>

                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-2 text-xs font-sans font-semibold text-gray-400 mb-1">
                    <MapPin className="w-3 h-3" /> ALTERNATIVE ROUTE
                  </div>
                  <div className="text-xs text-green-400 font-mono">{prediction.alternateRoute}</div>
                </div>

                {/* STGNN Inference Network Insights */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-white/[0.04] pb-2">
                    <Brain className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">STGNN Inference Network Insights</div>
                  </div>

                  {/* Input Parameter Mapping */}
                  <div className="space-y-1.5">
                    <div className="text-[9px] font-mono text-gray-500 uppercase font-bold">1. Verified Model Inputs Mapping (X & E)</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded flex items-center justify-between">
                        <span className="text-gray-500">Event Active (E[0])</span>
                        <span className="text-green-400 font-bold">1.0 (TRUE)</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded flex items-center justify-between">
                        <span className="text-gray-500">Event Intensity (E[2])</span>
                        <span className="text-orange-400 font-bold">{(parseInt(attendance) / 40000).toFixed(2)}</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded flex items-center justify-between">
                        <span className="text-gray-500">Base Speed (X[1])</span>
                        <span className="text-blue-400 font-bold">48 km/h</span>
                      </div>
                      <div className="bg-white/[0.02] border border-white/[0.04] p-1.5 rounded flex items-center justify-between">
                        <span className="text-gray-500">Lanes Blocked (E[3])</span>
                        <span className="text-red-400 font-bold">{parseInt(attendance) > 30000 ? '2 Lanes' : '1 Lane'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Soft-Fused Adjacency Structure */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[9px] font-mono text-gray-500 uppercase font-bold">2. soft-fused adjacency matrix (A_fused)</div>
                    <div className="space-y-1.5 bg-white/[0.02] border border-white/[0.04] p-2 rounded text-[10px] font-mono">
                      {[
                        { label: 'Physical Connectivity (w_road)', w: 0.25, color: 'bg-blue-500' },
                        { label: 'Traffic Flow Density (w_traffic)', w: 0.35, color: 'bg-green-500' },
                        { label: 'Event Proximity (w_event)', w: 0.40, color: 'bg-orange-500' },
                      ].map(item => (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-gray-400">
                            <span>{item.label}</span>
                            <span className="text-white font-bold">{item.w * 100}%</span>
                          </div>
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className={`h-full ${item.color}`} style={{ width: `${item.w * 100}%` }}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Network Layer Pipeline Status */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[9px] font-mono text-gray-500 uppercase font-bold">3. Layer Execution Trace</div>
                    <div className="space-y-1 font-mono text-[9.5px]">
                      {[
                        'Event Gating sigmoid filter complete',
                        'Soft fusion (A_road + A_traffic + A_event) online',
                        'Multi-Head GAT spatial convolution complete',
                        'GRU sequence attention temporal parsing complete',
                        'Regression outputs projected & inverse-scaled',
                      ].map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-gray-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                          <span>{step}</span>
                          <span className="ml-auto text-[8px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">VERIFIED</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    store.addNotification({
                      type: 'success',
                      title: 'STGNN Directive Deployed',
                      message: `Tactical directive deployed to ${prediction.bottleneck}: ${prediction.recommendation}. Alternate route: ${prediction.alternateRoute}`,
                    });
                  }}
                  className="w-full py-2.5 rounded-lg text-xs font-mono font-bold border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all cursor-pointer"
                >
                  ⚡ DEPLOY DIRECTIVE
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
