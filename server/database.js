// database.js - PostgreSQL connection and sensor data operations
/*
DATABASE LAYER - POSTGRESQL INTEGRATION FOR SENSOR DATA

PURPOSE:
• Establish secure SSL connection to PostgreSQL/RDS
• Provide CRUD operations for surface_sensor_data table
• Handle data type safety and error management

KEY FEATURES:
• SSL/TLS connection with custom CA certificate
• Type-safe parameter binding for SQL injection prevention
• Automatic NaN/null conversion for sensor readings
• Configurable via environment variables

ENVIRONMENT VARIABLES REQUIRED:
• pgHost, pgUser, pgPassword, pgPort, targetDB

SECURITY:
• SSL with custom CA bundle (rds-combined-ca-bundle.pem)
• Parameterized queries to prevent SQL injection
• Connection pooling for performance and resource management

EXPORTS:
• pool: PostgreSQL connection pool
• insertSensorRecord(): Insert single sensor reading
• getSensorData(): Retrieve recent sensor readings
*/

const { Pool } = require('pg');      // PostgreSQL client library
const fs = require('fs');             // File system operations
const path = require('path');         // Path manipulation utilities

// Define PEM file path for SSL certificate
// AWS RDS requires custom CA bundle for SSL connections
const rdsSslPemFile = path.join(__dirname, 'rds-combined-ca-bundle.pem');

// Create PostgreSQL connection pool with SSL configuration
const pool = new Pool({
  host: process.env.pgHost,           // Database host from environment
  user: process.env.pgUser,           // Database username
  password: process.env.pgPassword,   // Database password
  port: process.env.pgPort,           // Database port (default: 5432)
  database: process.env.targetDB,     // Target database name
  
  // SSL/TLS configuration for secure connection to AWS RDS
  ssl: {
    rejectUnauthorized: true,         // Verify SSL certificate
    ca: fs.readFileSync(rdsSslPemFile).toString()  // Custom CA bundle
  }
});

// Primary function: Insert sensor record into database
async function insertSensorRecord(r) {
  console.log("insertSensorRecord called with:", r);  // Debug logging
  
  try {
    // SQL query with parameterized placeholders ($1-$16)
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

    // Prepare parameters with type safety
    const params = [
      r.recorded_at || new Date(),     // Use provided timestamp or current time
      safeNum(r.latitude),              // Convert to number/null
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
      r.raw_unix ? Number(r.raw_unix) : null,  // Special handling for Unix timestamp
    ];

    // Execute parameterized query
    await pool.query(query, params);

  } catch (err) {
    console.error("❌ DB Insert Error:", err.message);  // Error logging with emoji
    throw err;  // Re-throw for upstream error handling
  }
}

// Utility function: Safely convert values to numbers or null
// Prevents NaN from being inserted into database
function safeNum(v) {
  const n = Number(v);          // Attempt conversion
  return isNaN(n) ? null : n;   // Return null if conversion fails
}

// Secondary function: Retrieve sensor data with limit
async function getSensorData(limit = 50000) {
  try {
    // Query recent sensor readings with parameterized limit
    const result = await pool.query(`
      SELECT
        id,
        recorded_at,
        latitude,
        longitude,
        altitude,
        x,
        y,
        z,
        speed
      FROM surface_sensor_data
      ORDER BY recorded_at DESC
      LIMIT $1
    `, [limit]);
    
    return result.rows;  // Return array of row objects
    
  } catch (err) {
    console.error("❌ DB Query Error:", err.message);
    throw err;
  }
}

// Debug logging for module exports
console.log("database.js exports insertSensorRecord:", insertSensorRecord);

// Export functions and connection pool for use in other modules
module.exports = { 
  pool,                // PostgreSQL connection pool
  insertSensorRecord,  // Insert single record function
  getSensorData        // Retrieve records function
};