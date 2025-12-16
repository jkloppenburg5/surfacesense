// server/server.js - Express API server for sensor data processing
/*
SENSOR DATA API SERVER - EXPRESS.JS BACKEND

PURPOSE:
• REST API for sensor data ingestion and processing
• Map-matching and surface classification pipeline
• File upload with validation
• Database interaction layer

KEY ENDPOINTS:
• GET  /api/sensor-data       - Retrieve stored sensor readings
• POST /sensor                - Insert single sensor record
• POST /api/check-granularity - Validate file sampling rate
• POST /api/upload            - Upload and parse CSV files
• GET  /routes/reconstructed  - Generate map-matched routes
• GET  /api/classify          - Classify road surfaces via Python ML

ARCHITECTURE:
• Express.js REST API with CORS support
• PostgreSQL integration via connection pool
• Multer for file upload handling
• Turf.js for geospatial calculations
• OSRM for map-matching (OpenStreetMap)
• Python integration for machine learning classification

EXTERNAL SERVICES:
• OSRM Demo Server (router.project-osrm.org) - Map matching
• Python classifier (classify_surface.py)    - Surface analysis

DATA FLOW:
Upload → Validation → DB Insert → Map Matching → Classification → Visualization
*/

const express = require("express");
const cors = require("cors");
require("dotenv").config();  // Load environment variables from .env file
const { insertSensorRecord, getSensorData } = require('./database.js');

const app = express();
const PORT = 8000;

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });  // Store files in memory

const { checkGranularity } = require("./granularityCheck.js");    // Sampling rate validation
const { parseCsvAndInsert } = require("./parsers/csvParser.js");  // CSV processing
console.log("parseCsvAndInsert:", parseCsvAndInsert);  // Debug log

// --- NEW: Dependencies for advanced features ---
const axios = require('axios');      // HTTP client for OSRM API calls
const turf = require('@turf/turf');  // Geospatial analysis library
const { pool } = require('./database.js');   // Database connection for direct queries

// Python integration for machine learning classification
const { spawn } = require("child_process");

// Parse JSON bodies (required for POST endpoints)
app.use(express.json());

// Serve static files from "public" directory (frontend HTML/CSS/JS)
app.use(express.static('public'));

// Enable CORS for cross-origin requests (development/testing)
app.use(cors());

// Python classifier wrapper with enhanced debugging
function runPythonClassifier(points) {
  return new Promise((resolve, reject) => {
    // Spawn Python process with classifier script
    const py = spawn("python3", ["classifier/classify_surface.py"]);

    let output = "";
    let error = "";

    // Capture Python stdout with debug logging
    py.stdout.on("data", d => {
      const s = d.toString();
      console.log("🐍 PY STDOUT:", s);  // Debug prefix for Python output
      output += s;
    });

    // Capture Python stderr with debug logging
    py.stderr.on("data", d => {
      const s = d.toString();
      console.error("🐍 PY STDERR:", s);  // Error prefix for Python errors
      error += s;
    });

    // Handle process completion
    py.on("close", code => {
      console.log("🐍 PY EXIT CODE:", code);
      if (code !== 0) return reject(error);  // Non-zero exit indicates failure
      resolve(JSON.parse(output));           // Parse successful JSON output
    });

    // Send data to Python stdin (JSON format)
    py.stdin.write(JSON.stringify({ data: points }));
    py.stdin.end();  // Close stdin to signal end of input
  });
}

// ============================================================================
// BASIC API ENDPOINTS
// ============================================================================

// Simple hello route for testing server connectivity
app.get('/hello', (req, res) => {
  res.send({ message: "Hello to You" });
});

// Test ping route for health checks
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Return the latest sensor data from database
app.get('/api/sensor-data', async (req, res) => {
  try {
    const rows = await getSensorData();  // Fetch from database
    res.json(rows);
  } catch (err) {
    console.error('DB query error:', err);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});

// Single sensor data insert endpoint
app.post('/sensor', async (req, res) => {
  const json = req.body;

  try {
    await insertSensorRecord(json);  // Insert into database
    res.json({ status: 'ok' });
  } catch (err) {
    console.error('DB insert error:', err);
    res.status(500).json({ error: 'db insert failed' });
  }
});

// ============================================================================
// FILE UPLOAD ENDPOINTS
// ============================================================================

// Pre-upload granularity check - validates sampling rate before full upload
app.post("/api/check-granularity", upload.single("file"), async (req, res) => {
  try {
      const fileBuffer = req.file.buffer;
      const result = checkGranularity(fileBuffer);  // Analyze sampling interval

      res.json(result);
  } catch (err) {
      console.error("Granularity check failed:", err);
      res.status(400).json({ error: "Failed to analyze granularity" });
  }
});

// Full upload endpoint - processes CSV and inserts into database
app.post("/api/upload", upload.single("file"), async (req, res) => {
console.log("REQ FILE:", req.file);   // Debug log
console.log("REQ BODY:", req.body);   // Debug log

  try {
      await parseCsvAndInsert(req.file.buffer);  // Parse CSV and insert records
      res.json({ status: "ok" });
  } catch (err) {
      console.error("Upload failed:", err);
      res.status(500).json({ error: "Failed to process file" });
  }
});

// ============================================================================
// ADVANCED PROCESSING ENDPOINTS
// ============================================================================

// Map-matched route reconstruction using OSRM
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

    // Format points for processing
    const pts = result.rows.map(r => ({
      id: r.id,
      t: new Date(r.recorded_at).getTime() / 1000,  // Convert to Unix timestamp
      lat: Number(r.latitude),
      lon: Number(r.longitude),
      speed: Number(r.speed),
      hAcc: Number(r.horizontal_accuracy)
    }));

    if (pts.length < 2) {
      return res.json({ segments: [] });  // Not enough points for route
    }

    // 2️⃣ Split into segments based on time/distance gaps
    let segments = [];
    let current = [pts[0]];

    for (let i = 1; i < pts.length; i++) {
      const prev = current[current.length - 1];
      const cur = pts[i];

      const dt = cur.t - prev.t;  // Time gap in seconds
      const dMeters = turf.distance(
        [prev.lon, prev.lat],
        [cur.lon, cur.lat],
        { units: 'meters' }  // Calculate geographic distance
      );

      // Split if gap too large (10s or 30m)
      if (dt > 10 || dMeters > 30) {
        segments.push(current);
        current = [cur];
      } else {
        current.push(cur);
      }
    }
    segments.push(current);  // Add final segment

    // 3️⃣ Map-match each segment using OSRM demo server
    async function matchSegment(seg) {
      if (seg.length < 2) return null;

      // Format coordinates for OSRM API: "lon,lat;lon,lat;..."
      const coords = seg.map(p => `${p.lon},${p.lat}`).join(';');

      const url = `http://router.project-osrm.org/match/v1/driving/${coords}?geometries=geojson&overview=full`;

      try {
        const r = await axios.get(url);
        if (!r.data.matchings || r.data.matchings.length === 0) return null;

        return r.data.matchings[0].geometry; // Extract GeoJSON LineString
      } catch (err) {
        console.error("OSRM error:", err.message);
        return null;
      }
    }

    // Process all segments in sequence
    const matched = [];
    for (const seg of segments) {
      const geom = await matchSegment(seg);
      matched.push({
        raw_points: seg,     // Original GPS points
        matched_line: geom   // Map-matched geometry (or null)
      });
    }

    // Return results
    res.json({
      count: matched.length,
      segments: matched
    });

  } catch (err) {
    console.error("❌ /routes/reconstructed error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Surface classification endpoint - uses Python ML model
app.get('/api/classify', async (req, res) => {
  try {
    // Query acceleration data (x,y,z) for classification
    // const result = await pool.query(`
    //   SELECT 
    //     EXTRACT(EPOCH FROM recorded_at) AS t,  // Unix timestamp
    //     x, y, z,
    //     latitude AS lat,
    //     longitude AS lon
    //   FROM surface_sensor_data
    //   WHERE x IS NOT NULL AND y IS NOT NULL AND z IS NOT NULL
    //   ORDER BY recorded_at ASC
    // `);
    const result = await pool.query(`
      SELECT 
        EXTRACT(EPOCH FROM recorded_at) AS t,
        "x", "y", "z",
        latitude AS lat,
        longitude AS lon
      FROM surface_sensor_data
      WHERE "x" IS NOT NULL
        AND "y" IS NOT NULL
        AND "z" IS NOT NULL
      ORDER BY recorded_at ASC
    `);


    // Format data for Python classifier
    const points = result.rows.map(r => ({
      t: Number(r.t),
      x: Number(r.x),
      y: Number(r.y),
      z: Number(r.z),
      lat: Number(r.lat),
      lon: Number(r.lon)
    }));

    // Run Python classification
    const segments = await runPythonClassifier(points);

    res.json({ count: segments.length, segments });

  } catch (err) {
    console.error("❌ Classification error:", err);
    res.status(500).json({ error: "Classification failed" });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Single server listener (IMPORTANT: Only one app.listen per server)
app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});