
const { insertSensorRecord } = require("../database.js");
console.log("insertSensorRecord after require:", insertSensorRecord);

async function parseCsvAndInsert(fileBuffer) {
    const text = fileBuffer.toString("utf8");
    const lines = text.split("\n").filter(l => l.trim().length > 0);
    console.log(`Total lines including header: ${lines.length}`);

    const header = lines.shift();
    console.log("CSV Header:", header);
    console.log(`Rows to process: ${lines.length}`);

    let insertedCount = 0;

    for (const line of lines) {
        const cols = line.split(",");
        if (cols.length < 15) {
            console.warn("Skipping malformed line:", line);
            continue;
        }

        if (cols.length < 15) continue; // 15 columns expected

        const record = {
            recorded_at: new Date(Number(cols[0]) / 1e6), // adjust divisor based on units
            raw_unix: Number(cols[0]),
            seconds_elapsed: Number(cols[1]),
            z: Number(cols[2]),
            y: Number(cols[3]),
            x: Number(cols[4]),
            altitude: Number(cols[5]),
            speed_accuracy: Number(cols[6]),
            bearing_accuracy: Number(cols[7]),
            latitude: Number(cols[8]),
            altitude_msl: Number(cols[9]),
            bearing: Number(cols[10]),
            horizontal_accuracy: Number(cols[11]),
            vertical_accuracy: Number(cols[12]),
            longitude: Number(cols[13]),
            speed: Number(cols[14]),
        };

        try {
            await insertSensorRecord(record);
            insertedCount++;
        } catch (err) {
            console.error("Insert failed for line:", line, err.message);
        }
    }

    console.log(`Inserted ${insertedCount} rows into DB`);
}

// ✅ Export the function so server.js can require it
module.exports = { parseCsvAndInsert };
