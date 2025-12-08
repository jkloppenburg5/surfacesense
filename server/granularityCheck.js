
/**
 * granularityCheck.js
 * -------------------------------------------------------
 * Purpose:
 *   Detect extremely granular sensor logs that would produce
 *   excessively large uploads (e.g., microsecond timestamps).
 *
 * Acceptance Rules:
 *   1. If file is < 2 MB:
 *        → ALWAYS ACCEPT (small files are safe).
 *
 *   2. If file has < 200 rows:
 *        → ALWAYS ACCEPT (short recordings are fine).
 *
 *   3. Otherwise:
 *        → Perform a granularity analysis on sample timestamps.
 *
 *   Rejection Criteria:
 *     - Compute avg interval between timestamps.
 *     - If avgInterval < 300 ms AND file is large:
 *         → REJECT as "too granular".
 *
 * Notes:
 *   - Designed to protect the backend from extremely high-frequency
 *     SensorLogger recordings (microsecond precision).
 *   - Allows tiny example files or test recordings even if granular.
 *
 * Export:
 *   checkGranularity(fileBuffer) → { tooGranular, reason, ... }
 *
 * -------------------------------------------------------
 */

function checkGranularity(fileBuffer) {
    const text = fileBuffer.toString("utf8");
    const fileSizeBytes = fileBuffer.length;

    // Small files (e.g. < 2 MB) should always be allowed
    const SMALL_FILE_LIMIT = 2 * 1024 * 1024; // 2MB
    // const SMALL_FILE_LIMIT = 512; // 500KB
    const MIN_ROWS_FOR_GRANULARITY_CHECK = 200;

    const lines = text
        .trim()
        .split("\n")
        .filter(l => l.trim().length > 0);

    // If very small file, skip check
    if (fileSizeBytes < SMALL_FILE_LIMIT || lines.length < MIN_ROWS_FOR_GRANULARITY_CHECK) {
        return {
            tooGranular: false,
            reason: "File small enough to allow high granularity",
            avgIntervalMs: null,
            fileSizeBytes,
            rowCount: lines.length
        };
    }

    // Use the first 200 lines to estimate timestamps (upper bound)
    const sampleLines = lines.slice(0, 200);
    const timestamps = [];

    for (const line of sampleLines) {
        const parts = line.split(",");
        
        // first column must be nanosecond/microsecond unix timestamp
        const unix = Number(parts[0]);

        if (!isNaN(unix) && unix > 1e12) {
            timestamps.push(unix);
        }
    }

    if (timestamps.length < 3) {
        // Cannot calculate, allow upload
        return {
            tooGranular: false,
            reason: "Not enough timestamps to evaluate granularity",
            avgIntervalMs: null,
            fileSizeBytes,
            rowCount: lines.length
        };
    }

    const diffs = [];
    for (let i = 1; i < timestamps.length; i++) {
        diffs.push(timestamps[i] - timestamps[i - 1]);
    }

    const avgInterval = diffs.reduce((a, b) => a + b) / diffs.length;

    // Convert nanoseconds → milliseconds
    const avgIntervalMs = avgInterval / 1_000_000;

    // Now apply large-file rejection rule
    const TOO_GRANULAR_THRESHOLD_MS = 300;

    const tooGranular =
        avgIntervalMs < TOO_GRANULAR_THRESHOLD_MS &&
        fileSizeBytes > SMALL_FILE_LIMIT;

    return {
        tooGranular,
        avgIntervalMs,
        fileSizeBytes,
        rowCount: lines.length,
        reason: tooGranular
            ? "Large file with extremely small sampling interval"
            : "Granularity acceptable"
    };
}

module.exports = { checkGranularity };
