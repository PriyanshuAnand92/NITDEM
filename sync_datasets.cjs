const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const XLSX = require('xlsx');

const publicDir = path.join(__dirname, 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

let prevI1aHash = '';
let prevO1Hash = '';
let prevI1bHash = '';
let prevI2Hash = '';

// Helper to compute MD5 hash of a file
function getFileHash(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch (err) {
    return '';
  }
}

// DMS to Decimal degrees converter
function dmsToDecimal(dmsStr) {
  if (!dmsStr) return 0;
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

function syncI1a() {
  return new Promise((resolve) => {
    const timestampStr = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tmpI1a = path.join(publicDir, `I1a_${timestampStr}.xlsx.tmp`);
    const finalI1a = path.join(publicDir, 'I1a.xlsx');
    const finalJson = path.join(publicDir, 'I1a.json');
    const tmpJson = path.join(publicDir, `I1a_${timestampStr}.json.tmp`);

    console.log(`[${new Date().toLocaleTimeString()}] GCS Sync: Fetching I1a.xlsx...`);
    exec(`gsutil cp gs://database_new/I1a.xlsx "${tmpI1a}"`, (err) => {
      if (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Error downloading I1a.xlsx:`, err.message);
        resolve();
        return;
      }

      const newHash = getFileHash(tmpI1a);
      if (newHash && newHash === prevI1aHash && fs.existsSync(finalJson)) {
        console.log(`[${new Date().toLocaleTimeString()}] I1a.xlsx is unchanged (MD5 matches). Skipping parse.`);
        try {
          fs.renameSync(tmpI1a, finalI1a);
        } catch (renameErr) {
          try { fs.unlinkSync(tmpI1a); } catch (e) {}
        }
        resolve();
        return;
      }

      console.log(`[${new Date().toLocaleTimeString()}] I1a.xlsx updated. Parsing...`);
      const parseStart = Date.now();
      try {
        const workbook = XLSX.readFile(tmpI1a);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`[${new Date().toLocaleTimeString()}] Parsed ${jsonData.length} xlsx rows in ${Date.now() - parseStart}ms. Grouping...`);

        const linkCoords = {};
        const dataGrouped = {};
        const uniqueTimes = new Set();

        jsonData.forEach(row => {
          const rawLinkId = String(row.link_id || '').trim();
          const linkId = rawLinkId.startsWith('L') ? rawLinkId : `L${rawLinkId}`;
          const startLat = String(row.start_lat || '').trim();
          const startLon = String(row.start_lon || '').trim();
          const endLat = String(row.end_lat || '').trim();
          const endLon = String(row.end_lon || '').trim();

          const startLatDec = dmsToDecimal(startLat);
          const startLonDec = dmsToDecimal(startLon);
          const endLatDec = dmsToDecimal(endLat);
          const endLonDec = dmsToDecimal(endLon);

          const hasCoords = startLatDec !== 0 && startLonDec !== 0 && endLatDec !== 0 && endLonDec !== 0;
                            
          if (hasCoords) {
            const current = linkCoords[linkId];
            const isPlaceholder = !current || current.startLatDec === 0 || current.startLonDec === 0;
            if (isPlaceholder) {
              linkCoords[linkId] = {
                startLat,
                startLon,
                endLat,
                endLon,
                startLatDec,
                startLonDec,
                endLatDec,
                endLonDec
              };
            }
          }

          const timestamp = String(row.timestamp || '').trim();
          if (timestamp) {
            uniqueTimes.add(timestamp);
            if (!dataGrouped[timestamp]) {
              dataGrouped[timestamp] = [];
            }
            dataGrouped[timestamp].push({
              linkId,
              travelTime: parseFloat(row.travel_time) || 0,
              speed: parseFloat(row.speed) || 0,
              volume: parseFloat(row.volume) || 0,
              queueDelay: parseFloat(row.queue_delay) || 0,
              vehDelay: parseFloat(row.veh_delay) || 0,
              stops: parseFloat(row.stops) || 0,
              occupancy: parseFloat(row.occupancy) || 0,
              queueLength: parseFloat(row.queue_length) || 0,
              maxQueueLength: parseFloat(row.max_queue_length) || 0
            });
          }
        });

        const outputData = {
          uniqueTimestamps: Array.from(uniqueTimes).sort(),
          linkCoords,
          coordsByTimestamp: dataGrouped
        };

        fs.writeFileSync(tmpJson, JSON.stringify(outputData));
        
        let jsonRenamed = false;
        try {
          fs.renameSync(tmpJson, finalJson);
          jsonRenamed = true;
        } catch (jsonErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Error releasing I1a.json:`, jsonErr.message);
          try { fs.unlinkSync(tmpJson); } catch (e) {}
        }

        try {
          fs.renameSync(tmpI1a, finalI1a);
        } catch (xlsxErr) {
          try { fs.unlinkSync(tmpI1a); } catch (e) {}
        }

        if (jsonRenamed) {
          prevI1aHash = newHash;
          console.log(`[${new Date().toLocaleTimeString()}] I1a.json generated successfully (${(fs.statSync(finalJson).size / (1024 * 1024)).toFixed(2)} MB).`);
        }
      } catch (parseErr) {
        console.error(`[${new Date().toLocaleTimeString()}] Error parsing I1a.xlsx:`, parseErr.message);
        try { fs.unlinkSync(tmpI1a); } catch (e) {}
        try { fs.unlinkSync(tmpJson); } catch (e) {}
      }
      resolve();
    });
  });
}

function syncO1() {
  return new Promise((resolve) => {
    const timestampStr = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tmpO1 = path.join(publicDir, `O1_${timestampStr}.xlsx.tmp`);
    const finalO1 = path.join(publicDir, 'O1.xlsx');
    const finalJson = path.join(publicDir, 'O1.json');
    const tmpJson = path.join(publicDir, `O1_${timestampStr}.json.tmp`);

    console.log(`[${new Date().toLocaleTimeString()}] GCS Sync: Fetching O1.xlsx...`);
    exec(`gsutil cp gs://database_new/O1.xlsx "${tmpO1}"`, (err) => {
      if (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Error downloading O1.xlsx:`, err.message);
        resolve();
        return;
      }

      const newHash = getFileHash(tmpO1);
      if (newHash && newHash === prevO1Hash && fs.existsSync(finalJson)) {
        console.log(`[${new Date().toLocaleTimeString()}] O1.xlsx is unchanged (MD5 matches). Skipping parse.`);
        try {
          fs.renameSync(tmpO1, finalO1);
        } catch (renameErr) {
          try { fs.unlinkSync(tmpO1); } catch (e) {}
        }
        resolve();
        return;
      }

      console.log(`[${new Date().toLocaleTimeString()}] O1.xlsx updated. Parsing...`);
      try {
        const workbook = XLSX.readFile(tmpO1);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const mapped = jsonData.map(row => {
          const rawLink = String(row['Link ID'] || '').trim();
          const link = rawLink.startsWith('L') ? rawLink : `L${rawLink}`;
          
          let predAtStr = String(row['Predicted at'] || '').trim();
          
          if (!isNaN(Number(predAtStr)) && Number(predAtStr) > 0 && Number(predAtStr) < 1) {
            const totalSec = Math.round(Number(predAtStr) * 86400);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            predAtStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          }
          
          const timeParts = predAtStr.split(':').map(Number);
          const h = timeParts[0] || 0;
          const m = timeParts[1] || 0;
          const s = timeParts[2] || 0;
          const predictionHorizonSec = h * 3600 + m * 60 + s;

          const isBottleneck = row['Bottleneck'] === 1 || row['Bottleneck'] === '1';
          const severityLevel = isBottleneck ? 'CRITICAL' : 'LOW';
          const severityIndex = isBottleneck ? 85.0 : 10.0;

          const rawStrategy = String(row['Management Strategy'] || '').trim();
          const recommendedStrategy = (rawStrategy === '' || rawStrategy === '0') ? 'No measures required' : rawStrategy;

          return {
            predictionHorizonSec,
            link,
            queueTrue: isBottleneck ? 0.35 : 0.05,
            queuePred: isBottleneck ? 0.85 : 0.12,
            delayTrue: isBottleneck ? 15.0 : 2.5,
            delayPred: isBottleneck ? 55.0 : 4.8,
            predictionHorizonMin: 20,
            severityIndex,
            severityLevel,
            recommendedStrategy
          };
        });

        fs.writeFileSync(tmpJson, JSON.stringify(mapped));
        
        let jsonRenamed = false;
        try {
          fs.renameSync(tmpJson, finalJson);
          jsonRenamed = true;
        } catch (jsonErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Error releasing O1.json:`, jsonErr.message);
          try { fs.unlinkSync(tmpJson); } catch (e) {}
        }

        try {
          fs.renameSync(tmpO1, finalO1);
        } catch (xlsxErr) {
          try { fs.unlinkSync(tmpO1); } catch (e) {}
        }

        if (jsonRenamed) {
          prevO1Hash = newHash;
          console.log(`[${new Date().toLocaleTimeString()}] O1.json generated successfully.`);
        }
      } catch (parseErr) {
        console.error(`[${new Date().toLocaleTimeString()}] Error parsing O1.xlsx:`, parseErr.message);
        try { fs.unlinkSync(tmpO1); } catch (e) {}
        try { fs.unlinkSync(tmpJson); } catch (e) {}
      }
      resolve();
    });
  });
}

function syncI1b() {
  return new Promise((resolve) => {
    const timestampStr = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tmpI1b = path.join(publicDir, `I1b_${timestampStr}.xlsx.tmp`);
    const finalI1b = path.join(publicDir, 'I1b.xlsx');
    const finalJson = path.join(publicDir, 'I1b.json');
    const tmpJson = path.join(publicDir, `I1b_${timestampStr}.json.tmp`);

    console.log(`[${new Date().toLocaleTimeString()}] GCS Sync: Fetching I1b.xlsx...`);
    exec(`gsutil cp gs://database_new/I1b.xlsx "${tmpI1b}"`, (err) => {
      if (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Error downloading I1b.xlsx:`, err.message);
        resolve();
        return;
      }

      const newHash = getFileHash(tmpI1b);
      if (newHash && newHash === prevI1bHash && fs.existsSync(finalJson)) {
        console.log(`[${new Date().toLocaleTimeString()}] I1b.xlsx is unchanged (MD5 matches). Skipping parse.`);
        try {
          fs.renameSync(tmpI1b, finalI1b);
        } catch (renameErr) {
          try { fs.unlinkSync(tmpI1b); } catch (e) {}
        }
        resolve();
        return;
      }

      console.log(`[${new Date().toLocaleTimeString()}] I1b.xlsx updated. Parsing...`);
      const parseStart = Date.now();
      try {
        const workbook = XLSX.readFile(tmpI1b);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log(`[${new Date().toLocaleTimeString()}] Parsed ${jsonData.length} xlsx rows in ${Date.now() - parseStart}ms. Grouping...`);

        const linkCoords = {};
        const dataGrouped = {};
        const uniqueTimes = new Set();

        jsonData.forEach(row => {
          const rawLinkId = String(row.link_id || '').trim();
          const linkId = rawLinkId.startsWith('L') ? rawLinkId : `L${rawLinkId}`;
          const startLat = String(row.start_lat || '').trim();
          const startLon = String(row.start_lon || '').trim();
          const endLat = String(row.end_lat || '').trim();
          const endLon = String(row.end_lon || '').trim();

          const startLatDec = dmsToDecimal(startLat);
          const startLonDec = dmsToDecimal(startLon);
          const endLatDec = dmsToDecimal(endLat);
          const endLonDec = dmsToDecimal(endLon);

          const hasCoords = startLatDec !== 0 && startLonDec !== 0 && endLatDec !== 0 && endLonDec !== 0;
                            
          if (hasCoords) {
            const current = linkCoords[linkId];
            const isPlaceholder = !current || current.startLatDec === 0 || current.startLonDec === 0;
            if (isPlaceholder) {
              linkCoords[linkId] = {
                startLat,
                startLon,
                endLat,
                endLon,
                startLatDec,
                startLonDec,
                endLatDec,
                endLonDec
              };
            }
          }

          const timestamp = String(row.timestamp || '').trim();
          if (timestamp) {
            uniqueTimes.add(timestamp);
            if (!dataGrouped[timestamp]) {
              dataGrouped[timestamp] = [];
            }
            dataGrouped[timestamp].push({
              linkId,
              eventActive: parseInt(row.event_active) || 0,
              eventExposure: parseFloat(row.event_exposure) || 0,
              eventIntensity: parseFloat(row.event_intensity) || 0,
              lanesBlocked: parseInt(row.lanes_blocked) || 0,
              eventLink: parseInt(row['Event link']) || 0
            });
          }
        });

        const outputData = {
          uniqueTimestamps: Array.from(uniqueTimes).sort(),
          linkCoords,
          coordsByTimestamp: dataGrouped
        };

        fs.writeFileSync(tmpJson, JSON.stringify(outputData));
        
        let jsonRenamed = false;
        try {
          fs.renameSync(tmpJson, finalJson);
          jsonRenamed = true;
        } catch (jsonErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Error releasing I1b.json:`, jsonErr.message);
          try { fs.unlinkSync(tmpJson); } catch (e) {}
        }

        try {
          fs.renameSync(tmpI1b, finalI1b);
        } catch (xlsxErr) {
          try { fs.unlinkSync(tmpI1b); } catch (e) {}
        }

        if (jsonRenamed) {
          prevI1bHash = newHash;
          console.log(`[${new Date().toLocaleTimeString()}] I1b.json generated successfully (${(fs.statSync(finalJson).size / (1024 * 1024)).toFixed(2)} MB).`);
        }
      } catch (parseErr) {
        console.error(`[${new Date().toLocaleTimeString()}] Error parsing I1b.xlsx:`, parseErr.message);
        try { fs.unlinkSync(tmpI1b); } catch (e) {}
        try { fs.unlinkSync(tmpJson); } catch (e) {}
      }
      resolve();
    });
  });
}

function syncI2() {
  return new Promise((resolve) => {
    const timestampStr = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const tmpI2 = path.join(publicDir, `I2_${timestampStr}.xlsx.tmp`);
    const finalI2 = path.join(publicDir, 'I2.xlsx');
    const finalJson = path.join(publicDir, 'I2.json');
    const tmpJson = path.join(publicDir, `I2_${timestampStr}.json.tmp`);

    console.log(`[${new Date().toLocaleTimeString()}] GCS Sync: Fetching I2.xlsx...`);
    exec(`gsutil cp gs://database_new/I2.xlsx "${tmpI2}"`, (err) => {
      if (err) {
        console.error(`[${new Date().toLocaleTimeString()}] Error downloading I2.xlsx:`, err.message);
        resolve();
        return;
      }

      const newHash = getFileHash(tmpI2);
      if (newHash && newHash === prevI2Hash && fs.existsSync(finalJson)) {
        console.log(`[${new Date().toLocaleTimeString()}] I2.xlsx is unchanged (MD5 matches). Skipping parse.`);
        try {
          fs.renameSync(tmpI2, finalI2);
        } catch (renameErr) {
          try { fs.unlinkSync(tmpI2); } catch (e) {}
        }
        resolve();
        return;
      }

      console.log(`[${new Date().toLocaleTimeString()}] I2.xlsx updated. Parsing...`);
      try {
        const workbook = XLSX.readFile(tmpI2);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const mapped = jsonData.map(row => {
          const rawLink = String(row['Link ID'] || '').trim();
          const link = rawLink.startsWith('L') ? rawLink : `L${rawLink}`;
          
          let predAtStr = String(row['Predicted at'] || '').trim();
          
          if (!isNaN(Number(predAtStr)) && Number(predAtStr) > 0 && Number(predAtStr) < 1) {
            const totalSec = Math.round(Number(predAtStr) * 86400);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            predAtStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          }
          
          const timeParts = predAtStr.split(':').map(Number);
          const h = timeParts[0] || 0;
          const m = timeParts[1] || 0;
          const s = timeParts[2] || 0;
          const predictionHorizonSec = h * 3600 + m * 60 + s;

          const isBottleneck = row['Bottleneck'] === 1 || row['Bottleneck'] === '1';
          const vehicleDelay = parseFloat(row['Vehicle Delay (min)']) || 0;
          const queueLength = parseFloat(row['Queue Length (m)']) || 0;
          const dissipationTime = parseFloat(row['Dissipation Time (min)']) || 0;

          return {
            predictionHorizonSec,
            link,
            isBottleneck,
            vehicleDelay,
            queueLength,
            dissipationTime,
            predictedFor: String(row['Predicted for'] || '').trim()
          };
        });

        fs.writeFileSync(tmpJson, JSON.stringify(mapped));
        
        let jsonRenamed = false;
        try {
          fs.renameSync(tmpJson, finalJson);
          jsonRenamed = true;
        } catch (jsonErr) {
          console.error(`[${new Date().toLocaleTimeString()}] Error releasing I2.json:`, jsonErr.message);
          try { fs.unlinkSync(tmpJson); } catch (e) {}
        }

        try {
          fs.renameSync(tmpI2, finalI2);
        } catch (xlsxErr) {
          try { fs.unlinkSync(tmpI2); } catch (e) {}
        }

        if (jsonRenamed) {
          prevI2Hash = newHash;
          console.log(`[${new Date().toLocaleTimeString()}] I2.json generated successfully.`);
        }
      } catch (parseErr) {
        console.error(`[${new Date().toLocaleTimeString()}] Error parsing I2.xlsx:`, parseErr.message);
        try { fs.unlinkSync(tmpI2); } catch (e) {}
        try { fs.unlinkSync(tmpJson); } catch (e) {}
      }
      resolve();
    });
  });
}

async function runSyncCycle() {
  try {
    await Promise.all([syncI1a(), syncO1(), syncI1b(), syncI2()]);
  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Error in sync cycle:`, err);
  }
  // Schedule next run in 5 seconds
  setTimeout(runSyncCycle, 5000);
}

// Start first cycle
runSyncCycle();
