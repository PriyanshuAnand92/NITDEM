import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Login from './components/pages/Login';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import IntelPanel from './components/layout/IntelPanel';
import ToastStack from './components/layout/ToastStack';
import MobileDrawer from './components/layout/MobileDrawer';
import CommandMap from './components/map/CommandMap';
import IncidentAlerts from './components/map/IncidentAlerts';
import Dashboard from './components/pages/Dashboard';
import AIAnalytics from './components/pages/AIAnalytics';
import TrafficForecasting from './components/pages/TrafficForecasting';
import IncidentCenter from './components/pages/IncidentCenter';
import EventPlanningCenter from './components/pages/EventPlanningCenter';
import DroneOperations from './components/pages/DroneOperations';
import HistoricalIntelligence from './components/pages/HistoricalIntelligence';
import AlertGenerator from './components/pages/AlertGenerator';
import Reports from './components/pages/Reports';
import DroneFeed from './components/pages/DroneFeed';
import IncidentNotificationPanel from './components/layout/IncidentNotificationPanel';
import TemporalControls from './components/layout/TemporalControls';
import { useAppStore } from './hooks/useAppStore';
import type { Page } from './types';

const PAGE_TITLES: Record<Page, string> = {
  dashboard: 'Operations Dashboard',
  map: 'Command Map',
  analytics: 'AI Analytics',
  forecasting: 'Traffic Forecasting',
  incidents: 'Incident Center',
  events: 'Event Planning Center',
  drones: 'Drone Operations',
  history: 'Historical Intelligence',
  alerts: 'Alert Generator',
  reports: 'Reports',
  drone_feed: 'Drone Live Feeds',
};

export default function App() {
  const store = useAppStore();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isIntelOpen, setIsIntelOpen] = useState(false);

  // Auto-open mobile intel drawer when a selection is made
  useEffect(() => {
    if (store.selectedNode || store.selectedLink) {
      setIsIntelOpen(true);
    }
  }, [store.selectedNode, store.selectedLink]);

  if (!store.isAuthenticated) {
    return <Login onLogin={store.login} onSuccess={() => store.setIsAuthenticated(true)} />;
  }

  const handleViewToken = () => {
    store.setCurrentPage('history');
  };

  const renderPage = () => {
    switch (store.currentPage) {
      case 'dashboard':
        return (
          <Dashboard
            drones={store.drones}
            incidents={store.incidents}
            nodes={store.nodes}
            telemetryLogs={store.telemetryLogs}
            predictionLogs={store.predictionLogs}
            playbackIndex={store.playbackIndex}
            isAutoDispatch={store.isAutoDispatch}
            onDispatchDrone={store.dispatchDrone}
            isWhatIfActive={store.isWhatIfActive}
            setIsWhatIfActive={store.setIsWhatIfActive}
            whatIfLanesBlocked={store.whatIfLanesBlocked}
            setWhatIfLanesBlocked={store.setWhatIfLanesBlocked}
            whatIfEventIntensity={store.whatIfEventIntensity}
            setWhatIfEventIntensity={store.setWhatIfEventIntensity}
            whatIfRetimingSeconds={store.whatIfRetimingSeconds}
            setWhatIfRetimingSeconds={store.setWhatIfRetimingSeconds}
            isRetimingApplied={store.isRetimingApplied}
            setIsRetimingApplied={store.setIsRetimingApplied}
          />
        );
      case 'map':
        return (
          <div className="relative h-full w-full">
          <CommandMap
            nodes={store.nodes}
            selectedNode={store.selectedNode}
            onNodeSelect={store.setSelectedNode}
            selectedLink={store.selectedLink}
            onLinkSelect={store.setSelectedLink}
            drones={store.drones}
            predictionWindow={store.predictionWindow}
            onPredictionWindowChange={store.setPredictionWindow}
            onDroneClick={(droneId) => {
              store.setSelectedDroneId(droneId);
              store.setCurrentPage('drone_feed');
            }}
            currentRole={store.currentRole}
            onUpdateDroneRoute={store.updateDroneRoute}
            isDark={store.isDark}
            linkStatuses={store.linkStatuses}
            incidents={store.incidents}
            events={store.events}
          />
          <IncidentAlerts incidents={store.incidents} tokens={store.tokens} />
          </div>
        );
      case 'analytics':
        return (
          <AIAnalytics
            nodes={store.nodes}
            telemetryLogs={store.telemetryLogs}
            predictionLogs={store.predictionLogs}
            playbackIndex={store.playbackIndex}
          />
        );
      case 'forecasting':
        return <TrafficForecasting />;
      case 'incidents':
        return (
          <IncidentCenter
            incidents={store.incidents}
            onLogIncident={store.logIncident}
            currentRole={store.currentRole}
            onUpdateIncidentStatus={store.updateIncidentStatus}
            enableGcsIncidents={store.enableGcsIncidents}
            setEnableGcsIncidents={store.setEnableGcsIncidents}
            nodes={store.nodes}
            onUpdateIncident={store.updateIncident}
            onDeleteIncident={store.deleteIncident}
            isDark={store.isDark}
          />
        );
      case 'events':
        return <EventPlanningCenter events={store.events} onCreateEvent={store.createEvent} onUpdateEvent={store.updateEvent} isDark={store.isDark} />;
      case 'drones':
        return <DroneOperations drones={store.drones} nodes={store.nodes} />;
      case 'history':
        return <HistoricalIntelligence tokens={store.tokens} isDark={store.isDark} />;
      case 'alerts':
        return <AlertGenerator onCreateToken={store.createToken} />;
      case 'reports':
        return <Reports tokens={store.tokens} incidents={store.incidents} drones={store.drones} nodes={store.nodes} />;
      case 'drone_feed':
        return <DroneFeed drones={store.drones} selectedDroneId={store.selectedDroneId} onSelectDrone={store.setSelectedDroneId} />;
      default:
        return null;
    }
  };

  const showIntelPanel = store.currentPage === 'map' || store.currentPage === 'dashboard';

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${store.isDark ? '' : 'light-mode'}`}
      style={{ background: store.isDark ? '#0A0C10' : '#F5F6F8' }}>
      
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar
          currentPage={store.currentPage}
          onNavigate={store.setCurrentPage}
          onLogout={store.logout}
          isOpen={store.sidebarOpen}
          onToggle={() => store.setSidebarOpen(!store.sidebarOpen)}
          incidentCount={store.incidents.filter(i => i.status === 'active').length}
        />
      </div>

      {/* Incident Notification Panel on Left */}
      {store.isAuthenticated && (
        <IncidentNotificationPanel
          incidents={store.incidents}
          drones={store.drones}
          isAutoDispatch={store.isAutoDispatch}
          setIsAutoDispatch={store.setIsAutoDispatch}
          onDispatchDrone={store.dispatchDrone}
          currentRole={store.currentRole}
          isDark={store.isDark}
        />
      )}

      {/* Mobile drawer */}
      <MobileDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        currentPage={store.currentPage}
        onNavigate={store.setCurrentPage}
        onLogout={store.logout}
        incidentCount={store.incidents.filter(i => i.status === 'active').length}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="flex items-center">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden absolute top-3 left-2 z-[1010] w-9 h-9 rounded-lg bg-[#0F1117] border border-white/[0.08] flex items-center justify-center text-gray-300 hover:text-white"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1">
             <Header
              isDark={store.isDark}
              onToggleTheme={() => store.setIsDark(!store.isDark)}
              notifications={store.notifications}
              onNotificationClick={store.dismissNotification}
              unreadCount={store.notifications.length}
              currentRole={store.currentRole}
              onRoleChange={store.setCurrentRole}
            />
          </div>
        </div>

        {/* Body: page content + intel panel */}
        <div className="flex-1 flex overflow-hidden">
          <main className="flex-1 overflow-hidden min-w-0 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={store.currentPage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Right intelligence panel — responsive overlay drawer on mobile, static on desktop */}
          {showIntelPanel && (
            <>
              {/* Desktop view */}
              <div className="hidden lg:block h-full shrink-0">
                <IntelPanel
                  nodes={store.nodes}
                  selectedNode={store.selectedNode}
                  selectedLink={store.selectedLink}
                  drones={store.drones}
                  predictionWindow={store.predictionWindow}
                  linkStatuses={store.linkStatuses}
                  incidents={store.incidents}
                  onClearSelection={() => {
                    store.setSelectedNode(null);
                    store.setSelectedLink(null);
                  }}
                  selectedTime={store.selectedTime}
                  coordsLinkData={store.coordsLinkData}
                  gcsPredictions={store.gcsPredictions}
                  onSelectLink={store.setSelectedLink}
                  isWhatIfActive={store.isWhatIfActive}
                  setIsWhatIfActive={store.setIsWhatIfActive}
                  whatIfLanesBlocked={store.whatIfLanesBlocked}
                  setWhatIfLanesBlocked={store.setWhatIfLanesBlocked}
                  whatIfEventIntensity={store.whatIfEventIntensity}
                  setWhatIfEventIntensity={store.setWhatIfEventIntensity}
                  whatIfRetimingSeconds={store.whatIfRetimingSeconds}
                  setWhatIfRetimingSeconds={store.setWhatIfRetimingSeconds}
                  isRetimingApplied={store.isRetimingApplied}
                  setIsRetimingApplied={store.setIsRetimingApplied}
                  uniqueTimestamps={store.uniqueTimestamps}
                  onTimeChange={store.setSelectedTime}
                  playbackIndex={store.playbackIndex}
                  setPlaybackIndex={store.setPlaybackIndex}
                  isPlaybackPlaying={store.isPlaybackPlaying}
                  setIsPlaybackPlaying={store.setIsPlaybackPlaying}
                  playbackSpeed={store.playbackSpeed}
                  setPlaybackSpeed={store.setPlaybackSpeed}
                  selectedDate={store.selectedDate}
                  setSelectedDate={store.setSelectedDate}
                />
              </div>

              {/* Mobile overlay drawer */}
              <AnimatePresence>
                {isIntelOpen && (
                  <div className="lg:hidden fixed inset-0 flex flex-col justify-end" style={{ zIndex: 9995 }}>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsIntelOpen(false)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    {/* Drawer Content */}
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="relative w-full h-[65vh] max-h-[85vh] shadow-2xl flex flex-col bg-[#0A0C10] z-10 rounded-t-2xl overflow-hidden border-t border-white/[0.08]"
                    >
                      {/* Drag handle or close area */}
                      <div className="w-full flex justify-center py-2 bg-[#0F1117] border-b border-white/[0.06] cursor-pointer" onClick={() => setIsIntelOpen(false)}>
                        <div className="w-12 h-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        <IntelPanel
                          nodes={store.nodes}
                          selectedNode={store.selectedNode}
                          selectedLink={store.selectedLink}
                          drones={store.drones}
                          predictionWindow={store.predictionWindow}
                          linkStatuses={store.linkStatuses}
                          incidents={store.incidents}
                          onClearSelection={() => {
                            store.setSelectedNode(null);
                            store.setSelectedLink(null);
                          }}
                          selectedTime={store.selectedTime}
                          coordsLinkData={store.coordsLinkData}
                          gcsPredictions={store.gcsPredictions}
                          onSelectLink={store.setSelectedLink}
                          isWhatIfActive={store.isWhatIfActive}
                          setIsWhatIfActive={store.setIsWhatIfActive}
                          whatIfLanesBlocked={store.whatIfLanesBlocked}
                          setWhatIfLanesBlocked={store.setWhatIfLanesBlocked}
                          whatIfEventIntensity={store.whatIfEventIntensity}
                          setWhatIfEventIntensity={store.setWhatIfEventIntensity}
                          whatIfRetimingSeconds={store.whatIfRetimingSeconds}
                          setWhatIfRetimingSeconds={store.setWhatIfRetimingSeconds}
                          isRetimingApplied={store.isRetimingApplied}
                          setIsRetimingApplied={store.setIsRetimingApplied}
                          uniqueTimestamps={store.uniqueTimestamps}
                          onTimeChange={store.setSelectedTime}
                          playbackIndex={store.playbackIndex}
                          setPlaybackIndex={store.setPlaybackIndex}
                          isPlaybackPlaying={store.isPlaybackPlaying}
                          setIsPlaybackPlaying={store.setIsPlaybackPlaying}
                          playbackSpeed={store.playbackSpeed}
                          setPlaybackSpeed={store.setPlaybackSpeed}
                          selectedDate={store.selectedDate}
                          setSelectedDate={store.setSelectedDate}
                          onClose={() => setIsIntelOpen(false)}
                        />
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      {/* Floating toggle button for mobile/tablet controls */}
      {showIntelPanel && !isIntelOpen && (
        <button
          onClick={() => setIsIntelOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 w-12 h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-black shadow-[0_0_15px_rgba(249,115,22,0.4)] flex items-center justify-center font-bold text-sm"
          style={{ zIndex: 9990 }}
          title="Open Controls"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Toast notifications */}
      <ToastStack
        notifications={store.toasts}
        onDismiss={store.dismissToast}
        onViewToken={handleViewToken}
      />
    </div>
  );
}
