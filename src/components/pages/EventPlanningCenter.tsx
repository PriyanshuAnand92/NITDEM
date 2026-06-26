import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, MapPin, Crosshair,
  Hash, Clock, Users, CheckCircle, LayoutGrid, List, Sparkles, Edit2, Save
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths,
  isSameMonth, isSameDay, parseISO, isToday
} from 'date-fns';
import type { PlannedEvent, EventType } from '../../types';
import { priorityBadgeClass } from '../../utils';
import LocationPicker from '../map/LocationPicker';
import MiniMapPreview from '../map/MiniMapPreview';

interface EventPlanningProps {
  events: PlannedEvent[];
  onCreateEvent: (data: Omit<PlannedEvent, 'id' | 'tokenId' | 'createdAt'>) => void;
  onUpdateEvent: (id: string, updates: Partial<PlannedEvent>) => void;
  isDark: boolean;
}

const EVENT_TYPES: EventType[] = ['Football Match', 'Festival', 'Political Rally', 'Procession', 'VIP Visit', 'Road Work', 'Custom Event'];

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  'Football Match': '#22C55E',
  'Festival': '#F59E0B',
  'Political Rally': '#EF4444',
  'Procession': '#A855F7',
  'VIP Visit': '#3B82F6',
  'Road Work': '#F97316',
  'Custom Event': '#06B6D4',
};

const ZONES = ['Stadium Junction', 'Mavoor Road', 'Palayam', 'KSRTC Bus Stand', 'Mini Bypass', 'Custom Area'];

interface EventForm {
  name: string;
  type: EventType;
  startTime: string;
  endTime: string;
  expectedAttendance: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  areaMode: 'zone' | 'pin' | 'polygon';
  zoneName: string;
}

const DEFAULT_FORM: EventForm = {
  name: '',
  type: 'Football Match',
  startTime: '18:00',
  endTime: '21:00',
  expectedAttendance: '5000',
  priority: 'medium',
  description: '',
  areaMode: 'zone',
  zoneName: ZONES[0],
};

export default function EventPlanningCenter({ events, onCreateEvent, onUpdateEvent, isDark }: EventPlanningProps) {
  const [viewMode, setViewMode] = useState<'month' | 'day' | 'rankings'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Lock view to list 'day' mode on mobile screens to prevent squished calendar grid
  useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('day');
    }
  });
  const [form, setForm] = useState<EventForm>(DEFAULT_FORM);
  const [showPicker, setShowPicker] = useState(false);
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickedPolygon, setPickedPolygon] = useState<[number, number][] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<PlannedEvent | null>(null);
  const [isEditingView, setIsEditingView] = useState(false);
  const [editForm, setEditForm] = useState<EventForm>(DEFAULT_FORM);
  const [editPickedLocation, setEditPickedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [editPicker, setEditPicker] = useState(false);

  const openViewer = (ev: PlannedEvent) => {
    setViewingEvent(ev);
    setIsEditingView(false);
    setEditForm({
      name: ev.name,
      type: ev.type,
      startTime: ev.startTime,
      endTime: ev.endTime,
      expectedAttendance: String(ev.expectedAttendance),
      priority: ev.priority,
      description: ev.description,
      areaMode: ev.areaType === 'polygon' ? 'polygon' : ev.areaType === 'pin' ? 'pin' : 'zone',
      zoneName: ev.zoneName || ZONES[0],
    });
    setEditPickedLocation(ev.lat && ev.lng ? { lat: ev.lat, lng: ev.lng } : null);
  };

  const saveEventEdits = () => {
    if (!viewingEvent) return;
    const updates: Partial<PlannedEvent> = {
      name: editForm.name,
      type: editForm.type,
      startTime: editForm.startTime,
      endTime: editForm.endTime,
      expectedAttendance: parseInt(editForm.expectedAttendance) || 0,
      priority: editForm.priority,
      description: editForm.description,
      areaType: editForm.areaMode === 'polygon' ? 'polygon' : editForm.areaMode === 'pin' ? 'pin' : 'zone',
      zoneName: editForm.areaMode === 'zone' ? editForm.zoneName : undefined,
      lat: editPickedLocation?.lat ?? viewingEvent.lat,
      lng: editPickedLocation?.lng ?? viewingEvent.lng,
    };
    onUpdateEvent(viewingEvent.id, updates);
    setViewingEvent({ ...viewingEvent, ...updates } as PlannedEvent);
    setIsEditingView(false);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const eventsForDay = (day: Date) => events.filter(e => isSameDay(parseISO(e.date), day));

  const openForm = (day: Date) => {
    setSelectedDate(day);
    setForm(DEFAULT_FORM);
    setPickedLocation(null);
    setPickedPolygon(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) return;
    onCreateEvent({
      name: form.name,
      type: form.type,
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime: form.startTime,
      endTime: form.endTime,
      expectedAttendance: parseInt(form.expectedAttendance) || 0,
      priority: form.priority,
      description: form.description,
      areaType: form.areaMode === 'polygon' ? 'polygon' : form.areaMode === 'pin' ? 'pin' : 'zone',
      lat: pickedLocation?.lat,
      lng: pickedLocation?.lng,
      polygon: pickedPolygon || undefined,
      zoneName: form.areaMode === 'zone' ? form.zoneName : undefined,
    });
    setSubmitted(true);
    setTimeout(() => {
      setShowForm(false);
      setSubmitted(false);
      setForm(DEFAULT_FORM);
    }, 2200);
  };

  const dayEvents = selectedDate ? eventsForDay(selectedDate) : [];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 relative">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Event Planning Center</h1>
          <p className="text-xs text-gray-500 font-sans mt-0.5">{events.length} planned events · Schedule & coordinate operations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-[#0F1117] border border-white/[0.08] rounded-lg p-1">
            <button onClick={() => setViewMode('month')}
              className={`items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-sans uppercase transition-all hidden md:flex ${
                viewMode === 'month' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white'
              }`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Month
            </button>
            <button onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-sans uppercase transition-all ${
                viewMode === 'day' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white'
              }`}>
              <List className="w-3.5 h-3.5" /> Day
            </button>
            <button onClick={() => setViewMode('rankings')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-sans uppercase transition-all ${
                viewMode === 'rankings' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white'
              }`}>
              <Sparkles className="w-3.5 h-3.5" /> Rankings
            </button>
          </div>
        </div>
      </div>

      {/* Month navigation */}
      <div className="bg-[#0F1117] border border-white/[0.06] rounded-xl overflow-hidden">
        {viewMode === 'month' && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-bold text-white font-mono">{format(currentMonth, 'MMMM yyyy')}</span>
            </div>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {viewMode === 'month' ? (
          <div>
            {/* Weekday header */}
            <div className="grid grid-cols-7 border-b border-white/[0.04]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center py-2 text-xs font-sans font-semibold text-gray-400 tracking-wider uppercase">{d}</div>
              ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const dayEvts = eventsForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                return (
                  <motion.button
                    key={i}
                    onClick={() => openForm(day)}
                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                    className={`min-h-20 border-b border-r border-white/[0.03] p-1.5 text-left transition-colors relative ${
                      !inMonth ? 'opacity-30' : ''
                    } ${i % 7 === 6 ? 'border-r-0' : ''}`}
                  >
                    <div className={`text-xs font-mono mb-1 inline-flex items-center justify-center w-5 h-5 rounded-full ${
                      isToday(day) ? 'bg-orange-500 text-white font-bold' : 'text-gray-400'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvts.slice(0, 2).map(ev => (
                        <div key={ev.id} className="text-[10px] font-mono px-1 py-0.5 rounded truncate"
                          style={{ background: `${EVENT_TYPE_COLORS[ev.type]}20`, color: EVENT_TYPE_COLORS[ev.type] }}>
                          {ev.name}
                        </div>
                      ))}
                      {dayEvts.length > 2 && (
                        <div className="text-[10px] font-mono text-gray-500">+{dayEvts.length - 2} more</div>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ) : viewMode === 'day' ? (
          // Day view — list of upcoming events
          <div className="p-4 space-y-2">
            {events.length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No events scheduled. Click a date in Month view to add one.</p>
              </div>
            ) : [...events].sort((a, b) => a.date.localeCompare(b.date)).map((ev, i) => (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => openViewer(ev)}
                className="flex items-start gap-3 bg-white/[0.03] rounded-lg p-3 border border-white/[0.05] cursor-pointer hover:border-orange-500/40 transition-all">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: EVENT_TYPE_COLORS[ev.type] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-semibold text-white">{ev.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${EVENT_TYPE_COLORS[ev.type]}20`, color: EVENT_TYPE_COLORS[ev.type] }}>
                      {ev.type}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${priorityBadgeClass(ev.priority)}`}>
                      {ev.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" />{format(parseISO(ev.date), 'dd MMM yyyy')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ev.startTime} – {ev.endTime}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ev.expectedAttendance.toLocaleString()}</span>
                    {ev.zoneName && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{ev.zoneName}</span>}
                    {ev.lat && ev.lng && (
                      <span className="text-cyan-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        {ev.lat.toFixed(4)}°N, {ev.lng.toFixed(4)}°E
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-orange-400"><Hash className="w-3.5 h-3.5" />{ev.tokenId}</span>
                  </div>
                  {ev.description && <p className="text-xs text-gray-400 mt-1 leading-relaxed">{ev.description}</p>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          // Rankings view
          <div className="p-4 space-y-3">
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No events scheduled. Click a date in Month view to schedule an event and generate ranks.</p>
              </div>
            ) : (() => {
              const rankedEvents = [...events].map(ev => {
                const baseScore = ev.expectedAttendance / 120;
                
                let priorityBonus = 5;
                if (ev.priority === 'critical') priorityBonus = 45;
                else if (ev.priority === 'high') priorityBonus = 30;
                else if (ev.priority === 'medium') priorityBonus = 15;
                
                let typeBonus = 5;
                if (ev.type === 'Political Rally') typeBonus = 30;
                else if (ev.type === 'VIP Visit') typeBonus = 30;
                else if (ev.type === 'Procession') typeBonus = 20;
                else if (ev.type === 'Road Work') typeBonus = 20;
                else if (ev.type === 'Festival') typeBonus = 15;
                else if (ev.type === 'Football Match') typeBonus = 10;
                
                const odi = parseFloat((baseScore + priorityBonus + typeBonus).toFixed(1));
                
                let warning = "Standard passive monitoring recommended.";
                if (odi > 80) {
                  warning = "🚨 CRITICAL DISRUPTION THREAT: Requires full deployment of traffic blockades, active drone corridor, and emergency services standby.";
                } else if (odi > 50) {
                  warning = "⚠️ HIGH DISRUPTION THREAT: Requires drone monitoring at peaks, traffic officer manual override, and parking restrictions.";
                } else if (odi > 30) {
                  warning = "⚡ MODERATE DISRUPTION THREAT: Requires routine patrol scheduling and traffic signals fine-tuning.";
                }
                
                let suggestion = "";
                if (ev.type === 'Road Work') {
                  suggestion = "Traffic diversion route mapping via Mini Bypass required.";
                } else if (ev.type === 'Political Rally' || ev.type === 'VIP Visit') {
                  suggestion = "Active secure transit lane monitoring. Zero parking zoning within 500m.";
                } else if (ev.type === 'Festival' || ev.type === 'Football Match') {
                  suggestion = "Spectator surge routing on Mavoor Road approach. High pedestrian densities expected.";
                }

                return { ...ev, odi, warning, suggestion };
              }).sort((a, b) => b.odi - a.odi);

              return rankedEvents.map((ev, index) => {
                const rankColor = index === 0 ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
                                  index === 1 ? 'text-gray-300 border-gray-400/30 bg-gray-400/10' :
                                  index === 2 ? 'text-amber-600 border-amber-600/30 bg-amber-600/10' :
                                  'text-gray-500 border-white/[0.06] bg-white/[0.02]';
                
                const rankLabel = `#${index + 1}`;
                
                return (
                  <motion.div key={ev.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                    onClick={() => openViewer(ev)}
                    className="bg-[#0F1117] border border-white/[0.06] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:border-orange-500/40 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-base shrink-0 border ${rankColor}`}>
                        {rankLabel}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{ev.name}</span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${EVENT_TYPE_COLORS[ev.type]}20`, color: EVENT_TYPE_COLORS[ev.type] }}>
                            {ev.type}
                          </span>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${priorityBadgeClass(ev.priority)}`}>
                            {ev.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono text-gray-500 flex-wrap">
                          <span className="flex items-center gap-1"><CalendarIcon className="w-3.5 h-3.5" />{format(parseISO(ev.date), 'dd MMM yyyy')}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{ev.startTime} – {ev.endTime}</span>
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{ev.expectedAttendance.toLocaleString()}</span>
                          {ev.zoneName && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{ev.zoneName}</span>}
                          {ev.lat && ev.lng && (
                            <span className="text-cyan-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-cyan-400" />
                              {ev.lat.toFixed(4)}°N, {ev.lng.toFixed(4)}°E
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-sans text-gray-400 bg-white/[0.02] border border-white/[0.04] rounded p-2.5 mt-2 space-y-1">
                          <div className={ev.odi > 50 ? 'text-orange-400 font-bold' : 'text-gray-300'}>{ev.warning}</div>
                          {ev.suggestion && <div className="text-cyan-400 text-xs">💡 Strategy: {ev.suggestion}</div>}
                        </div>
                      </div>
                    </div>
                    
                    {/* Disruption index gauge */}
                    <div className="flex flex-col items-end shrink-0 min-w-[120px]">
                      <span className="text-xs font-sans text-gray-500 tracking-wider uppercase mb-1">DISRUPTION INDEX</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-white font-mono">{ev.odi}</span>
                        <span className="text-xs text-gray-500 font-mono">/ 100+</span>
                      </div>
                      <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden mt-1.5">
                        <div className={`h-full ${
                          ev.odi > 80 ? 'bg-red-500' :
                          ev.odi > 50 ? 'bg-orange-500' :
                          ev.odi > 30 ? 'bg-yellow-500' : 'bg-green-500'
                        }`} style={{ width: `${Math.min(100, ev.odi)}%` }} />
                      </div>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Event creation modal */}
      <AnimatePresence>
        {showForm && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border border-white/[0.08] overflow-hidden max-h-[90vh] overflow-y-auto bg-[#0F1117]"
            >
              <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent sticky top-0" />
              <div className="p-6">
                {submitted ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center py-8">
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: 2, duration: 0.4 }}>
                      <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    </motion.div>
                    <div className="text-green-400 font-mono font-bold text-lg mb-1">Event Scheduled</div>
                    <div className="text-white font-semibold mb-1">{form.name}</div>
                    <div className="text-gray-400 text-sm">{format(selectedDate, 'dd MMM yyyy')} · {form.startTime}–{form.endTime}</div>
                    <div className="text-orange-400 font-mono text-sm mt-2">Event Token Generated ✓</div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-base font-bold text-white">New Event</div>
                        <div className="text-xs text-gray-500 font-sans mt-0.5">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</div>
                      </div>
                      <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Event Name</label>
                      <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. EMS Stadium Football Final"
                        required
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all" />
                    </div>

                    <div>
                      <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Event Type</label>
                      <div className="grid grid-cols-2 gap-2">
                        {EVENT_TYPES.map(type => (
                          <button key={type} type="button" onClick={() => setForm(p => ({ ...p, type }))}
                            className={`px-2 py-2 rounded-lg text-xs font-sans border transition-all text-left ${
                              form.type === type ? 'text-white' : 'border-white/[0.06] text-gray-500 hover:border-white/[0.12]'
                            }`}
                            style={form.type === type ? { background: `${EVENT_TYPE_COLORS[type]}20`, borderColor: `${EVENT_TYPE_COLORS[type]}50` } : {}}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Start Time</label>
                        <input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">End Time</label>
                        <input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Expected Attendance</label>
                        <input type="number" value={form.expectedAttendance} onChange={e => setForm(p => ({ ...p, expectedAttendance: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Priority</label>
                        <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as any }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all">
                          {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p} className="bg-[#151820]">{p}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Description</label>
                      <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        rows={2} placeholder="Additional details..."
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-sans focus:outline-none focus:border-orange-500/50 transition-all resize-none" />
                    </div>

                    {/* Area selection */}
                    <div>
                      <label className="block text-[11px] font-sans font-semibold tracking-wider text-gray-400 mb-1.5 uppercase">Area Selection</label>
                      <div className="flex gap-2 mb-2">
                        {(['zone', 'pin', 'polygon'] as const).map(mode => (
                          <button key={mode} type="button" onClick={() => setForm(p => ({ ...p, areaMode: mode }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-sans uppercase transition-all ${
                              form.areaMode === mode ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'border border-white/[0.08] text-gray-500'
                            }`}>
                            {mode === 'zone' ? 'Select Zone' : mode === 'pin' ? 'Drop Pin' : 'Draw Area'}
                          </button>
                        ))}
                      </div>

                      {form.areaMode === 'zone' && (
                        <select value={form.zoneName} onChange={e => setForm(p => ({ ...p, zoneName: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 transition-all">
                          {ZONES.map(z => <option key={z} value={z} className="bg-[#151820]">{z}</option>)}
                        </select>
                      )}

                      {(form.areaMode === 'pin' || form.areaMode === 'polygon') && (
                        <>
                          <button type="button" onClick={() => setShowPicker(true)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-orange-500/30 text-orange-400 text-xs font-sans hover:bg-orange-500/10 transition-all">
                            <Crosshair className="w-3.5 h-3.5" />
                            {form.areaMode === 'pin' ? 'Drop Pin on Map' : 'Draw Area on Map'}
                          </button>
                          {pickedLocation && form.areaMode === 'pin' && (
                            <div className="mt-2 text-xs font-mono text-cyan-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {pickedLocation.lat.toFixed(5)}°N, {pickedLocation.lng.toFixed(5)}°E
                            </div>
                          )}
                          {pickedPolygon && form.areaMode === 'polygon' && (
                            <div className="mt-2 text-xs font-mono text-cyan-400">
                              Zone defined with {pickedPolygon.length} points
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      className="w-full py-3 rounded-lg font-mono text-sm font-bold tracking-wider"
                      style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white' }}>
                      Save Event & Generate Token
                    </motion.button>
                  </form>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Map location picker for events */}
      <AnimatePresence>
        {showPicker && (
          <LocationPicker
            onClose={() => setShowPicker(false)}
            mode={form.areaMode === 'polygon' ? 'zone' : 'pin'}
            onConfirm={(data) => setPickedLocation({ lat: data.lat, lng: data.lng })}
            onConfirmZone={(polygon) => setPickedPolygon(polygon)}
          />
        )}
      </AnimatePresence>

      {/* Floating add button */}
      <motion.button
        onClick={() => openForm(new Date())}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full font-mono text-sm font-bold shadow-lg"
        style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white' }}
      >
        <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Event</span>
      </motion.button>

      {/* Edit-location picker */}
      <AnimatePresence>
        {editPicker && (
          <LocationPicker
            initialLat={editPickedLocation?.lat ?? viewingEvent?.lat}
            initialLng={editPickedLocation?.lng ?? viewingEvent?.lng}
            onClose={() => setEditPicker(false)}
            onConfirm={(data) => setEditPickedLocation({ lat: data.lat, lng: data.lng })}
          />
        )}
      </AnimatePresence>

      {/* View / Edit event modal */}
      <AnimatePresence>
        {viewingEvent && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
            onClick={e => { if (e.target === e.currentTarget) setViewingEvent(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-lg rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0F1117] max-h-[92vh] overflow-y-auto"
            >
              <div className="h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-bold text-white">{isEditingView ? 'Edit Event' : 'Event Details'}</div>
                    <div className="text-[10px] text-gray-500 font-mono">Token {viewingEvent.tokenId} · {format(parseISO(viewingEvent.date), 'dd MMM yyyy')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditingView && (
                      <button onClick={() => setIsEditingView(true)} className="text-orange-400 hover:text-orange-300 text-[10px] font-mono flex items-center gap-1 border border-orange-500/30 rounded px-2 py-1">
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                    )}
                    <button onClick={() => setViewingEvent(null)} className="text-gray-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Map preview */}
                {(editPickedLocation?.lat || viewingEvent.lat) && (editPickedLocation?.lng || viewingEvent.lng) ? (
                  <MiniMapPreview
                    lat={editPickedLocation?.lat ?? viewingEvent.lat!}
                    lng={editPickedLocation?.lng ?? viewingEvent.lng!}
                    label={viewingEvent.zoneName || viewingEvent.name}
                    color={EVENT_TYPE_COLORS[viewingEvent.type]}
                    polygon={viewingEvent.polygon}
                    isDark={isDark}
                  />
                ) : viewingEvent.polygon && viewingEvent.polygon.length >= 3 ? (
                  <MiniMapPreview
                    lat={viewingEvent.polygon[0][0]}
                    lng={viewingEvent.polygon[0][1]}
                    label={viewingEvent.zoneName || viewingEvent.name}
                    color={EVENT_TYPE_COLORS[viewingEvent.type]}
                    polygon={viewingEvent.polygon}
                    isDark={isDark}
                  />
                ) : (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[11px] text-gray-500 font-mono">
                    No precise location · Zone: {viewingEvent.zoneName || 'Unspecified'}
                  </div>
                )}

                {!isEditingView ? (
                  <div className="space-y-2 text-[11px] font-mono">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{viewingEvent.name}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded" style={{ background: `${EVENT_TYPE_COLORS[viewingEvent.type]}20`, color: EVENT_TYPE_COLORS[viewingEvent.type] }}>
                        {viewingEvent.type}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border ${priorityBadgeClass(viewingEvent.priority)}`}>{viewingEvent.priority.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500 flex-wrap">
                      <span><Clock className="w-3 h-3 inline" /> {viewingEvent.startTime} – {viewingEvent.endTime}</span>
                      <span><Users className="w-3 h-3 inline" /> {viewingEvent.expectedAttendance.toLocaleString()}</span>
                      {viewingEvent.zoneName && <span><MapPin className="w-3 h-3 inline" /> {viewingEvent.zoneName}</span>}
                    </div>
                    {viewingEvent.description && <p className="text-gray-300">{viewingEvent.description}</p>}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Name</label>
                      <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Type</label>
                      <select value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value as EventType }))}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50">
                        {EVENT_TYPES.map(t => <option key={t} value={t} className="bg-[#151820]">{t}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Start</label>
                        <input type="time" value={editForm.startTime} onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">End</label>
                        <input type="time" value={editForm.endTime} onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Attendance</label>
                        <input type="number" value={editForm.expectedAttendance} onChange={e => setEditForm(p => ({ ...p, expectedAttendance: e.target.value }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Priority</label>
                        <select value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value as any }))}
                          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50">
                          {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p} className="bg-[#151820]">{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-gray-500 tracking-widest mb-1.5 uppercase">Description</label>
                      <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                        rows={2}
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50 resize-none" />
                    </div>
                    <button type="button" onClick={() => setEditPicker(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-orange-500/30 text-orange-400 text-xs font-mono hover:bg-orange-500/10">
                      <Crosshair className="w-3.5 h-3.5" /> Change Location on Map
                    </button>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setIsEditingView(false)}
                        className="flex-1 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-300 text-xs font-mono uppercase hover:bg-white/[0.08]">
                        Cancel
                      </button>
                      <button type="button" onClick={saveEventEdits}
                        className="flex-1 py-2 rounded-lg text-xs font-mono uppercase font-bold flex items-center justify-center gap-1.5"
                        style={{ background: 'linear-gradient(135deg, #F97316, #EA580C)', color: 'white' }}>
                        <Save className="w-3.5 h-3.5" /> Save Changes
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
