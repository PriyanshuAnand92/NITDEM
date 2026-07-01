import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Battery, Shield, Navigation, Radio, Activity, 
  Cpu, Crosshair, ChevronLeft, ChevronRight, Camera, Maximize2, RefreshCw 
} from 'lucide-react';
import type { Drone } from '../../types';

interface DroneFeedProps {
  drones: Drone[];
  selectedDroneId: string | null;
  onSelectDrone: (id: string) => void;
}

interface DroneCapture {
  imageUrl: string;
  location: string;
  coordinates: string;
  time: string;
  altitude: string;
  battery: string;
  description: string;
  telemetry: {
    speed: string;
    direction: string;
    signal: string;
    status: string;
    detections: { cars: number; trucks: number; bikes: number };
  };
}

const DRONE_CAPTURES: Record<string, DroneCapture[]> = {
  alpha: [
    {
      imageUrl: '/drone_stadium.png',
      location: 'Stadium Junction',
      coordinates: '11.2553° N · 75.7861° E',
      time: '14:32:15 GMT+5:30',
      altitude: '120m',
      battery: '84%',
      description: 'Tactical aerial survey of Stadium Junction. High vehicle volume detected along Rammohan Road approach. Standard traffic signals operating.',
      telemetry: {
        speed: '32 km/h',
        direction: 'NNE',
        signal: '98%',
        status: 'NOMINAL',
        detections: { cars: 42, trucks: 6, bikes: 18 }
      }
    },
    {
      imageUrl: '/drone_bus_stand.png',
      location: 'Bus Stand Junction',
      coordinates: '11.2592° N · 75.7853° E',
      time: '14:28:40 GMT+5:30',
      altitude: '115m',
      battery: '79%',
      description: 'Active scanning of bus stand entry corridor. Bus queuing observed near terminal gates. Requesting signal cycle optimization from central hub.',
      telemetry: {
        speed: '28 km/h',
        direction: 'W',
        signal: '96%',
        status: 'MONITORING',
        detections: { cars: 31, trucks: 14, bikes: 22 }
      }
    }
  ],
  bravo: [
    {
      imageUrl: '/drone_palayam.png',
      location: 'Palayam Junction',
      coordinates: '11.2489° N · 75.7839° E',
      time: '14:18:05 GMT+5:30',
      altitude: '135m',
      battery: '91%',
      description: 'High-altitude patrol over Palayam market link. Checking for illegal roadside loading operations. Overall traffic flow is running smoothly.',
      telemetry: {
        speed: '22 km/h',
        direction: 'SSE',
        signal: '99%',
        status: 'NOMINAL',
        detections: { cars: 55, trucks: 4, bikes: 34 }
      }
    },
    {
      imageUrl: '/drone_mananchira.png',
      location: 'Mananchira Junction',
      coordinates: '11.2542° N · 75.7817° E',
      time: '14:12:30 GMT+5:30',
      altitude: '125m',
      battery: '85%',
      description: 'Live scan of Mananchira loop and park ring road. Free flowing conditions reported. No active bottlenecks or parked obstacles identified.',
      telemetry: {
        speed: '40 km/h',
        direction: 'E',
        signal: '97%',
        status: 'NOMINAL',
        detections: { cars: 20, trucks: 2, bikes: 12 }
      }
    }
  ]
};

export default function DroneFeed({ drones, selectedDroneId, onSelectDrone }: DroneFeedProps) {
  const currentDroneId = selectedDroneId || 'alpha';
  const captures = DRONE_CAPTURES[currentDroneId] || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [activeTab, setActiveTab] = useState<'fleet' | 'feed' | 'details'>('feed');

  // Reset slide index when drone changes
  useEffect(() => {
    setCurrentIdx(0);
  }, [currentDroneId]);

  const activeCapture = captures[currentIdx] || null;
  const currentDrone = drones.find(d => d.id === currentDroneId);

  const nextSlide = () => {
    setCurrentIdx(prev => (prev + 1) % captures.length);
  };

  const prevSlide = () => {
    setCurrentIdx(prev => (prev - 1 + captures.length) % captures.length);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0C10]">
      {/* Mobile/Tablet Tab Header */}
      <div className="lg:hidden flex border-b border-white/[0.08] bg-[#0F1117] px-2 py-1.5 shrink-0 gap-1.5 z-10">
        {[
          { id: 'fleet', label: 'UAV Fleet' },
          { id: 'feed', label: 'Live Video Feed' },
          { id: 'details', label: 'Telemetry Details' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 text-center py-2 text-xs font-mono font-bold rounded-lg transition-all border ${
              activeTab === tab.id
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT: UAV Fleet List */}
        <div className={`w-full lg:w-64 border-r border-white/[0.06] p-4 flex-col shrink-0 bg-[#0F1117] ${
          activeTab === 'fleet' ? 'flex h-full overflow-y-auto' : 'hidden lg:flex'
        }`}>
          <div className="mb-4">
            <h2 className="text-xs font-mono font-bold tracking-widest text-gray-500 uppercase">ACTIVE FLEET</h2>
            <p className="text-xs text-gray-600 font-sans mt-0.5">Select UAV to access telemetry feeds</p>
          </div>

          <div className="space-y-2.5 flex-1">
            {drones.map(drone => {
              const isSelected = drone.id === currentDroneId;
              return (
                <button
                  key={drone.id}
                  onClick={() => {
                    onSelectDrone(drone.id);
                    setActiveTab('feed'); // Auto-switch to feed view when selecting a drone
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected 
                      ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                      : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Plane className={`w-4 h-4 ${isSelected ? 'text-blue-400' : 'text-gray-400'}`} />
                      <span className="text-xs font-bold text-white">{drone.name}</span>
                    </div>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      drone.status === 'streaming' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {drone.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Battery</span>
                      <span className={drone.battery > 50 ? 'text-green-400' : 'text-red-400'}>{drone.battery.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-white/[0.05] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${drone.battery > 50 ? 'bg-green-500' : 'bg-red-500'}`} 
                        style={{ width: `${drone.battery}%` }} 
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-gray-500 pt-1">
                      <span>Altitude: {drone.altitude}m</span>
                      <span>HD Cam</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Diagnostics block */}
          <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-sans font-semibold text-white uppercase tracking-wider">SYSTEM STATUS</span>
            </div>
            <div className="space-y-1">
              {[
                { label: 'GPS Lock', ok: true },
                { label: 'Signal Link', ok: true },
                { label: 'Gimbal Axis', ok: true },
                { label: 'IMU Calibration', ok: true },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-[11px] font-mono text-gray-500">
                  <span>{item.label}</span>
                  <span className="text-green-400 font-bold">OK</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE: Live Media Viewport */}
        <div className={`flex-1 p-4 flex-col min-w-0 ${
          activeTab === 'feed' ? 'flex h-full' : 'hidden lg:flex'
        }`}>
          {/* Header telemetry strip */}
          <div className="flex items-center justify-between mb-3 bg-[#0F1117] border border-white/[0.06] rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-xs font-mono text-red-500 font-bold uppercase tracking-widest">LIVE FEED</span>
              </div>
              {currentDrone && (
                <div className="text-xs text-gray-400 font-mono">
                  UAV-{currentDrone.id.toUpperCase()} · Lat: {currentDrone.lat.toFixed(5)}° · Lng: {currentDrone.lng.toFixed(5)}°
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsScanning(!isScanning)} 
                className={`text-xs font-mono px-2.5 py-1 rounded border transition-all ${
                  isScanning ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400' : 'border-white/[0.08] text-gray-400 hover:text-white'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${isScanning && 'animate-spin'}`} /> SCAN GRID
              </button>
              <button 
                onClick={() => setIsFullscreen(!isFullscreen)} 
                className="p-1 text-gray-400 hover:text-white border border-white/[0.08] rounded"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Viewport Frame */}
          <div className={`relative flex-1 bg-black rounded-2xl overflow-hidden border border-white/[0.08] flex items-center justify-center ${isFullscreen ? 'max-h-full' : ''}`}>
            <AnimatePresence mode="wait">
              {activeCapture ? (
                <motion.img
                  key={activeCapture.imageUrl}
                  src={activeCapture.imageUrl}
                  alt={`Drone Feed - ${activeCapture.location}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full object-cover select-none"
                />
              ) : (
                <div className="text-center text-gray-600 font-mono text-xs">
                  <Camera className="w-8 h-8 mx-auto mb-2 text-gray-700 animate-pulse" />
                  <span>NO SIGNAL DETECTED</span>
                </div>
              )}
            </AnimatePresence>

            {/* Sci-fi Hologram HUD Overlays */}
            <div className="absolute inset-0 pointer-events-none border border-white/5 flex flex-col justify-between p-4">
              {/* Top Corners HUD */}
              <div className="flex justify-between items-start font-mono text-xs text-cyan-400/80">
                <div className="space-y-1">
                  <div>SYS: AUTOPILOT ACTIVE</div>
                  <div>ALTITUDE: {activeCapture?.altitude}</div>
                  <div>ZOOM: 2.4X OPTICAL</div>
                </div>
                <div className="text-right space-y-1">
                  <div>BATTERY: {activeCapture?.battery}</div>
                  <div>GIMBAL PITCH: -45.0°</div>
                  <div>FRAME RATE: 60 FPS</div>
                </div>
              </div>

              {/* Scanning Laser Line */}
              {isScanning && (
                <motion.div 
                  animate={{ y: ['0%', '100%', '0%'] }} 
                  transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-0 right-0 h-[1.5px] bg-cyan-400/30 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                />
              )}

              {/* Target Reticle Crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none opacity-40">
                <Crosshair className="w-12 h-12 text-cyan-400" />
              </div>

              {/* Bottom Telemetry Overlay */}
              <div className="flex justify-between items-end font-mono text-xs text-cyan-400/80">
                <div>
                  <div>COORD: {activeCapture?.coordinates}</div>
                  <div>LOC: {activeCapture?.location.toUpperCase()}</div>
                </div>
                <div className="text-right">
                  <div>HEADING: {activeCapture?.telemetry.direction}</div>
                  <div>SPEED: {activeCapture?.telemetry.speed}</div>
                </div>
              </div>
            </div>

            {/* Slide Navigation Buttons */}
            {captures.length > 1 && (
              <>
                <button 
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button 
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Photo Index Indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 border border-white/10 rounded-full px-3 py-1 text-xs font-mono text-white/80 flex items-center gap-1.5">
              {captures.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIdx ? 'bg-cyan-400 scale-125' : 'bg-white/20'}`}
                />
              ))}
            </div>
          </div>

          {/* Bottom thumbnail selector / index title */}
          <div className="mt-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">{activeCapture?.location} capture</h3>
              <p className="text-xs text-gray-500 font-sans mt-0.5">Timestamp: {activeCapture?.time}</p>
            </div>
            <div className="text-xs text-gray-400 font-mono">
              IMAGE {currentIdx + 1} OF {captures.length}
            </div>
          </div>
        </div>

        {/* RIGHT: Detailed Intelligence Panel */}
        <div className={`w-full lg:w-72 border-l border-white/[0.06] p-4 flex-col space-y-4 shrink-0 bg-[#0F1117] ${
          activeTab === 'details' ? 'flex h-full overflow-y-auto' : 'hidden lg:flex'
        }`}>
          {/* Description card */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 space-y-2">
            <h2 className="text-xs font-mono font-bold tracking-wider text-gray-500 uppercase">MISSION OBJECTIVE</h2>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              {activeCapture?.description}
            </p>
          </div>

          {/* Active AI Detections */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold tracking-wider text-gray-500 uppercase">AI CAPTURE SCAN</h2>
              <span className="text-xs bg-green-500/10 text-green-400 font-mono px-1.5 py-0.5 rounded">ACTIVE</span>
            </div>
            {activeCapture && (
              <div className="space-y-2.5">
                {[
                  { label: 'Automobiles (Cars/SUVs)', count: activeCapture.telemetry.detections.cars, max: 60, color: 'bg-blue-400' },
                  { label: 'Commercial Vehicles (Trucks/Buses)', count: activeCapture.telemetry.detections.trucks, max: 20, color: 'bg-purple-400' },
                  { label: 'Two-wheelers (Bikes/Scooters)', count: activeCapture.telemetry.detections.bikes, max: 40, color: 'bg-orange-400' },
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="font-mono text-white font-bold">{item.count}</span>
                    </div>
                    <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color}`}
                        style={{ width: `${Math.min(100, (item.count / item.max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Technical flight telemetry */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3.5 space-y-2.5 flex-1">
            <h2 className="text-xs font-mono font-bold tracking-wider text-gray-500 uppercase">FLIGHT TELEMETRY</h2>
            
            {activeCapture && (
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs pt-1">
                {[
                  { label: 'Air Speed', value: activeCapture.telemetry.speed, icon: Navigation },
                  { label: 'Direction', value: activeCapture.telemetry.direction, icon: Shield },
                  { label: 'Signal Quality', value: activeCapture.telemetry.signal, icon: Radio },
                  { label: 'Diagnostics', value: activeCapture.telemetry.status, icon: Activity, valColor: activeCapture.telemetry.status === 'NOMINAL' ? 'text-green-400' : 'text-yellow-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white/[0.02] border border-white/[0.04] p-2 rounded-lg font-sans">
                    <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                    <div className={`font-mono font-bold ${stat.valColor || 'text-white'}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
