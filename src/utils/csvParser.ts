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
  scenarioCode: string;
  timeS: string;
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
  eventActive: boolean;
  eventExposure: number;
  eventIntensity: number;
  lanesBlocked: number;
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
