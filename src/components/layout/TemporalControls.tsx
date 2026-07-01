import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Clock, Calendar, SkipForward, SkipBack } from 'lucide-react';
import { useAppStore } from '../../hooks/useAppStore';

export default function TemporalControls() {
  const {
    uniqueTimestamps,
    selectedTime,
    setSelectedTime,
    selectedDate,
    setSelectedDate,
    isPlaybackPlaying,
    setIsPlaybackPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    playbackIndex,
    setPlaybackIndex,
  } = useAppStore();

  const [localTimeInput, setLocalTimeInput] = useState(selectedTime.substring(0, 5));

  // Sync local time input when selectedTime changes externally (e.g. during playback)
  useEffect(() => {
    setLocalTimeInput(selectedTime.substring(0, 5));
  }, [selectedTime]);

  const handleTimeChange = (timeStr: string) => {
    setLocalTimeInput(timeStr);
    if (!timeStr) return;
    
    // Ensure format is HH:mm:ss for comparison
    const targetTime = timeStr.split(':').length === 2 ? `${timeStr}:00` : timeStr;
    
    if (uniqueTimestamps.length === 0) return;

    const toSeconds = (t: string) => {
      const parts = t.split(':').map(Number);
      const h = parts[0] || 0;
      const m = parts[1] || 0;
      const s = parts[2] || 0;
      return h * 3600 + m * 60 + s;
    };

    const targetSec = toSeconds(targetTime);
    let closestIdx = 0;
    let minDiff = Infinity;

    for (let i = 0; i < uniqueTimestamps.length; i++) {
      const diff = Math.abs(toSeconds(uniqueTimestamps[i]) - targetSec);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setPlaybackIndex(closestIdx);
  };

  const handleSliderChange = (val: number) => {
    setPlaybackIndex(val);
  };

  const stepForward = () => {
    if (uniqueTimestamps.length === 0) return;
    setPlaybackIndex((prev) => (prev + 1) % uniqueTimestamps.length);
  };

  const stepBackward = () => {
    if (uniqueTimestamps.length === 0) return;
    setPlaybackIndex((prev) => (prev - 1 + uniqueTimestamps.length) % uniqueTimestamps.length);
  };

  const totalTicks = uniqueTimestamps.length;
  const currentTick = totalTicks > 0 ? (playbackIndex % totalTicks) : 0;

  const speedPresets = [1, 5, 15, 30];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0f111a]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col gap-3 w-[360px] sm:w-[640px] md:w-[760px] text-white select-none z-40 transition-all duration-300 hover:border-white/[0.15]"
    >
      {/* Top Row: Date, Clock, Playback Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        {/* Time and Playback State */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaybackPlaying(!isPlaybackPlaying)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isPlaybackPlaying
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)]'
                : 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08]'
            }`}
            title={isPlaybackPlaying ? 'Pause Simulation' : 'Play Simulation'}
          >
            {isPlaybackPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] px-3 py-1.5 rounded-xl font-mono">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-bold tracking-widest text-white">{selectedTime}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse inline-block"></span>
            {isPlaybackPlaying ? 'Active Feed' : 'Paused'}
          </div>
        </div>

        {/* Date and Time Inputs */}
        <div className="flex items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 hover:border-white/[0.15] transition-colors relative">
            <Calendar className="w-3.5 h-3.5 text-orange-400 mr-2 shrink-0 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white font-mono outline-none border-none [color-scheme:dark] w-28 text-xs shrink-0 cursor-pointer"
            />
          </div>

          {/* Time Picker */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-xs text-gray-300 hover:border-white/[0.15] transition-colors relative">
            <Clock className="w-3.5 h-3.5 text-orange-400 mr-2 shrink-0 pointer-events-none" />
            <input
              type="time"
              value={localTimeInput}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="bg-transparent text-white font-mono outline-none border-none [color-scheme:dark] w-16 text-xs shrink-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Middle Row: Timeline scrub bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={stepBackward}
          disabled={totalTicks <= 1}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Step Backward"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <div className="flex-1 relative flex items-center group py-2">
          {/* Custom Track styled slider */}
          <input
            type="range"
            min={0}
            max={totalTicks > 0 ? totalTicks - 1 : 0}
            value={currentTick}
            disabled={totalTicks <= 1}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            className="w-full h-1 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none transition-all"
            style={{
              background: `linear-gradient(to right, rgb(249, 115, 22) 0%, rgb(249, 115, 22) ${
                totalTicks > 1 ? (currentTick / (totalTicks - 1)) * 100 : 0
              }%, rgba(255, 255, 255, 0.08) ${
                totalTicks > 1 ? (currentTick / (totalTicks - 1)) * 100 : 0
              }%, rgba(255, 255, 255, 0.08) 100%)`,
            }}
          />
        </div>

        <button
          onClick={stepForward}
          disabled={totalTicks <= 1}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-40 disabled:hover:bg-transparent transition-all"
          title="Step Forward"
        >
          <SkipForward className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Row: Speed settings & Timeline Info */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="font-mono text-[11px] text-gray-500">
          Index: <span className="text-white">{currentTick + 1}</span> / {totalTicks || 1}
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Speed:</span>
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
            {speedPresets.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition-all ${
                  playbackSpeed === speed
                    ? 'bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.3)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
