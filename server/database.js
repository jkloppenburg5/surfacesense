const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Define PEM file path
const rdsSslPemFile = path.join(__dirname, 'rds-combined-ca-bundle.pem');

const pool = new Pool({
  host: process.env.pgHost,
  user: process.env.pgUser,
  password: process.env.pgPassword,
  port: process.env.pgPort,
  database: process.env.targetDB,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(rdsSslPemFile).toString()
  }
});

module.exports = { pool };


async function insertSensorRecord(r) {
  console.log("insertSensorRecord called with:", r);
  try {
    const query = `
      INSERT INTO surface_sensor_data (
        recorded_at, latitude, longitude,
        altitude, altitude_msl,
        x, y, z,
        speed, bearing,
        speed_accuracy, bearing_accuracy,
        horizontal_accuracy, vertical_accuracy,
        seconds_elapsed, raw_unix
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    `;

    const params = [
      r.recorded_at || new Date(),  // default timestamp
      safeNum(r.latitude),
      safeNum(r.longitude),
      safeNum(r.altitude),
      safeNum(r.altitude_msl),
      safeNum(r.x),
      safeNum(r.y),
      safeNum(r.z),
      safeNum(r.speed),
      safeNum(r.bearing),
      safeNum(r.speed_accuracy),
      safeNum(r.bearing_accuracy),
      safeNum(r.horizontal_accuracy),
      safeNum(r.vertical_accuracy),
      safeNum(r.seconds_elapsed),
      r.raw_unix ? Number(r.raw_unix) : null,
    ];

    await pool.query(query, params);

  } catch (err) {
    console.error("❌ DB Insert Error:", err.message);
    throw err;
  }
}

// Convert values to numbers or null (prevents NaN)
function safeNum(v) {
  const n = Number(v);
  return isNaN(n) ? null : n;
}

async function getSensorData(limit = 100) {
  try {
    const result = await pool.query(`
      SELECT id, recorded_at, latitude, longitude, altitude, x, y, z, speed
      FROM surface_sensor_data
      ORDER BY recorded_at DESC
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch (err) {
    console.error("❌ DB Query Error:", err.message);
    throw err;
  }
}

console.log("database.js exports insertSensorRecord:", insertSensorRecord);
module.exports = { insertSensorRecord, getSensorData };
