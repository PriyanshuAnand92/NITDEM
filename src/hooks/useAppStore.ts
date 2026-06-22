import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Page, TrafficNode, Drone, Incident, Token, Notification, PlannedEvent, DroneAnomaly, SimulationResult, SimulationAction, PredictionWindow, UserRole } from '../types';
import { TRAFFIC_NODES, INITIAL_DRONES, SAMPLE_TOKENS, DRONE_ANOMALIES, runSimulation } from '../data/constants';
import { parseTelemetryCSV, parseDensityCSV, parseXLSXData, parsePredictionsCSV, parseLink1CSV, CSVTelemetry, CSVDensityFrame, GCSLinkData, GCSPredictionData } from '../utils/csvParser';

const junctionMap: Record<string, string> = {
  'Mavoor Road Junction': 'mavoor',
  'Bus Stand Junction': 'bus_stand',
  'Arayidathupalam Junction': 'arayidathupalam',
  'Mananchira Junction': 'mananchira',
  'Stadium Junction': 'stadium',
  'Poonthanam Junction': 'poonthanam',
  'Palayam Junction': 'palayam',
  'Midtown Junction': 'midtown',
  'East Bypass Junction': 'east_bypass',
};

const linkToRoadMap: Record<string, { roadName: string; lat: number; lng: number; junction: string }> = {
  L1: { roadName: 'Mini Bypass Road (North)', lat: 11.2569, lng: 75.7919, junction: 'Arayidathupalam Junction' },
  L18: { roadName: 'Mini Bypass Road (North)', lat: 11.2569, lng: 75.7919, junction: 'Arayidathupalam Junction' },
  L2: { roadName: 'Mini Bypass Road (South)', lat: 11.2539, lng: 75.79255, junction: 'Midtown Junction' },
  L24: { roadName: 'Mini Bypass Road (South)', lat: 11.2539, lng: 75.79255, junction: 'Midtown Junction' },
  L3: { roadName: 'Puthiyara Road', lat: 11.25525, lng: 75.7890, junction: 'Stadium Junction' },
  L16: { roadName: 'Puthiyara Road', lat: 11.25525, lng: 75.7890, junction: 'Stadium Junction' },
  L4: { roadName: 'Rammohan Road', lat: 11.25335, lng: 75.78685, junction: 'Stadium Junction' },
  L10: { roadName: 'Rammohan Road', lat: 11.25335, lng: 75.78685, junction: 'Stadium Junction' },
  L5: { roadName: 'Pavamani Road', lat: 11.25477, lng: 75.78389, junction: 'Stadium Junction' },
  L15: { roadName: 'Pavamani Road', lat: 11.25477, lng: 75.78389, junction: 'Stadium Junction' },
  L6: { roadName: 'Rajaji Road', lat: 11.25725, lng: 75.7857, junction: 'Bus Stand Junction' },
  L17: { roadName: 'Rajaji Road', lat: 11.25725, lng: 75.7857, junction: 'Bus Stand Junction' },
  L7: { roadName: 'Poonthanam Link Road', lat: 11.2520, lng: 75.7904, junction: 'East Bypass Junction' },
  L20: { roadName: 'Poonthanam Link Road', lat: 11.2520, lng: 75.7904, junction: 'East Bypass Junction' },
  L8: { roadName: 'Bank Road', lat: 11.25157, lng: 75.78279, junction: 'Palayam Junction' },
  L22: { roadName: 'Bank Road', lat: 11.25157, lng: 75.78279, junction: 'Palayam Junction' },
  L9: { roadName: 'M.M Ali Road', lat: 11.25015, lng: 75.78575, junction: 'Poonthanam Junction' },
  L21: { roadName: 'M.M Ali Road', lat: 11.25015, lng: 75.78575, junction: 'Poonthanam Junction' },
  L11: { roadName: 'Mavoor Road (Outer)', lat: 11.25895, lng: 75.78285, junction: 'Mavoor Road Junction' },
  L23: { roadName: 'Mavoor Road (Outer)', lat: 11.25895, lng: 75.78285, junction: 'Mavoor Road Junction' },
  L12: { roadName: 'Mavoor Road (Outer)', lat: 11.25895, lng: 75.78285, junction: 'Mavoor Road Junction' },
  L25: { roadName: 'Mavoor Road (Outer)', lat: 11.25895, lng: 75.78285, junction: 'Mavoor Road Junction' },
  L13: { roadName: 'Mavoor Road (Middle)', lat: 11.2589, lng: 75.7886, junction: 'Bus Stand Junction' },
  L19: { roadName: 'Mavoor Road (Middle)', lat: 11.2589, lng: 75.7886, junction: 'Bus Stand Junction' },
  L14: { roadName: 'Mavoor Road (Inner)', lat: 11.25647, lng: 75.78103, junction: 'Mavoor Road Junction' },
  L26: { roadName: 'Mavoor Road (Inner)', lat: 11.25647, lng: 75.78103, junction: 'Mavoor Road Junction' },
};

const zoneCoordinates: Record<string, { lat: number; lng: number }> = {
  'Stadium Junction': { lat: 11.255700, lng: 75.785660 },
  'Mavoor Road': { lat: 11.258694, lng: 75.780394 },
  'Palayam': { lat: 11.249420, lng: 75.784980 },
  'KSRTC Bus Stand': { lat: 11.260410, lng: 75.785680 },
  'Mini Bypass': { lat: 11.259720, lng: 75.792480 },
  'Custom Area': { lat: 11.2588, lng: 75.7873 },
};

const STORAGE_KEY = 'nitdem_tokens';
const INCIDENTS_KEY = 'nitdem_incidents';
const EVENTS_KEY = 'nitdem_events';
const ANOMALIES_KEY = 'nitdem_anomalies';
const SIMULATIONS_KEY = 'nitdem_simulations';

function generateTokenId(): string {
  const num = Math.floor(Math.random() * 9000) + 1000;
  return `TK-${num}`;
}

export function useAppStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('map');
  const [selectedNode, setSelectedNode] = useState<TrafficNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<string | null>(null);
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>('alpha');
  const [currentRole, setCurrentRole] = useState<UserRole>('supervisor');

  const selectNode = useCallback((node: TrafficNode | null) => {
    setSelectedNode(node);
    if (node) setSelectedLink(null);
  }, []);

  const selectLink = useCallback((linkId: string | null) => {
    setSelectedLink(linkId);
    if (linkId) setSelectedNode(null);
  }, []);
  const [isDark, setIsDark] = useState(true);
  const [nodes, setNodes] = useState<TrafficNode[]>(TRAFFIC_NODES);
  const [telemetryLogs, setTelemetryLogs] = useState<CSVTelemetry[]>([]);
  const [videoFrames, setVideoFrames] = useState<CSVDensityFrame[]>([]);
  const [predictionLogs, setPredictionLogs] = useState<CSVTelemetry[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isAutoDispatch, setIsAutoDispatch] = useState(true);
  const [enableGcsIncidents, setEnableGcsIncidents] = useState(false);

  const [drones, setDrones] = useState<Drone[]>(INITIAL_DRONES);
  const [tokens, setTokens] = useState<Token[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : SAMPLE_TOKENS;
    } catch { return SAMPLE_TOKENS; }
  });
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const stored = localStorage.getItem(INCIDENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [events, setEvents] = useState<PlannedEvent[]>(() => {
    try {
      const stored = localStorage.getItem(EVENTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [anomalies, setAnomalies] = useState<DroneAnomaly[]>(() => {
    try {
      const stored = localStorage.getItem(ANOMALIES_KEY);
      return stored ? JSON.parse(stored) : DRONE_ANOMALIES;
    } catch { return DRONE_ANOMALIES; }
  });
  const [simulations, setSimulations] = useState<SimulationResult[]>(() => {
    try {
      const stored = localStorage.getItem(SIMULATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [predictionWindow, setPredictionWindow] = useState<PredictionWindow>('current');
  const [linkStatuses, setLinkStatuses] = useState<Record<string, {
    status: 'free' | 'moderate' | 'heavy' | 'critical';
    density: number;
    speed: number;
    volume: number;
    travelTime: number;
    queueLength?: number;
  }>>({});

  // GCS Live Configuration
  const USE_LIVE_GCS = true; // Set to false to use local public folder CSVs
  const GCS_INPUT_URL = 'https://storage.googleapis.com/input_parametrs';
  const GCS_OUTPUT_URL = 'https://storage.googleapis.com/output_measures';

  const [gcsLinkData, setGcsLinkData] = useState<GCSLinkData[]>([]);
  const [gcsPredictions, setGcsPredictions] = useState<GCSPredictionData[]>([]);

  // Unique ticks computed dynamically from the link data
  const gcsTicks = useMemo(() => {
    const ticks: { scenarioCode: string; timeS: string }[] = [];
    const seen = new Set<string>();
    for (const item of gcsLinkData) {
      const key = `${item.scenarioCode}|${item.timeS}`;
      if (!seen.has(key)) {
        seen.add(key);
        ticks.push({ scenarioCode: item.scenarioCode, timeS: item.timeS });
      }
    }
    return ticks;
  }, [gcsLinkData]);

  // Load CSV/Excel data and poll for changes
  useEffect(() => {
    const fetchGCSData = () => {
      const xlsxUrl = `${GCS_INPUT_URL}/link1.xlsx`;
      const localCsvUrl = '/link1.csv';
      const predictionsUrl = USE_LIVE_GCS 
        ? `${GCS_OUTPUT_URL}/traffic_management_results.csv` 
        : '/traffic_management_results.csv';

      // Load Link Data (Excel from GCS, or fallback CSV locally)
      if (USE_LIVE_GCS) {
        fetch(xlsxUrl)
          .then(r => {
            if (!r.ok) throw new Error(`Status ${r.status}`);
            return r.arrayBuffer();
          })
          .then(buffer => {
            const parsed = parseXLSXData(buffer);
            setGcsLinkData(parsed);
          })
          .catch(err => {
            console.error("Error loading GCS link1.xlsx, falling back to local link1.csv", err);
            // Fallback to local CSV if GCS fails
            fetch(localCsvUrl)
              .then(r => r.text())
              .then(text => setGcsLinkData(parseLink1CSV(text)))
              .catch(err2 => console.error("Error loading local link1.csv", err2));
          });
      } else {
        fetch(localCsvUrl)
          .then(r => r.text())
          .then(text => setGcsLinkData(parseLink1CSV(text)))
          .catch(err => console.error("Error loading local link1.csv", err));
      }

      // Load Prediction Data
      fetch(predictionsUrl)
        .then(r => {
          if (!r.ok) throw new Error(`Status ${r.status}`);
          return r.text();
        })
        .then(text => {
          setGcsPredictions(parsePredictionsCSV(text));
        })
        .catch(err => console.error("Error loading predictions CSV", err));
    };

    fetchGCSData();
    
    // Set up polling interval: 5 seconds for live GCS updates
    const pollInterval = setInterval(fetchGCSData, USE_LIVE_GCS ? 5000 : 300000);
    return () => clearInterval(pollInterval);
  }, [USE_LIVE_GCS]);

  // Playback timer for GCS ticks
  useEffect(() => {
    if (!isAuthenticated || gcsTicks.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => (prev + 1) % gcsTicks.length);
    }, 3000); // 3 seconds per time step transition
    return () => clearInterval(interval);
  }, [isAuthenticated, gcsTicks.length]);

  // Populate telemetryLogs and predictionLogs for charts
  useEffect(() => {
    if (gcsLinkData.length === 0 || gcsTicks.length === 0) return;
    
    const activeTick = gcsTicks[playbackIndex];
    if (!activeTick) return;

    // Filter GCS link data for the active scenario up to the current tick
    const scenarioTicks = gcsTicks.filter(t => t.scenarioCode === activeTick.scenarioCode);
    const currentScenarioIndex = scenarioTicks.findIndex(t => t.timeS === activeTick.timeS);
    
    const logs: CSVTelemetry[] = [];
    const predLogs: CSVTelemetry[] = [];

    for (let i = 0; i <= currentScenarioIndex; i++) {
      const tick = scenarioTicks[i];
      const tickLinks = gcsLinkData.filter(l => l.scenarioCode === tick.scenarioCode && l.timeS === tick.timeS);
      const avgOccupancy = tickLinks.reduce((sum, r) => sum + r.occupancy, 0) / (tickLinks.length || 1);
      
      const predictionsForTick = gcsPredictions.filter(p => 
        p.link === tickLinks[0]?.linkId
      );
      const avgPredQueue = predictionsForTick.reduce((sum, p) => sum + p.queuePred, 0) / (predictionsForTick.length || 1);

      logs.push({
        timestamp: `${tick.scenarioCode} ${tick.timeS}`,
        densityPercent: avgOccupancy * 100,
        latitude: 11.2588,
        longitude: 75.7804
      });

      predLogs.push({
        timestamp: `${tick.scenarioCode} ${tick.timeS}`,
        densityPercent: Math.min(100, Math.max(5, avgPredQueue * 100)),
        latitude: 11.2588,
        longitude: 75.7804
      });
    }

    setTelemetryLogs(logs);
    setPredictionLogs(predLogs);
  }, [playbackIndex, gcsLinkData, gcsPredictions, gcsTicks]);

  // Update nodes dynamically based on active CSV/XLSX link row
  useEffect(() => {
    if (gcsLinkData.length === 0 || gcsTicks.length === 0) return;
    const activeTick = gcsTicks[playbackIndex];
    if (!activeTick) return;

    const activeLinks = gcsLinkData.filter(
      l => l.scenarioCode === activeTick.scenarioCode && l.timeS === activeTick.timeS
    );

    // Auto-detect incidents from link1 eventActive / lanesBlocked
    const newIncidentsFromGCS: Incident[] = [];
    activeLinks.forEach(link => {
      if (link.eventActive || link.lanesBlocked > 0) {
        const roadMeta = linkToRoadMap[link.linkId];
        if (roadMeta) {
          const priority: 'medium' | 'high' | 'critical' = 
            link.lanesBlocked >= 2 ? 'critical' : 
            link.lanesBlocked === 1 ? 'high' : 'medium';
          
          newIncidentsFromGCS.push({
            id: `gcs-${link.linkId}-${link.scenarioCode}`,
            type: link.lanesBlocked > 0 ? 'Lanes Blocked' : 'Road Obstruction',
            location: roadMeta.roadName,
            priority,
            description: `Automated detection: ${link.lanesBlocked} lanes blocked. Event intensity: ${link.eventIntensity}, exposure: ${link.eventExposure}.`,
            status: 'active',
            timestamp: new Date().toISOString(),
            tokenId: `TK-GCS-${link.linkId}-${link.scenarioCode}`,
            lat: roadMeta.lat,
            lng: roadMeta.lng,
            nearestJunction: roadMeta.junction,
            affectedRoads: [roadMeta.roadName],
          });
        }
      }
    });

    setIncidents(prev => {
      const manualIncidents = prev.filter(i => !i.id.startsWith('gcs-'));
      if (enableGcsIncidents) {
        return [...newIncidentsFromGCS, ...manualIncidents];
      }
      return manualIncidents;
    });

    const nodeLinkConnections: Record<string, string[]> = {
      mavoor: ['L11', 'L23', 'L12', 'L25', 'L14', 'L26'],
      bus_stand: ['L11', 'L23', 'L13', 'L19', 'L6', 'L17'],
      arayidathupalam: ['L13', 'L19', 'L1', 'L18'],
      mananchira: ['L14', 'L26', 'L8', 'L22', 'L5', 'L15'],
      stadium: ['L6', 'L17', 'L3', 'L16', 'L4', 'L10', 'L5', 'L15'],
      midtown: ['L1', 'L18', 'L3', 'L16', 'L2', 'L24'],
      palayam: ['L8', 'L22', 'L9', 'L21'],
      poonthanam: ['L9', 'L21', 'L4', 'L10', 'L7', 'L20'],
      east_bypass: ['L2', 'L24', 'L7', 'L20'],
    };

    const connectionToLinks: Record<string, [string, string]> = {
      'mavoor-bus_stand': ['L23', 'L11'],
      'bus_stand-arayidathupalam': ['L19', 'L13'],
      'arayidathupalam-midtown': ['L1', 'L18'],
      'midtown-east_bypass': ['L2', 'L24'],
      'east_bypass-poonthanam': ['L20', 'L7'],
      'poonthanam-palayam': ['L21', 'L9'],
      'palayam-mananchira': ['L22', 'L8'],
      'mavoor-mananchira': ['L26', 'L14'],
      'bus_stand-stadium': ['L6', 'L17'],
      'stadium-midtown': ['L3', 'L16'],
      'stadium-poonthanam': ['L4', 'L10'],
      'stadium-mananchira': ['L5', 'L15'],
    };

    const newStatuses: Record<string, {
      status: 'free' | 'moderate' | 'heavy' | 'critical';
      density: number;
      speed: number;
      volume: number;
      travelTime: number;
      queueLength?: number;
    }> = {};

    Object.entries(connectionToLinks).forEach(([key, [lOut, lIn]]) => {
      const records = activeLinks.filter(l => l.linkId === lOut || l.linkId === lIn);
      const isPrediction = predictionWindow !== 'current';

      if (isPrediction) {
        const predRecords = gcsPredictions.filter(p => p.link === lOut || p.link === lIn);
        if (predRecords.length > 0) {
          const maxHorizon = Math.max(...predRecords.map(p => p.predictionHorizonSec));
          const targetRecords = predRecords.filter(p => p.predictionHorizonSec === maxHorizon);
          
          const avgQueuePred = targetRecords.reduce((sum, p) => sum + p.queuePred, 0) / targetRecords.length;
          const avgDelayPred = targetRecords.reduce((sum, p) => sum + p.delayPred, 0) / targetRecords.length;
          
          const severityLevels = targetRecords.map(p => p.severityLevel);
          let severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';
          if (severityLevels.includes('CRITICAL')) severity = 'CRITICAL';
          else if (severityLevels.includes('HIGH')) severity = 'HIGH';
          else if (severityLevels.includes('MODERATE')) severity = 'MODERATE';
          
          const statusMap: Record<typeof severity, 'free' | 'moderate' | 'heavy' | 'critical'> = {
            LOW: 'free',
            MODERATE: 'moderate',
            HIGH: 'heavy',
            CRITICAL: 'critical',
          };
          
          const status = statusMap[severity];
          const density = Math.min(100, Math.max(5, Math.round(avgQueuePred * 100)));
          const speed = Math.max(10, Math.round(50 - (density * 0.4)));
          const volume = Math.round(density * 12);
          const travelTime = parseFloat((0.8 * 60 / speed + avgDelayPred / 60).toFixed(1));

          newStatuses[key] = { status, density, speed, volume, travelTime, queueLength: avgQueuePred };
        } else {
          const seedVal = Math.sin(playbackIndex / 3 + key.charCodeAt(0));
          const density = Math.round(45 + seedVal * 20);
          const status = density >= 85 ? 'critical' :
                         density >= 65 ? 'heavy' :
                         density >= 40 ? 'moderate' : 'free';
          const speed = Math.round(45 - seedVal * 12);
          const volume = Math.round(180 + seedVal * 40);
          const travelTime = parseFloat((0.8 * 60 / speed + (status === 'critical' ? 2 : 1)).toFixed(1));
          
          newStatuses[key] = { status, density, speed, volume, travelTime };
        }
      } else {
        if (records.length > 0) {
          const avgOccupancy = records.reduce((sum, r) => sum + r.occupancy, 0) / records.length;
          const avgSpeed = Math.round(records.reduce((sum, r) => sum + r.speed, 0) / records.length);
          const totalVolume = records.reduce((sum, r) => sum + r.volume, 0);
          const avgQueueLength = records.reduce((sum, r) => sum + r.queueLength, 0) / records.length;
          const avgTravelTime = records.reduce((sum, r) => sum + r.travelTime, 0) / records.length;

          const density = Math.max(5, Math.min(100, Math.round(avgOccupancy * 100)));
          const status = density >= 85 ? 'critical' :
                         density >= 65 ? 'heavy' :
                         density >= 40 ? 'moderate' : 'free';

          newStatuses[key] = {
            status,
            density,
            speed: avgSpeed || 35,
            volume: totalVolume || 150,
            travelTime: parseFloat(avgTravelTime.toFixed(1)) || 1.2,
            queueLength: avgQueueLength
          };
        } else {
          const seedVal = Math.sin(playbackIndex / 4 + key.charCodeAt(0));
          const density = Math.round(25 + seedVal * 10);
          const status = density >= 85 ? 'critical' :
                         density >= 65 ? 'heavy' :
                         density >= 40 ? 'moderate' : 'free';
          const speed = Math.round(45 - seedVal * 8);
          const volume = Math.round(100 + seedVal * 30);
          const travelTime = parseFloat((0.6 * 60 / speed).toFixed(1));

          newStatuses[key] = { status, density, speed, volume, travelTime };
        }
      }
    });

    setLinkStatuses(newStatuses);

    setNodes(prevNodes => prevNodes.map(node => {
      const connectedLinkIds = nodeLinkConnections[node.id] || [];
      const linkRecords = activeLinks.filter(l => connectedLinkIds.includes(l.linkId));

      if (linkRecords.length > 0) {
        const avgOccupancy = linkRecords.reduce((sum, r) => sum + r.occupancy, 0) / linkRecords.length;
        const avgSpeed = Math.round(linkRecords.reduce((sum, r) => sum + r.speed, 0) / linkRecords.length);
        const totalVolume = linkRecords.reduce((sum, r) => sum + r.volume, 0);
        
        const density = Math.max(5, Math.min(100, Math.round(avgOccupancy * 100)));
        const vehicleCount = Math.round(totalVolume * 2);
        const status = density >= 85 ? 'critical' :
                       density >= 65 ? 'heavy' :
                       density >= 40 ? 'moderate' : 'free';

        return {
          ...node,
          density,
          vehicleCount,
          avgSpeed: avgSpeed || 30,
          status
        };
      } else {
        const seedVal = Math.sin(playbackIndex / 5 + (node.id === 'mavoor' ? 1 : node.id === 'bus_stand' ? 2 : 3));
        const densityOffset = Math.round(seedVal * 8);
        const baseDensity = node.id === 'mavoor' ? 31 : 28;
        const density = Math.max(5, Math.min(100, baseDensity + densityOffset));
        const vehicleCount = Math.round(density * 13);
        const avgSpeed = Math.max(5, Math.round(45 - (density * 0.35)));
        const status = density >= 85 ? 'critical' :
                       density >= 65 ? 'heavy' :
                       density >= 40 ? 'moderate' : 'free';
        return {
          ...node,
          density,
          vehicleCount,
          avgSpeed,
          status
        };
      }
    }));
  }, [playbackIndex, gcsLinkData, gcsPredictions, gcsTicks, predictionWindow, enableGcsIncidents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  }, [tokens]);

  useEffect(() => {
    localStorage.setItem(INCIDENTS_KEY, JSON.stringify(incidents));
  }, [incidents]);

  useEffect(() => {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    localStorage.setItem(ANOMALIES_KEY, JSON.stringify(anomalies));
  }, [anomalies]);

  useEffect(() => {
    localStorage.setItem(SIMULATIONS_KEY, JSON.stringify(simulations));
  }, [simulations]);

  // Drone movement simulation with collision avoidance
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      setDrones(prev => prev.map(drone => {
        const target = nodes.find(n => n.id === drone.targetNodeId);
        const current = nodes.find(n => n.name === drone.location);
        if (!target || !current) return drone;

        // Collision avoidance logic
        const isHeadingToStadium = drone.targetNodeId === 'stadium';
        const otherDrone = prev.find(d => d.id !== drone.id);
        let shouldHold = false;

        if (isHeadingToStadium && otherDrone) {
          const otherAtStadium = otherDrone.location === 'Stadium Junction';
          const otherHeadingToStadium = otherDrone.targetNodeId === 'stadium';

          if (otherAtStadium) {
            shouldHold = true;
          } else if (otherHeadingToStadium) {
            const stadiumNode = nodes.find(n => n.id === 'stadium');
            if (stadiumNode) {
              const myDist = Math.sqrt((stadiumNode.lat - drone.lat) ** 2 + (stadiumNode.lng - drone.lng) ** 2);
              const otherDist = Math.sqrt((stadiumNode.lat - otherDrone.lat) ** 2 + (stadiumNode.lng - otherDrone.lng) ** 2);
              if (myDist > otherDist) {
                shouldHold = true;
              } else if (myDist === otherDist && drone.id === 'bravo') {
                shouldHold = true; // Alpha has priority if distance is identical
              }
            }
          }
        }

        if (shouldHold) {
          return {
            ...drone,
            battery: Math.max(10, drone.battery - 0.005),
          };
        }

        const dlat = target.lat - drone.lat;
        const dlng = target.lng - drone.lng;
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);

        if (dist < 0.001) {
          if (drone.status === 'transit') {
            return {
              ...drone,
              location: target.name,
              lat: target.lat,
              lng: target.lng,
              status: 'streaming',
              targetNodeId: undefined, // Hover at dispatched location
              battery: Math.max(10, drone.battery - 0.1),
            };
          }

          const isAlpha = drone.id === 'alpha';
          
          if (drone.customRoute && drone.customRoute.length > 0) {
            const currentIdx = drone.routeIndex !== undefined ? drone.routeIndex : 0;
            const nextIdx = (currentIdx + 1) % drone.customRoute.length;
            const nextTargetId = drone.customRoute[nextIdx];
            
            return {
              ...drone,
              location: target.name,
              lat: target.lat,
              lng: target.lng,
              targetNodeId: nextTargetId,
              routeIndex: nextIdx,
              battery: Math.max(10, drone.battery - 0.1),
            };
          } else {
            const route = isAlpha 
              ? ['stadium', 'mavoor', 'bus_stand', 'arayidathupalam', 'midtown'] 
              : ['mananchira', 'stadium', 'midtown', 'east_bypass', 'poonthanam', 'palayam'];
            
            const currentIdx = route.indexOf(drone.targetNodeId || '');
            const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % route.length;
            const nextTargetId = route[nextIdx];

            return {
              ...drone,
              location: target.name,
              lat: target.lat,
              lng: target.lng,
              targetNodeId: nextTargetId,
              battery: Math.max(10, drone.battery - 0.1),
            };
          }
        }

        return {
          ...drone,
          lat: drone.lat + dlat * 0.05,
          lng: drone.lng + dlng * 0.05,
          battery: Math.max(10, drone.battery - 0.02),
        };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isAuthenticated, nodes]);

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const n: Notification = {
      ...notif,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [n, ...prev].slice(0, 10));
    setTimeout(() => {
      setNotifications(prev => prev.filter(x => x.id !== n.id));
    }, 8000);
  }, []);

  const createToken = useCallback((data: Omit<Token, 'id' | 'timestamp'>) => {
    let mapImage = data.mapImage;
    if (!mapImage && data.lat && data.lng) {
      mapImage = `https://static-maps.yandex.ru/1.x/?ll=${data.lng},${data.lat}&z=15&l=map&size=450,300&pt=${data.lng},${data.lat},pm2orl`;
    }
    
    const token: Token = {
      ...data,
      id: generateTokenId(),
      timestamp: new Date().toISOString(),
      mapImage,
    };
    setTokens(prev => [token, ...prev]);
    addNotification({
      type: data.priority === 'critical' ? 'critical' : data.priority === 'high' ? 'warning' : 'info',
      title: `${data.priority.toUpperCase()} ALERT`,
      message: `Token ${token.id} Generated`,
      tokenId: token.id,
    });
    return token;
  }, [addNotification]);

  const findClosestAvailableDrone = (nodeLat: number, nodeLng: number, currentDrones: Drone[]) => {
    let closest: Drone | null = null;
    let minDist = Infinity;
    const available = currentDrones.filter(d => d.status !== 'offline');
    const list = available.length > 0 ? available : currentDrones;
    for (const d of list) {
      const dist = Math.sqrt((d.lat - nodeLat) ** 2 + (d.lng - nodeLng) ** 2);
      if (dist < minDist) {
        minDist = dist;
        closest = d;
      }
    }
    return closest;
  };

  const dispatchDrone = useCallback((droneId: string, nodeId: string) => {
    setDrones(prev => prev.map(d => {
      if (d.id === droneId) {
        return {
          ...d,
          targetNodeId: nodeId,
          status: 'transit',
          customRoute: undefined
        };
      }
      return d;
    }));
    addNotification({
      type: 'info',
      title: 'UAV DISPATCH',
      message: `UAV ${droneId.toUpperCase()} dispatched to verify incident.`,
    });
  }, [addNotification]);

  const logIncident = useCallback((data: Omit<Incident, 'id' | 'timestamp' | 'tokenId' | 'status'>) => {
    const token = createToken({
      type: data.type,
      priority: data.priority,
      location: data.location,
      status: 'pending',
      description: data.description,
      generatedBy: 'Operator: admin',
      lat: data.lat,
      lng: data.lng,
    });
    const incident: Incident = {
      ...data,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      tokenId: token.id,
      status: 'pending',
    };
    
    setIncidents(prev => {
      const next = [incident, ...prev];
      if (isAutoDispatch && data.lat && data.lng) {
        const closestDrone = findClosestAvailableDrone(data.lat, data.lng, drones);
        if (closestDrone) {
          const targetNodeId = junctionMap[data.nearestJunction || ''] || 'stadium';
          // Dispatch drone immediately
          setTimeout(() => {
            dispatchDrone(closestDrone.id, targetNodeId);
          }, 100);
        }
      }
      return next;
    });

    return incident;
  }, [createToken, isAutoDispatch, drones, dispatchDrone]);

  const updateIncidentStatus = useCallback((id: string, status: Incident['status']) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        // Also update the associated token status
        setTokens(tPrev => tPrev.map(t => {
          if (t.id === inc.tokenId) {
            return {
              ...t,
              status: status === 'active' ? 'active' : status === 'declined' ? 'resolved' : 'pending'
            };
          }
          return t;
        }));

        // Twilio / SendGrid simulation alerts
        if (status === 'active' && (inc.priority === 'high' || inc.priority === 'critical')) {
          addNotification({
            type: 'success',
            title: 'TWILIO DISPATCH',
            message: `Emergency SMS broadcasted for ${inc.type} at ${inc.location}.`,
          });
          addNotification({
            type: 'info',
            title: 'SENDGRID DISPATCH',
            message: `Incident details email dispatched to emergency personnel.`,
          });
        }

        return { ...inc, status };
      }
      return inc;
    }));
  }, [addNotification]);

  const updateDroneRoute = useCallback((droneId: string, nodeIds: string[]) => {
    setDrones(prev => prev.map(d => {
      if (d.id === droneId) {
        return {
          ...d,
          customRoute: nodeIds,
          routeIndex: 0,
          targetNodeId: nodeIds[0] || d.targetNodeId
        };
      }
      return d;
    }));
  }, []);

  const createEvent = useCallback((data: Omit<PlannedEvent, 'id' | 'tokenId' | 'createdAt'>) => {
    let lat = data.lat;
    let lng = data.lng;
    
    if (!lat && !lng) {
      if (data.zoneName) {
        const coords = zoneCoordinates[data.zoneName];
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      } else if (data.polygon && data.polygon.length > 0) {
        let sumLat = 0;
        let sumLng = 0;
        data.polygon.forEach(([pLat, pLng]) => {
          sumLat += pLat;
          sumLng += pLng;
        });
        lat = sumLat / data.polygon.length;
        lng = sumLng / data.polygon.length;
      }
    }

    const token = createToken({
      type: `Event: ${data.type}`,
      priority: data.priority,
      location: data.zoneName || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`,
      status: 'pending',
      description: `${data.name} — ${data.description || 'No additional details'}. Expected attendance: ${data.expectedAttendance.toLocaleString()}.`,
      generatedBy: 'Operator: admin',
      lat,
      lng,
    });
    const event: PlannedEvent = {
      ...data,
      id: Math.random().toString(36).slice(2),
      tokenId: token.id,
      createdAt: new Date().toISOString(),
    };
    setEvents(prev => [event, ...prev]);
    return event;
  }, [createToken]);

  const logAnomaly = useCallback((data: Omit<DroneAnomaly, 'id' | 'timestamp' | 'tokenId'>) => {
    const token = createToken({
      type: `Drone Detection: ${data.type}`,
      priority: data.type === 'Accident' ? 'critical' : data.type === 'Road Block' ? 'high' : 'medium',
      location: data.location,
      status: 'active',
      description: `${data.droneName} detected ${data.type} near ${data.location} with ${data.confidence}% confidence.`,
      generatedBy: data.droneName,
    });
    const anomaly: DroneAnomaly = {
      ...data,
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      tokenId: token.id,
    };
    setAnomalies(prev => [anomaly, ...prev]);
    return anomaly;
  }, [createToken]);

  const runSimulationAction = useCallback((node: TrafficNode, action: SimulationAction) => {
    const result = runSimulation(node, action);
    const token = createToken({
      type: `Simulation: ${action}`,
      priority: result.congestionReduction < 0 ? 'high' : 'medium',
      location: node.name,
      status: 'resolved',
      description: `What-if simulation "${action}" on ${node.name}: ${result.congestionReduction >= 0 ? '+' : ''}${result.congestionReduction}% congestion change, travel time ${result.travelTime}, density ${result.trafficDensity}%.`,
      generatedBy: 'AI Simulation Engine',
    });
    const sim: SimulationResult = {
      action,
      nodeId: node.id,
      nodeName: node.name,
      congestionReduction: result.congestionReduction,
      travelTime: result.travelTime,
      trafficDensity: result.trafficDensity,
      requiredOfficers: result.requiredOfficers,
      requiredDrones: result.requiredDrones,
      tokenId: token.id,
      timestamp: new Date().toISOString(),
    };
    setSimulations(prev => [sim, ...prev]);
    return sim;
  }, [createToken]);

  const login = useCallback((username: string, password: string) => {
    return username === 'admin' && password === 'password';
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentPage('map');
    setSelectedNode(null);
    setSelectedLink(null);
    setSelectedDroneId('alpha');
    setCurrentRole('supervisor');
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    isAuthenticated, setIsAuthenticated,
    currentPage, setCurrentPage,
    selectedNode, setSelectedNode: selectNode,
    selectedLink, setSelectedLink: selectLink,
    selectedDroneId, setSelectedDroneId,
    currentRole, setCurrentRole,
    updateIncidentStatus,
    updateDroneRoute,
    isDark, setIsDark,
    nodes,
    playbackIndex,
    telemetryLogs,
    videoFrames,
    predictionLogs,
    isAutoDispatch,
    setIsAutoDispatch,
    dispatchDrone,
    drones,
    tokens, setTokens,
    incidents,
    notifications,
    sidebarOpen, setSidebarOpen,
    addNotification,
    createToken,
    logIncident,
    login,
    logout,
    dismissNotification,
    events,
    createEvent,
    anomalies,
    logAnomaly,
    simulations,
    runSimulationAction,
    predictionWindow,
    setPredictionWindow,
    linkStatuses,
    enableGcsIncidents,
    setEnableGcsIncidents,
  };
}
