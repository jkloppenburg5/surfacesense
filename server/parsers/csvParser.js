// parsers/csvParser.js - CSV parsing and database ingestion for sensor data
/*
CSV PARSER MODULE - SENSOR LOGGER DATA INGESTION

PURPOSE:
• Parse CSV files from SensorLogger app
• Transform raw CSV columns to database schema
• Batch insert sensor records into PostgreSQL

DATA MAPPING:
CSV Columns → Database Fields (0-indexed):
[0] timestamp (μs) → recorded_at (Date) & raw_unix
[1] seconds_elapsed → seconds_elapsed
[2] z → z (acceleration)
[3] y → y (acceleration)
[4] x → x (acceleration)
[5] altitude → altitude
[6] speed_accuracy → speed_accuracy
[7] bearing_accuracy → bearing_accuracy
[8] latitude → latitude
[9] altitude_msl → altitude_msl
[10] bearing → bearing
[11] horizontal_accuracy → horizontal_accuracy
[12] vertical_accuracy → vertical_accuracy
[13] longitude → longitude
[14] speed → speed

ASSUMPTIONS:
• CSV uses comma delimiter
• First line is header (skipped)
• Timestamp in microseconds (converted to milliseconds)
• 15 columns expected per row
• UTF-8 encoding
*/

// Import database insert function
const { insertSensorRecord } = require("../database.js");
console.log("insertSensorRecord after require:", insertSensorRecord);  // Debug: verify import

// Main function: Parse CSV buffer and insert records into database
async function parseCsvAndInsert(fileBuffer) {
    // Convert buffer to UTF-8 string
    const text = fileBuffer.toString("utf8");
    
    // Split into lines and filter out empty rows
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    console.log(`Total lines including header: ${lines.length}`);

    // Extract and log header (first line)
    const header = lines.shift();  // Remove header from array
    console.log("CSV Header:", header);
    console.log(`Rows to process: ${lines.length}`);

    let insertedCount = 0;  // Success counter

    // Process each data row
    for (const line of lines) {
        // Split by comma delimiter
        const cols = line.split(",");
        
        // Validate column count (expect 15 columns)
        if (cols.length < 15) {
            console.warn("Skipping malformed line:", line);
            continue;  // Skip incomplete rows
        }

        // Create record object mapping CSV columns to database fields
        const record = {
            // Column 0: Convert microseconds to milliseconds for Date object
            recorded_at: new Date(Number(cols[0]) / 1e6),
            // Preserve raw Unix timestamp in microseconds
            raw_unix: Number(cols[0]),
            
            // Column 1: Time elapsed since start
            seconds_elapsed: Number(cols[1]),
            
            // Columns 2-4: Acceleration data (z, y, x)
            z: Number(cols[2]),
            y: Number(cols[3]),
            x: Number(cols[4]),
            
            // Column 5: Altitude above ground
            altitude: Number(cols[5]),
            
            // Columns 6-7: Accuracy metrics
            speed_accuracy: Number(cols[6]),
            bearing_accuracy: Number(cols[7]),
            
            // Column 8: Latitude coordinate
            latitude: Number(cols[8]),
            
            // Column 9: Altitude above mean sea level
            altitude_msl: Number(cols[9]),
            
            // Column 10: Compass bearing
            bearing: Number(cols[10]),
            
            // Columns 11-12: GPS accuracy
            horizontal_accuracy: Number(cols[11]),
            vertical_accuracy: Number(cols[12]),
            
            // Column 13: Longitude coordinate
            longitude: Number(cols[13]),
            
            // Column 14: Speed in m/s
            speed: Number(cols[14]),
        };

        try {
            // Insert single record into database
            await insertSensorRecord(record);
            insertedCount++;  // Increment success counter
        } catch (err) {
            // Log error but continue processing other rows
            console.error("Insert failed for line:", line, err.message);
        }
    }

    // Final summary log
    console.log(`Inserted ${insertedCount} rows into DB`);
}

// ✅ Export the function so server.js can require it
module.exports = { parseCsvAndInsert };