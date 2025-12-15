// server/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { insertSensorRecord, getSensorData } = require('./database.js');

const app = express();
const PORT = 8000;

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const { checkGranularity } = require("./granularityCheck.js");
const { parseCsvAndInsert } = require("./parsers/csvParser.js");
console.log("parseCsvAndInsert:", parseCsvAndInsert);

// --- NEW: add these at the top of server.js ---
const axios = require('axios');
const turf = require('@turf/turf');
const { pool } = require('./database.js');   // needed for SQL query

// Connect Node → Python
const { spawn } = require("child_process");

// Parse JSON bodies (required for POST /sensor)
app.use(express.json());

// Serve static files from "public"
app.use(express.static('public'));

// Enable CORS for development/testing
app.use(cors());

// // Helper for Python Classifier
// function runPythonClassifier(points) {
//   return new Promise((resolve, reject) => {
//     const py = spawn("python3", ["classifier/classify_surface.py"]);

//     let output = "";
//     let error = "";

//     py.stdout.on("data", d => output += d.toString());
//     py.stderr.on("data", d => error += d.toString());

//     py.on("close", code => {
//       if (code !== 0) return reject(error);
//       resolve(JSON.parse(output));
//     });

//     py.stdin.write(JSON.stringify({ data: points }));
//     py.stdin.end();
//   });
// }

function runPythonClassifier(points) {
  return new Promise((resolve, reject) => {
    const py = spawn("python3", ["classifier/classify_surface.py"]);

    let output = "";
    let error = "";

    py.stdout.on("data", d => {
      const s = d.toString();
      console.log("🐍 PY STDOUT:", s);
      output += s;
    });

    py.stderr.on("data", d => {
      const s = d.toString();
      console.error("🐍 PY STDERR:", s);
      error += s;
    });

    py.on("close", code => {
      console.log("🐍 PY EXIT CODE:", code);
      if (code !== 0) return reject(error);
      resolve(JSON.parse(output));
    });

    py.stdin.write(JSON.stringify({ data: points }));
    py.stdin.end();
  });
}

// Simple hello route
app.get('/hello', (req, res) => {
  res.send({ message: "Hello to You" });
});

// Test ping route
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Return the latest sensor data
app.get('/api/sensor-data', async (req, res) => {
  try {
    const rows = await getSensorData();  // fetch from DB
    res.json(rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// Sensor data insert endpoint
app.post('/sensor', async (req, res) => {
  const json = req.body;

  try {
    await insertSensorRecord(json);
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ error: 'db insert failed' });
  }
});

// Pre-upload granularity check
app.post("/api/check-granularity", upload.single("file"), async (req, res) => {
  try {
      const fileBuffer = req.file.buffer;
      const result = checkGranularity(fileBuffer);

      res.json(result);
  } catch (err) {
      console.error("Granularity check failed:", err);
      res.status(400).json({ error: "Failed to analyze granularity" });
  }
});

// Full upload + parse + DB insert

app.post("/api/upload", upload.single("file"), async (req, res) => {
console.log("REQ FILE:", req.file);
console.log("REQ BODY:", req.body);

  try {
      await parseCsvAndInsert(req.file.buffer);
      res.json({ status: "ok" });
  } catch (err) {
      console.error("Upload failed:", err);
      res.status(500).json({ error: "Failed to process file" });
  }
});

// ============================================================================
// NEW ENDPOINT: Reconstructed Road-Aligned Route Segments
// ============================================================================
app.get('/routes/reconstructed', async (req, res) => {
  try {
    // 1️⃣ Load ALL sensor points ordered by time
    const result = await pool.query(`
      SELECT 
        id,
        recorded_at,
        latitude,
        longitude,
        speed,
        horizontal_accuracy
      FROM surface_sensor_data
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY recorded_at ASC
    `);

    const pts = result.rows.map(r => ({
      id: r.id,
      t: new Date(r.recorded_at).getTime() / 1000,
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      speed: Number(r.speed),
      hAcc: Number(r.horizontal_accuracy)
    }));

    if (pts.length < 2) {
      return res.json({ segments: [] });
    }

    // 2️⃣ Split into segments when:
    //    • Time gap > 10s
    //    • Distance gap > 30m
    let segments = [];
    let current = [pts[0]];

    for (let i = 1; i < pts.length; i++) {
      const prev = current[current.length - 1];
      const cur = pts[i];

      const dt = cur.t - prev.t;
      const dMeters = turf.distance(
        [prev.lon, prev.lat],
        [cur.lon, cur.lat],
        { units: 'meters' }
      );

      if (dt > 10 || dMeters > 30) {
        segments.push(current);
        current = [cur];
      } else {
        current.push(cur);
      }
    }
    segments.push(current);

    // 3️⃣ Map-match each segment using OSRM demo server
    async function matchSegment(seg) {
      if (seg.length < 2) return null;

      const coords = seg.map(p => `${p.lon},${p.lat}`).join(';');

      const url = `http://router.project-osrm.org/match/v1/driving/${coords}?geometries=geojson&overview=full`;

      try {
        const r = await axios.get(url);
        if (!r.data.matchings || r.data.matchings.length === 0) return null;

        return r.data.matchings[0].geometry; // GeoJSON LineString
      } catch (err) {
        console.error("OSRM error:", err.message);
        return null;
      }
    }

    const matched = [];
    for (const seg of segments) {
      const geom = await matchSegment(seg);
      matched.push({
        raw_points: seg,
        matched_line: geom
      });
    }

    res.json({
      count: matched.length,
      segments: matched
    });

  } catch (err) {
    console.error("❌ /routes/reconstructed error:", err);
    res.status(500).json({ error: err.message });
  }
});

// New API route to classify entire ride
app.get('/api/classify', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        EXTRACT(EPOCH FROM recorded_at) AS t,
        x, y, z,
        latitude AS lat,
        longitude AS lon
      FROM surface_sensor_data
      WHERE x IS NOT NULL AND y IS NOT NULL AND z IS NOT NULL
      ORDER BY recorded_at ASC
    `);

    const points = result.rows.map(r => ({
      t: Number(r.t),
      x: Number(r.x),
      y: Number(r.y),
      z: Number(r.z),
      lat: Number(r.lat),
      lon: Number(r.lon)
    }));

    const segments = await runPythonClassifier(points);

    res.json({ count: segments.length, segments });

  } catch (err) {
    console.error("❌ Classification error:", err);
    res.status(500).json({ error: "Classification failed" });
  }
});

// Single server listener (IMPORTANT)
app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});