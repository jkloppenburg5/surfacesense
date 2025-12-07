// server/server.js
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { insertSensorRecord, getSensorData } = require('./database.js');   // ← keep this

const app = express();
const PORT = 8000;

// Parse JSON bodies (required for POST /sensor)
app.use(express.json());

// Serve static files from "public"
app.use(express.static('public'));

// Enable CORS for development/testing
app.use(cors());

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

// Single server listener (IMPORTANT)
app.listen(PORT, () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});