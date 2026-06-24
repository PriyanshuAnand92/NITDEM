import * as XLSX from 'xlsx';

export interface CSVTelemetry {
  timestamp: string;
  densityPercent: number;
  latitude: number;
  longitude: number;
}

export interface CSVDensityFrame {
  frame: number;
  densityPercentage: number;
}

export interface GCSLinkData {
  scenarioCode?: string;
  timeS?: string;
  timestamp?: string;
  linkId: string;
  travelTime: number;
  speed: number;
  volume: number;
  queueDelay: number;
  vehDelay: number;
  stops: number;
  occupancy: number;
  queueLength: number;
  maxQueueLength: number;
  eventActive?: boolean;
  eventExposure?: number;
  eventIntensity?: number;
  lanesBlocked?: number;
  startLat?: string;
  startLon?: string;
  endLat?: string;
  endLon?: string;
  startLatDec?: number;
  startLonDec?: number;
  endLatDec?: number;
  endLonDec?: number;
}

export function dmsToDecimal(dmsStr: string): number {
  if (!dmsStr) return 0;
  // Normalize DMS string characters to spaces, split, and calculate decimal
  const cleaned = dmsStr.replace(/[°'"’“”NnEeSsWw\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ');
  if (parts.length >= 3) {
    const degrees = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    const upperStr = dmsStr.toUpperCase();
    if (upperStr.includes('S') || upperStr.includes('W')) {
      decimal = -decimal;
    }
    return parseFloat(decimal.toFixed(6));
  }
  return parseFloat(dmsStr) || 0;
}

export function parseCoordinatesCSV(text: string): GCSLinkData[] {
  const lines = text.trim().split('\n');
  const results: GCSLinkData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const delimiter = line.includes('\t') ? '\t' : ',';
    const parts = line.split(delimiter);
    if (parts.length >= 15) {
      const rawLinkId = parts[1].trim();
      const linkId = rawLinkId.startsWith('L') ? rawLinkId : `L${rawLinkId}`;
      
      const startLat = parts[2].trim();
      const startLon = parts[3].trim();
      const endLat = parts[4].trim();
      const endLon = parts[5].trim();

      results.push({
        scenarioCode: 'SC0011',
        timeS: '600-900',
        timestamp: parts[0].trim(),
        linkId,
        startLat,
        startLon,
        endLat,
        endLon,
        startLatDec: dmsToDecimal(startLat),
        startLonDec: dmsToDecimal(startLon),
        endLatDec: dmsToDecimal(endLat),
        endLonDec: dmsToDecimal(endLon),
        travelTime: parseFloat(parts[6]) || 0,
        speed: parseFloat(parts[7]) || 0,
        volume: parseFloat(parts[8]) || 0,
        queueDelay: parseFloat(parts[9]) || 0,
        vehDelay: parseFloat(parts[10]) || 0,
        stops: parseFloat(parts[11]) || 0,
        occupancy: parseFloat(parts[12]) || 0,
        queueLength: parseFloat(parts[13]) || 0,
        maxQueueLength: parseFloat(parts[14]) || 0,
        eventActive: false,
        eventExposure: 0,
        eventIntensity: 0,
        lanesBlocked: 0
      });
    }
  }
  return results;
}

export interface GCSPredictionData {
  predictionHorizonSec: number;
  link: string;
  queueTrue: number;
  queuePred: number;
  delayTrue: number;
  delayPred: number;
  predictionHorizonMin: number;
  severityIndex: number;
  severityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommendedStrategy: string;
}

export function parseTelemetryCSV(text: string): CSVTelemetry[] {
  const lines = text.trim().split('\n');
  const results: CSVTelemetry[] = [];
  
  // Skip header line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 4) {
      results.push({
        timestamp: parts[0],
        densityPercent: parseFloat(parts[1]),
        latitude: parseFloat(parts[2]),
        longitude: parseFloat(parts[3])
      });
    }
  }
  
  return results;
}

export function parseDensityCSV(text: string): CSVDensityFrame[] {
  const lines = text.trim().split('\n');
  const results: CSVDensityFrame[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 2) {
      results.push({
        frame: parseInt(parts[0], 10),
        densityPercentage: parseFloat(parts[1])
      });
    }
  }
  
  return results;
}

export function parseXLSXData(buffer: ArrayBuffer): GCSLinkData[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
  
  return jsonData.map(row => ({
    scenarioCode: row.scenario_code || '',
    timeS: row.time_s || '',
    linkId: row.link_id || '',
    travelTime: parseFloat(row.travel_time) || 0,
    speed: parseFloat(row.speed) || 0,
    volume: parseFloat(row.volume) || 0,
    queueDelay: parseFloat(row.queue_delay) || 0,
    vehDelay: parseFloat(row.veh_delay) || 0,
    stops: parseFloat(row.stops) || 0,
    occupancy: parseFloat(row.occupancy) || 0,
    queueLength: parseFloat(row.queue_length) || 0,
    maxQueueLength: parseFloat(row.max_queue_length) || 0,
    eventActive: row.event_active === 1 || row.event_active === '1' || row.event_active === true,
    eventExposure: parseFloat(row.event_exposure) || 0,
    eventIntensity: parseFloat(row.event_intensity) || 0,
    lanesBlocked: parseInt(row.lanes_blocked) || 0
  }));
}

export function parsePredictionsCSV(text: string): GCSPredictionData[] {
  const lines = text.trim().split('\n');
  const results: GCSPredictionData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 10) {
      results.push({
        predictionHorizonSec: parseFloat(parts[0]) || 0,
        link: parts[1],
        queueTrue: parseFloat(parts[2]) || 0,
        queuePred: parseFloat(parts[3]) || 0,
        delayTrue: parseFloat(parts[4]) || 0,
        delayPred: parseFloat(parts[5]) || 0,
        predictionHorizonMin: parseFloat(parts[6]) || 0,
        severityIndex: parseFloat(parts[7]) || 0,
        severityLevel: (parts[8].toUpperCase() as any) || 'LOW',
        recommendedStrategy: parts[9].replace(/^"|"$/g, '')
      });
    }
  }
  return results;
}

export function parseLink1CSV(text: string): GCSLinkData[] {
  const lines = text.trim().split('\n');
  const results: GCSLinkData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(',');
    if (parts.length >= 16) {
      results.push({
        scenarioCode: parts[0],
        timeS: parts[1],
        linkId: parts[2],
        travelTime: parseFloat(parts[3]) || 0,
        speed: parseFloat(parts[4]) || 0,
        volume: parseFloat(parts[5]) || 0,
        queueDelay: parseFloat(parts[6]) || 0,
        vehDelay: parseFloat(parts[7]) || 0,
        stops: parseFloat(parts[8]) || 0,
        occupancy: parseFloat(parts[9]) || 0,
        queueLength: parseFloat(parts[10]) || 0,
        maxQueueLength: parseFloat(parts[11]) || 0,
        eventActive: parts[12] === '1' || parts[12] === 'true' || parts[12] === 'true' || parts[12] === '1.0',
        eventExposure: parseFloat(parts[13]) || 0,
        eventIntensity: parseFloat(parts[14]) || 0,
        lanesBlocked: parseInt(parts[15], 10) || 0
      });
    }
  }
  return results;
}
