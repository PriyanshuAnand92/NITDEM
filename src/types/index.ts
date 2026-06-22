export type Page = 
  | 'dashboard'
  | 'map'
  | 'analytics'
  | 'forecasting'
  | 'incidents'
  | 'drones'
  | 'history'
  | 'alerts'
  | 'reports'
  | 'events'
  | 'drone_feed';

export interface TrafficNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  density: number; // 0-100
  vehicleCount: number;
  avgSpeed: number; // km/h
  incidentCount: number;
  status: 'free' | 'moderate' | 'heavy' | 'critical';
}

export interface Drone {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  battery: number;
  altitude: number;
  status: 'streaming' | 'transit' | 'charging' | 'offline';
  targetNodeId?: string;
  customRoute?: string[];
  routeIndex?: number;
}

export interface Incident {
  id: string;
  type: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'active' | 'resolved' | 'pending' | 'declined';
  timestamp: string;
  tokenId: string;
  lat?: number;
  lng?: number;
  nearestJunction?: string;
  affectedRoads?: string[];
}

export interface Token {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  status: 'active' | 'resolved' | 'pending';
  timestamp: string;
  description: string;
  generatedBy: string;
  lat?: number;
  lng?: number;
  mapImage?: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  tokenId?: string;
  timestamp: string;
  read: boolean;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  rainProbability: number;
  trafficImpact: 'low' | 'moderate' | 'high';
  condition: string;
}

export interface AIRecommendation {
  nodeId: string;
  recommendations: string[];
  confidence: number;
  predictedCongestion: 'low' | 'moderate' | 'high' | 'critical';
}

// ============ NEW FEATURE TYPES ============

export type EventType =
  | 'Football Match'
  | 'Festival'
  | 'Political Rally'
  | 'Procession'
  | 'VIP Visit'
  | 'Road Work'
  | 'Custom Event';

export interface PlannedEvent {
  id: string;
  name: string;
  type: EventType;
  date: string; // ISO date (yyyy-MM-dd)
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  expectedAttendance: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  areaType: 'pin' | 'zone' | 'polygon';
  lat?: number;
  lng?: number;
  polygon?: [number, number][];
  zoneName?: string;
  tokenId: string;
  createdAt: string;
}

export type AnomalyType =
  | 'Accident'
  | 'Illegal Parking'
  | 'Road Block'
  | 'Vehicle Breakdown'
  | 'Crowd Gathering';

export interface DroneAnomaly {
  id: string;
  type: AnomalyType;
  droneId: string;
  droneName: string;
  location: string;
  lat: number;
  lng: number;
  timestamp: string;
  confidence: number;
  imageSeed: string; // used to generate a deterministic placeholder image
  tokenId: string;
}

export interface RoadHealth {
  id: string;
  name: string;
  score: number; // 0-100
  status: 'good' | 'fair' | 'poor' | 'critical';
  lastInspected: string;
  issues: string[];
}

export type PredictionWindow = 'current' | '20min' | '1hr' | '2hr';

export interface NodePrediction {
  density: number;
  vehicleCount: number;
  avgSpeed: number;
  congestion: 'low' | 'moderate' | 'high' | 'critical';
  confidence: number;
}

export type SimulationAction =
  | 'Increase Signal Time'
  | 'Reduce Signal Time'
  | 'Close Road'
  | 'Divert Traffic'
  | 'Increase Event Attendance';

export interface SimulationResult {
  action: SimulationAction;
  nodeId: string;
  nodeName: string;
  congestionReduction: number; // percent
  travelTime: string;
  trafficDensity: number;
  requiredOfficers: number;
  requiredDrones: number;
  tokenId: string;
  timestamp: string;
}

export interface RoadLinkMetadata {
  name: string;
  type: string;
  lengthKm: number;
  healthId: string;
  baseSpeed: number;
}

export type UserRole = 'supervisor' | 'operator' | 'technician';

