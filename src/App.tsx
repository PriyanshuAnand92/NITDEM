import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import Login from './components/pages/Login';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import IntelPanel from './components/layout/IntelPanel';
import ToastStack from './components/layout/ToastStack';
import MobileDrawer from './components/layout/MobileDrawer';
import CommandMap from './components/map/CommandMap';
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
          />
        );
      case 'map':
        return (
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
          />
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
          />
        );
      case 'events':
        return <EventPlanningCenter events={store.events} onCreateEvent={store.createEvent} />;
      case 'drones':
        return <DroneOperations drones={store.drones} nodes={store.nodes} />;
      case 'history':
        return <HistoricalIntelligence tokens={store.tokens} />;
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
            className="md:hidden absolute top-3 left-2 z-30 w-9 h-9 rounded-lg bg-[#0F1117] border border-white/[0.08] flex items-center justify-center text-gray-300 hover:text-white"
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
          <main className="flex-1 overflow-hidden min-w-0">
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

          {/* Right intelligence panel — desktop only, contextual pages */}
          {showIntelPanel && (
            <div className="hidden lg:block h-full">
              <IntelPanel
                nodes={store.nodes}
                selectedNode={store.selectedNode}
                selectedLink={store.selectedLink}
                drones={store.drones}
                predictionWindow={store.predictionWindow}
                linkStatuses={store.linkStatuses}
              />
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <ToastStack
        notifications={store.notifications}
        onDismiss={store.dismissNotification}
        onViewToken={handleViewToken}
      />
    </div>
  );
}
