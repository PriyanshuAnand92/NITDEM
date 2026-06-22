import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { Activity, Sparkles } from 'lucide-react';
import type { TrafficNode, Drone, PredictionWindow, UserRole, Incident } from '../../types';
import { TRAFFIC_NODES, OPERATIONAL_ZONE, STATUS_COLORS, getPrediction, congestionToStatus, PREDICTION_WINDOW_LABELS } from '../../data/constants';
import { statusLabel } from '../../utils';

interface CommandMapProps {
  nodes: TrafficNode[];
  selectedNode: TrafficNode | null;
  onNodeSelect: (node: TrafficNode | null) => void;
  selectedLink: string | null;
  onLinkSelect: (link: string | null) => void;
  drones: Drone[];
  predictionWindow: PredictionWindow;
  onPredictionWindowChange: (w: PredictionWindow) => void;
  onDroneClick: (droneId: string) => void;
  currentRole: UserRole;
  onUpdateDroneRoute: (droneId: string, nodeIds: string[]) => void;
  isDark: boolean;
  linkStatuses: Record<string, {
    status: 'free' | 'moderate' | 'heavy' | 'critical';
    density: number;
    speed: number;
    volume: number;
    travelTime: number;
    queueLength?: number;
  }>;
  incidents: Incident[];
}

// Realigned road connections for Kozhikode 10-junction topology
const CONNECTIONS: [string, string][] = [
  ['mavoor', 'bus_stand'],
  ['bus_stand', 'arayidathupalam'],
  ['bus_stand', 'stadium'],
  ['arayidathupalam', 'midtown'],
  ['stadium', 'mananchira'],
  ['stadium', 'poonthanam'],
  ['stadium', 'midtown'],
  ['midtown', 'east_bypass'],
  ['east_bypass', 'poonthanam'],
  ['poonthanam', 'palayam'],
  ['palayam', 'mananchira'],
  ['mavoor', 'mananchira'],
];

const CONNECTION_TO_ROAD_NAME: Record<string, string> = {
  'mavoor-bus_stand': 'Mavoor Road (Outer)',
  'bus_stand-arayidathupalam': 'Mavoor Road (Middle)',
  'bus_stand-stadium': 'Rajaji Road',
  'arayidathupalam-midtown': 'Mini Bypass Road (North)',
  'stadium-mananchira': 'Pavamani Road',
  'stadium-poonthanam': 'Rammohan Road',
  'stadium-midtown': 'Puthiyara Road',
  'midtown-east_bypass': 'Mini Bypass Road (South)',
  'east_bypass-poonthanam': 'Poonthanam Link Road',
  'poonthanam-palayam': 'M.M Ali Road',
  'palayam-mananchira': 'Bank Road',
  'mavoor-mananchira': 'Mavoor Road (Inner)',
};

const CONNECTION_TO_LINKS: Record<string, string[]> = {
  'mavoor-bus_stand': ['L23', 'L11'],
  'bus_stand-arayidathupalam': ['L19', 'L13'],
  'bus_stand-stadium': ['L17', 'L6'],
  'arayidathupalam-midtown': ['L18', 'L1'],
  'stadium-mananchira': ['L15', 'L5'],
  'stadium-poonthanam': ['L10', 'L4'],
  'stadium-midtown': ['L16', 'L3'],
  'midtown-east_bypass': ['L24', 'L2'],
  'east_bypass-poonthanam': ['L20', 'L7'],
  'poonthanam-palayam': ['L21', 'L9'],
  'palayam-mananchira': ['L22', 'L8'],
  'mavoor-mananchira': ['L26', 'L14'],
};



const CONGESTION_ORDER = ['free', 'moderate', 'heavy', 'critical'] as const;

function getEffectiveNodeStatus(node: TrafficNode, predictionWindow: PredictionWindow) {
  if (predictionWindow === 'current') return node.status;
  return congestionToStatus(getPrediction(node, predictionWindow).congestion);
}

function getConnectionTooltipContent(
  a: TrafficNode,
  b: TrafficNode,
  predictionWindow: PredictionWindow,
  linkStats?: { status: string; density: number; speed: number; volume: number; travelTime: number; queueLength?: number }
) {
  const label = predictionWindow === 'current' ? 'CURRENT ANALYSIS' : PREDICTION_WINDOW_LABELS[predictionWindow].toUpperCase();
  const status = linkStats?.status || 'free';
  const density = linkStats?.density ?? 0;
  const speed = linkStats?.speed ?? 45;
  const volume = linkStats?.volume ?? 120;
  const travelTime = linkStats?.travelTime ?? 1.0;
  const queueLength = linkStats?.queueLength;

  return `
    <div style="font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.4; background: #151820; border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 10px 12px; color: white; min-width: 220px;">
      <div style="color: #F97316; font-weight: 700; margin-bottom: 4px; font-size: 14px;">${a.name} ↔ ${b.name}</div>
      <div style="color:#9CA3AF; font-size:11px; letter-spacing:0.05em; margin-bottom:4px; font-weight: bold;">${label}</div>
      <div style="color: #E5E7EB; font-size: 12px; margin-bottom: 2px;">Link status: <span style="color: ${STATUS_COLORS[status]}; font-weight: bold;">${statusLabel(status)}</span></div>
      <div style="color: #E5E7EB; font-size: 12px; margin-bottom: 2px;">Density: <span style="color:${STATUS_COLORS[status]}; font-weight: bold;">${density}%</span></div>
      <div style="color: #E5E7EB; font-size: 12px; margin-bottom: 2px;">Speed: <span style="font-weight: bold;">${speed} km/h</span> | Volume: <span style="font-weight: bold;">${volume} veh</span></div>
      <div style="color: #E5E7EB; font-size: 12px; margin-bottom: 2px;">Est. Travel Time: <span style="font-weight: bold; color: #F59E0B;">${travelTime} mins</span></div>
      ${queueLength !== undefined && queueLength > 0 ? `<div style="color: #E5E7EB; font-size: 12px;">Queue Length: <span style="font-weight: bold; color: #EF4444;">${queueLength.toFixed(1)} m</span></div>` : ''}
    </div>
  `;
}

export default function CommandMap({ nodes, selectedNode, onNodeSelect, selectedLink, onLinkSelect, drones, predictionWindow, onPredictionWindowChange, onDroneClick, currentRole, onUpdateDroneRoute, isDark, linkStatuses, incidents }: CommandMapProps) {
  const NODE_BY_ID = Object.fromEntries(nodes.map(node => [node.id, node]));
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const ringsRef = useRef<Record<string, L.Circle>>({});
  const linesRef = useRef<Record<string, L.Polyline>>({});
  const droneMarkersRef = useRef<Record<string, L.Marker>>({});
  const labelsRef = useRef<Record<string, L.Marker>>({});
  const [mapReady, setMapReady] = useState(false);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const selectedLinkRef = useRef(selectedLink);
  const selectedNodeRef = useRef(selectedNode);

  const [isDrawingRoute, setIsDrawingRoute] = useState(false);
  const [drawnRoute, setDrawnRoute] = useState<string[]>([]);
  const [isUploadingRoute, setIsUploadingRoute] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [plannerDroneId, setPlannerDroneId] = useState('alpha');
  const [roleAlert, setRoleAlert] = useState(false);

  const isDrawingRouteRef = useRef(isDrawingRoute);
  const drawnRouteRef = useRef(drawnRoute);

  useEffect(() => {
    selectedLinkRef.current = selectedLink;
  }, [selectedLink]);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  useEffect(() => {
    isDrawingRouteRef.current = isDrawingRoute;
  }, [isDrawingRoute]);

  useEffect(() => {
    drawnRouteRef.current = drawnRoute;
  }, [drawnRoute]);

  // Swap Leaflet tile layer url when isDark transitions
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(
        isDark 
          ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
          : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
      );
    }
  }, [isDark]);

  const drawnLineRef = useRef<L.Polyline | null>(null);

  // Redraw drawn route polyline when it changes
  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;

    if (drawnLineRef.current) {
      drawnLineRef.current.remove();
      drawnLineRef.current = null;
    }

    if (drawnRoute.length >= 2) {
      const coords = drawnRoute.map(id => {
        const node = NODE_BY_ID[id];
        return [node.lat, node.lng] as [number, number];
      });
      drawnLineRef.current = L.polyline(coords, {
        color: '#06B6D4', // Cyan neon line for MAVLink path
        weight: 4,
        dashArray: '6, 8',
        opacity: 0.9,
      }).addTo(leafletMap.current);
    }

    return () => {
      if (drawnLineRef.current) {
        drawnLineRef.current.remove();
      }
    };
  }, [drawnRoute, mapReady]);

  const handleUploadMission = () => {
    setIsUploadingRoute(true);
    setUploadStep(0);

    setTimeout(() => setUploadStep(1), 1000);
    setTimeout(() => setUploadStep(2), 2000);
    setTimeout(() => setUploadStep(3), 3000);
    setTimeout(() => {
      onUpdateDroneRoute(plannerDroneId, drawnRoute);
      setIsUploadingRoute(false);
      setIsDrawingRoute(false);
      setDrawnRoute([]);
    }, 4200);
  };

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [11.2545, 75.7872],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    // CartoDB tile layer (url dynamically toggled based on initial isDark state)
    const tiles = L.tileLayer(
      isDark 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' 
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', 
      {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);
    tileLayerRef.current = tiles;

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Operational zone polygon
    const zone = L.polygon(OPERATIONAL_ZONE as L.LatLngExpression[], {
      color: '#F97316',
      fillColor: '#F97316',
      fillOpacity: 0.05,
      weight: 2,
      dashArray: '8 4',
    }).addTo(map);

    zone.bindTooltip('NIT DEM Operational Monitoring Zone', {
      permanent: true,
      direction: 'top',
      className: 'zone-tooltip',
    });

    // Draw connections
    CONNECTIONS.forEach(([aId, bId]) => {
      const a = NODE_BY_ID[aId];
      const b = NODE_BY_ID[bId];
      if (!a || !b) return;
      const key = `${aId}-${bId}`;
      const stats = linkStatuses[key] || linkStatuses[`${bId}-${aId}`];
      const status = stats?.status || 'free';
      const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: STATUS_COLORS[status],
        weight: 5,
        opacity: 0.6,
        className: 'cursor-pointer',
      }).addTo(map);
      line.bindTooltip(getConnectionTooltipContent(a, b, predictionWindow, stats), {
        permanent: false,
        sticky: true,
        direction: 'top',
        className: 'custom-tooltip',
        opacity: 1,
        offset: [0, -8],
      });
      line.on('mouseover', () => {
        line.setStyle({ weight: 9, opacity: 1.0 });
        line.openTooltip();
      });
      line.on('mouseout', () => {
        const isSel = selectedLinkRef.current === key;
        const hasSelection = selectedLinkRef.current !== null || selectedNodeRef.current !== null;
        const currentStats = linkStatuses[key] || linkStatuses[`${bId}-${aId}`];
        const currentStatus = currentStats?.status || 'free';
        line.setStyle({
          color: STATUS_COLORS[currentStatus],
          weight: isSel ? 9 : 5,
          opacity: isSel ? 1.0 : (hasSelection ? 0.35 : 0.6),
        });
        line.closeTooltip();
      });
      line.on('click', () => {
        onLinkSelect(key);
      });
      linesRef.current[key] = line;
    });

    // Draw traffic nodes
    nodes.forEach(node => {
      const color = STATUS_COLORS[node.status];
      const isSignalized = ['stadium', 'midtown', 'bus_stand', 'mavoor'].includes(node.id);

      // Outer pulse ring
      const ring = L.circle([node.lat, node.lng], {
        radius: isSignalized ? 100 : 80,
        color,
        fillColor: color,
        fillOpacity: isSignalized ? 0.12 : 0.08,
        weight: isSignalized ? 2 : 1,
        dashArray: isSignalized ? '6 6' : '4 4',
      }).addTo(map);
      ringsRef.current[node.id] = ring;

      const marker = L.circleMarker([node.lat, node.lng], {
        radius: isSignalized ? 12 : 10,
        color: isSignalized ? '#F59E0B' : color, // Orange/Yellow accent border for signalized
        fillColor: color,
        fillOpacity: 0.9,
        weight: isSignalized ? 3 : 2,
      }).addTo(map);

      marker.on('click', () => {
        if (isDrawingRouteRef.current) {
          const route = drawnRouteRef.current;
          if (route[route.length - 1] !== node.id) {
            setDrawnRoute([...route, node.id]);
          }
        } else {
          onNodeSelect(node);
          map.flyTo([node.lat, node.lng], 16, { duration: 1.2, easeLinearity: 0.3 });
        }
      });

      // Node label
      const displayName = isSignalized ? `🚦 ${node.name}` : node.name;
      const labelMarker = L.marker([node.lat, node.lng], {
        icon: L.divIcon({
          className: 'custom-node-label',
          html: `<div style="font-family:'JetBrains Mono',monospace; font-size:12px; color:white; text-align:center; white-space:nowrap; text-shadow: 0 1px 3px black; font-weight:${isSignalized ? '700' : '600'};">${displayName}</div>`,
          iconAnchor: [80, -14],
          iconSize: [160, 24],
        }),
      }).addTo(map);
      labelsRef.current[node.id] = labelMarker;

      markersRef.current[node.id] = marker;
    });

    // Drone markers
    drones.forEach(drone => {
      const droneIcon = L.divIcon({
        className: 'cursor-pointer',
        html: `<div style="width:20px;height:20px;background:rgba(59,130,246,0.9);border:2px solid #3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;box-shadow:0 0 10px rgba(59,130,246,0.5);">✈</div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const droneMarker = L.marker([drone.lat, drone.lng], { icon: droneIcon }).addTo(map);
      droneMarker.bindTooltip(`${drone.name} · ${drone.battery}%`, { direction: 'top' });
      droneMarker.on('click', () => {
        onDroneClick(drone.id);
      });
      droneMarkersRef.current[drone.id] = droneMarker;
    });

    leafletMap.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Update drone positions
  useEffect(() => {
    if (!mapReady) return;
    drones.forEach(drone => {
      const marker = droneMarkersRef.current[drone.id];
      if (marker) {
        marker.setLatLng([drone.lat, drone.lng]);
        marker.setTooltipContent(`${drone.name} · ${drone.battery.toFixed(0)}% · ${drone.altitude}m`);
      }
    });
  }, [drones, mapReady]);

  // Update incident markers and popups on the map dynamically
  const incidentMarkersRef = useRef<Record<string, { marker: L.Marker; popup: L.Popup }>>({});

  useEffect(() => {
    if (!mapReady || !leafletMap.current) return;

    // Filter active incidents to only show the one on the currently selected link or node
    const activeIncidents = incidents.filter(i => {
      if ((i.status !== 'active' && i.status !== 'pending') || i.lat === undefined || i.lng === undefined) {
        return false;
      }

      // If nothing is selected, do not show incident markers on the map
      if (!selectedLink && !selectedNode) {
        return false;
      }

      // If a node is selected, check if nearestJunction matches the node name or ID
      if (selectedNode) {
        const nodeName = selectedNode.name.toLowerCase();
        const nodeId = selectedNode.id.toLowerCase();
        return i.nearestJunction?.toLowerCase().includes(nodeName) || 
               i.nearestJunction?.toLowerCase().includes(nodeId);
      }

      // If a link is selected (e.g. 'mavoor-bus_stand')
      if (selectedLink) {
        const roadName = CONNECTION_TO_ROAD_NAME[selectedLink];
        if (!roadName) return false;

        // Check if location or affected roads match
        const matchLocation = i.location?.toLowerCase() === roadName.toLowerCase() || 
                             i.affectedRoads?.some(r => r.toLowerCase() === roadName.toLowerCase());

        // Check if nearestJunction matches node endpoints
        const [nodeAId, nodeBId] = selectedLink.split('-');
        const nodeA = NODE_BY_ID[nodeAId];
        const nodeB = NODE_BY_ID[nodeBId];
        const matchNodeA = nodeA && (i.nearestJunction?.toLowerCase().includes(nodeA.name.toLowerCase()) || i.nearestJunction?.toLowerCase().includes(nodeA.id.toLowerCase()));
        const matchNodeB = nodeB && (i.nearestJunction?.toLowerCase().includes(nodeB.name.toLowerCase()) || i.nearestJunction?.toLowerCase().includes(nodeB.id.toLowerCase()));

        // Check GCS link ID
        const connectionLinks = CONNECTION_TO_LINKS[selectedLink] || [];
        const matchGcs = connectionLinks.some(linkId => 
          i.id.includes(linkId) || (i.tokenId && i.tokenId.includes(linkId))
        );

        return matchLocation || matchNodeA || matchNodeB || matchGcs;
      }

      return false;
    });

    // Get current IDs
    const currentIds = new Set(activeIncidents.map(i => i.id));

    // Remove any markers for incidents that are no longer active/selected
    Object.entries(incidentMarkersRef.current).forEach(([id, item]) => {
      if (!currentIds.has(id)) {
        item.marker.remove();
        item.popup.remove();
        delete incidentMarkersRef.current[id];
      }
    });

    // Add or update markers for active incidents
    activeIncidents.forEach((incident) => {
      const id = incident.id;
      const lat = incident.lat!;
      const lng = incident.lng!;
      
      const priorityColor = 
        incident.priority === 'critical' ? '#EF4444' : 
        incident.priority === 'high' ? '#F97316' : 
        incident.priority === 'medium' ? '#F59E0B' : '#3B82F6';

      const priorityBg = 
        incident.priority === 'critical' ? 'rgba(239,68,68,0.1)' : 
        incident.priority === 'high' ? 'rgba(249,115,22,0.1)' : 
        incident.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)';

      const formattedTime = new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Generate popup content
      const trafficImpact = 
        incident.priority === 'critical' ? 'Critical: Major gridlock. Delay >40 min.' :
        incident.priority === 'high' ? 'High: Congestion. Delay 15-25 min.' :
        incident.priority === 'medium' ? 'Moderate: Light queue. Delay 5-10 min.' :
        'Low: Minimal impact. Delay <3 min.';

      const recommendedActionsStr = 
        incident.priority === 'critical' || incident.priority === 'high'
          ? '⚡ Deploy nearest UAV.<br/>⚡ Divert traffic via Mini Bypass.<br/>⚡ Alert emergency services.'
          : '⚡ Deploy nearest UAV.<br/>⚡ Adjust phase timings.';

      const affectedRoadsStr = incident.affectedRoads?.join(', ') || incident.location;

      const popupHtml = `
        <div style="min-width: 220px; font-family: 'JetBrains Mono', monospace; background: #0F1117; border: 1px solid rgba(239,68,68,0.35); border-radius: 8px; padding: 10px; color: white;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 5px; margin-bottom: 5px;">
            <div style="font-weight: 700; color: #EF4444; font-size: 11px;">⚠️ ${incident.type}</div>
            <span style="font-size: 8px; border: 1px solid ${priorityColor}; border-radius: 4px; padding: 1px 4px; font-weight: 700; text-transform: uppercase; color: ${priorityColor}; background: ${priorityBg};">${incident.priority}</span>
          </div>
          <div style="font-size: 10px; color: #E5E7EB; margin-bottom: 2px;">Road: <strong>${incident.location}</strong></div>
          <div style="font-size: 9px; color: #9CA3AF; margin-bottom: 4px;">Time: ${formattedTime}</div>
          
          <div id="details-${id}" style="display: none; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 5px; margin-top: 5px; font-size: 9px; color: #D1D5DB;">
            <div style="margin-bottom: 4px;"><strong>Location:</strong> ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E</div>
            <div style="margin-bottom: 4px;"><strong>Affected:</strong> ${affectedRoadsStr}</div>
            <div style="margin-bottom: 4px;"><strong>Severity:</strong> <span style="color: ${priorityColor}">${incident.priority.toUpperCase()}</span></div>
            <div style="margin-bottom: 4px;"><strong>Traffic Impact:</strong> ${trafficImpact}</div>
            <div style="margin-bottom: 2px;"><strong>Response Actions:</strong></div>
            <div style="color: #F59E0B; padding-left: 4px; line-height: 1.2;">${recommendedActionsStr}</div>
          </div>
          
          <button onclick="
            const el = document.getElementById('details-${id}');
            if(el.style.display === 'none') {
              el.style.display = 'block';
              this.innerText = 'Collapse Details ▲';
            } else {
              el.style.display = 'none';
              this.innerText = 'Expand Details ▼';
            }
          " style="width: 100%; margin-top: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #9CA3AF; font-size: 8px; font-family: inherit; padding: 4px; cursor: pointer; text-transform: uppercase; font-weight: bold;">Expand Details ▼</button>
        </div>
      `;

      let existing = incidentMarkersRef.current[id];
      if (existing) {
        existing.marker.setLatLng([lat, lng]);
        existing.popup.setContent(popupHtml);
      } else {
        const iconHtml = `
          <div style="width: 24px; height: 24px; background: rgba(239,68,68,0.25); border: 2px solid #EF4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; box-shadow: 0 0 10px rgba(239,68,68,0.6);">
            ⚠️
          </div>
        `;
        const markerIcon = L.divIcon({
          className: 'incident-marker-icon',
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(leafletMap.current!);
        
        const popup = L.popup({
          autoClose: false,
          closeOnClick: false,
          className: 'incident-custom-popup',
          offset: [0, -10],
        })
        .setLatLng([lat, lng])
        .setContent(popupHtml);

        marker.bindPopup(popup);
        popup.addTo(leafletMap.current!);

        incidentMarkersRef.current[id] = { marker, popup };
      }
    });

  }, [incidents, mapReady, selectedLink, selectedNode]);

  // Selected node highlighting + map color and position updates are handled below
  useEffect(() => {
    if (!mapReady) return;

    // Compute effective status per node for this window
    const effectiveStatus: Record<string, TrafficNode['status']> = {};
    nodes.forEach(node => {
      const pred = getPrediction(node, predictionWindow);
      effectiveStatus[node.id] = predictionWindow === 'current' ? node.status : congestionToStatus(pred.congestion);
    });

    const hasSelection = selectedLink !== null || selectedNode !== null;

    // Update node markers, rings, and labels (colors + sizes + dynamic coordinates)
    nodes.forEach(node => {
      const color = STATUS_COLORS[effectiveStatus[node.id]];
      const marker = markersRef.current[node.id];
      const ring = ringsRef.current[node.id];
      const label = labelsRef.current[node.id];
      const isSignalized = ['stadium', 'midtown', 'bus_stand', 'mavoor'].includes(node.id);

      if (marker) {
        const isSelected = selectedNode?.id === node.id;
        const opacity = isSelected ? 1.0 : (hasSelection ? 0.4 : 0.9);
        const radius = isSelected ? 16 : (isSignalized ? 12 : 10);
        const weight = isSelected ? 3 : (isSignalized ? 3 : 2);
        const colorBorder = isSelected ? '#FFFFFF' : (isSignalized ? '#F59E0B' : color);

        // Dynamic coordinate update
        marker.setLatLng([node.lat, node.lng]);

        marker.setStyle({
          radius,
          weight,
          color: colorBorder,
          fillColor: color,
          fillOpacity: opacity,
          opacity: opacity,
        });

        const pred = getPrediction(node, predictionWindow);
        marker.setTooltipContent(`
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #151820; border: 1px solid rgba(249,115,22,0.3); border-radius: 8px; padding: 8px 10px; color: white; min-width: 170px;">
            <div style="color: #F97316; font-weight: 700; margin-bottom: 4px;">${node.name} ${isSignalized ? '🚦' : ''}</div>
            <div style="color:#6B7280; font-size:9px; letter-spacing:0.05em; margin-bottom:3px;">${PREDICTION_WINDOW_LABELS[predictionWindow].toUpperCase()}</div>
            <div style="color: #9CA3AF; font-size: 10px;">Density: <span style="color: ${color}">${pred.density}%</span></div>
            <div style="color: #9CA3AF; font-size: 10px;">Vehicles: ${pred.vehicleCount.toLocaleString()}</div>
            <div style="color: #9CA3AF; font-size: 10px;">Speed: ${pred.avgSpeed} km/h</div>
            ${predictionWindow !== 'current' ? `<div style="color: #9CA3AF; font-size: 10px;">Confidence: <span style="color:#F97316">${pred.confidence}%</span></div>` : ''}
            <div style="color: #9CA3AF; font-size: 10px; margin-top: 4px;">Click to inspect →</div>
          </div>
        `);
      }

      if (ring) {
        ring.setLatLng([node.lat, node.lng]);
        ring.setStyle({ color, fillColor: color });
      }

      if (label) {
        label.setLatLng([node.lat, node.lng]);
      }
    });

    // Update connection line colors and dynamic coordinate routing
    CONNECTIONS.forEach(([aId, bId]) => {
      const key = `${aId}-${bId}`;
      const line = linesRef.current[key];
      if (!line) return;
      const a = NODE_BY_ID[aId];
      const b = NODE_BY_ID[bId];
      if (!a || !b) return;

      // Dynamic coordinate routing update
      line.setLatLngs([[a.lat, a.lng], [b.lat, b.lng]]);

      const stats = linkStatuses[key] || linkStatuses[`${bId}-${aId}`];
      const status = stats?.status || 'free';
      const isSel = selectedLink === key;

      line.setStyle({
        color: STATUS_COLORS[status],
        weight: isSel ? 9 : 5,
        opacity: isSel ? 1.0 : (hasSelection ? 0.35 : 0.6),
      });

      line.setTooltipContent(getConnectionTooltipContent(a, b, predictionWindow, stats));
    });
  }, [predictionWindow, mapReady, selectedNode, selectedLink, linkStatuses, nodes]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* Overlay legend */}
      <div className="absolute bottom-4 left-4 bg-[#0F1117]/90 border border-white/[0.08] rounded-lg p-3 backdrop-blur-sm">
        <div className="text-[9px] font-mono text-gray-500 mb-2 tracking-widest flex items-center gap-2">
          TRAFFIC STATUS
          {predictionWindow !== 'current' && (
            <span className="text-orange-400">· {PREDICTION_WINDOW_LABELS[predictionWindow].toUpperCase()}</span>
          )}
        </div>
        <div className="space-y-1">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-gray-400 font-mono">{statusLabel(status)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Map overlay stats — hidden on small to avoid overlap, scrollable strip on medium */}
      <div className="hidden md:flex absolute top-4 left-4 gap-2 flex-wrap max-w-[55%] z-[5]">
        {nodes.map(node => {
          const pred = getPrediction(node, predictionWindow);
          const color = STATUS_COLORS[predictionWindow === 'current' ? node.status : congestionToStatus(pred.congestion)];
          return (
             <motion.button
              key={node.id}
              onClick={() => {
                onNodeSelect(node);
                leafletMap.current?.flyTo([node.lat, node.lng], 16, { duration: 1.2 });
              }}
              whileHover={{ scale: 1.05 }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all ${
                selectedNode?.id === node.id
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                  : 'bg-[#0F1117]/80 border-white/[0.08] text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                {node.name}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Mobile node selector — horizontal scroll strip below header */}
      <div className="md:hidden absolute top-2 left-14 right-2 z-[5] overflow-x-auto">
        <div className="flex gap-1.5 pb-1">
          {nodes.map(node => {
            const pred = getPrediction(node, predictionWindow);
            const color = STATUS_COLORS[predictionWindow === 'current' ? node.status : congestionToStatus(pred.congestion)];
            return (
              <button
                key={node.id}
                onClick={() => {
                  onNodeSelect(node);
                  leafletMap.current?.flyTo([node.lat, node.lng], 16, { duration: 1.2 });
                }}
                className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-mono border ${
                  selectedNode?.id === node.id
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-[#0F1117]/90 border-white/[0.08] text-gray-300'
                }`}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle" style={{ backgroundColor: color }} />
                {node.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prediction Mode Toggle — bottom on mobile, top-right on desktop */}
      <div className="absolute bottom-20 right-2 md:bottom-auto md:top-4 md:right-4 flex flex-col items-end gap-2 z-[5]">
        <div className="flex gap-1 bg-[#0F1117]/90 border border-white/[0.08] rounded-lg p-1 backdrop-blur-sm">
          <button
            onClick={() => onPredictionWindowChange('current')}
            className={`flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded text-[10px] font-mono uppercase transition-all ${
              predictionWindow === 'current' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-white'
            }`}
          >
            <Activity className="w-3 h-3" /> <span className="hidden sm:inline">Current Analysis</span><span className="sm:hidden">Now</span>
          </button>
          <button
            onClick={() => onPredictionWindowChange('20min')}
            className={`flex items-center gap-1.5 px-2 md:px-2.5 py-1.5 rounded text-[10px] font-mono uppercase transition-all ${
              predictionWindow !== 'current' ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3" /> <span className="hidden sm:inline">Future Prediction</span><span className="sm:hidden">Future</span>
          </button>
        </div>

        {/* Sub-toggle for prediction horizon */}
        {predictionWindow !== 'current' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            className="flex gap-1 bg-[#0F1117]/90 border border-orange-500/20 rounded-lg p-1 backdrop-blur-sm"
          >
            {(['20min', '1hr', '2hr'] as const).map(w => (
              <button
                key={w}
                onClick={() => onPredictionWindowChange(w)}
                className={`px-2 md:px-2.5 py-1 rounded text-[10px] font-mono uppercase transition-all ${
                  predictionWindow === w ? 'bg-orange-500/20 text-orange-400' : 'text-gray-500 hover:text-white'
                }`}
              >
                {w === '20min' ? '20 Min' : w === '1hr' ? '1 Hour' : '2 Hour'}
              </button>
            ))}
          </motion.div>
        )}

        {/* MAVLink Mission Planner Toggle Button */}
        <button
          onClick={() => {
            const allowed = currentRole === 'supervisor' || currentRole === 'operator';
            if (allowed) {
              setIsDrawingRoute(!isDrawingRoute);
              setDrawnRoute([]);
            } else {
              setRoleAlert(true);
              setTimeout(() => setRoleAlert(false), 3000);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-mono uppercase border transition-all ${
            isDrawingRoute 
              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' 
              : 'bg-[#0F1117]/90 border-white/[0.08] text-gray-400 hover:text-white hover:border-cyan-500/30'
          }`}
        >
          ✈ MAVLink Mission Planner
        </button>

        {roleAlert && (
          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg text-[9px] font-mono tracking-wider text-right max-w-xs">
            Requires Supervisor or Operator elevation to program autopilot dispatches.
          </motion.div>
        )}
      </div>

      {/* MAVLink Planning Console Banner at bottom center */}
      {isDrawingRoute && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0F1117]/95 border border-cyan-500/30 rounded-xl p-3.5 backdrop-blur-md z-[5] w-full max-w-sm">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/[0.06]">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">MAVLink Planner</span>
              <div className="text-[8px] text-gray-500 font-mono">Draw waypoints on map</div>
            </div>
            <select
              value={plannerDroneId}
              onChange={e => setPlannerDroneId(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.1] rounded px-1.5 py-0.5 text-[9px] font-mono text-white focus:outline-none"
            >
              <option value="alpha" className="bg-[#151820]">UAV Alpha</option>
              <option value="bravo" className="bg-[#151820]">UAV Bravo</option>
            </select>
          </div>

          <div className="mb-3 space-y-1">
            <div className="text-[9px] text-gray-400 font-mono">
              Waypoints: {drawnRoute.length === 0 ? 'Click map nodes to add...' : drawnRoute.map(id => NODE_BY_ID[id]?.name.split(' ')[0]).join(' → ')}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsDrawingRoute(false);
                setDrawnRoute([]);
              }}
              className="flex-1 py-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white border border-white/[0.08] text-[9px] font-mono uppercase"
            >
              Cancel
            </button>
            <button
              disabled={drawnRoute.length < 2 || isUploadingRoute}
              onClick={handleUploadMission}
              className={`flex-1 py-1.5 rounded text-[9px] font-mono uppercase font-bold transition-all ${
                drawnRoute.length >= 2 
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-black shadow-[0_0_10px_rgba(6,182,212,0.4)]' 
                  : 'bg-white/[0.02] text-gray-600 border border-white/[0.04] cursor-not-allowed'
              }`}
            >
              Upload Mission
            </button>
          </div>
        </div>
      )}

      {/* Holographic upload progress loader */}
      {isUploadingRoute && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0F1117] border border-cyan-500/40 rounded-2xl p-6 w-full max-w-xs text-center space-y-4">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-10 h-10 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full mx-auto" />
            <div className="space-y-1.5">
              <div className="text-[10px] font-mono text-cyan-400 font-bold tracking-widest uppercase">MAVLink Telemetry Upload</div>
              <p className="text-[9px] font-mono text-gray-400">
                {uploadStep === 0 && 'Establishing connection to UAV telemetry modems...'}
                {uploadStep === 1 && 'Uploading mission frames to autopilot serial registers...'}
                {uploadStep === 2 && 'Verifying checksums and flight boundaries...'}
                {uploadStep === 3 && 'UAV autopilot route programmed successfully!'}
              </p>
            </div>
            <div className="w-full bg-white/[0.05] h-1 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-cyan-400"
                initial={{ width: '0%' }}
                animate={{ width: `${(uploadStep + 1) * 25}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>
      )}


      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.15); opacity: 0.6; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
        .incident-marker-icon > div {
          animation: pulse-ring 1.5s infinite ease-in-out;
        }
        .incident-custom-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .incident-custom-popup .leaflet-popup-tip {
          background: #0F1117 !important;
          border: 1px solid rgba(239,68,68,0.3) !important;
        }
        .incident-custom-popup .leaflet-popup-close-button {
          display: none !important;
        }
        .custom-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; }
        .custom-tooltip::before { display: none !important; }
        .zone-tooltip { background: rgba(249,115,22,0.2) !important; border: 1px solid rgba(249,115,22,0.4) !important; color: #F97316 !important; font-family: 'JetBrains Mono', monospace !important; font-size: 11px !important; font-weight: 600 !important; border-radius: 6px !important; padding: 4px 8px !important; }
        .zone-tooltip::before { border-top-color: rgba(249,115,22,0.4) !important; }
        .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.08) !important; background: #0F1117 !important; }
        .leaflet-control-zoom a { background: #0F1117 !important; color: #9CA3AF !important; border-color: rgba(255,255,255,0.06) !important; }
        .leaflet-control-zoom a:hover { color: white !important; background: #1C202B !important; }
        .cursor-pointer { cursor: pointer !important; }
      `}</style>
    </div>
  );
}
