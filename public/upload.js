/**
 * FILE UPLOAD HANDLER - ARCHITECTURE SUMMARY
 * 
 * TWO-PHASE PROCESS: Validation → Upload
 * 
 * PHASE 1: Validation (/api/check-granularity)
 *   - Checks sensor data sampling rate
 *   - Prevents upload of oversampled files
 *   - Returns: { tooGranular, avgIntervalMs, error? }
 * 
 * PHASE 2: Upload (/api/upload)
 *   - XMLHttpRequest with progress tracking
 *   - Visual feedback via progress bar
 *   - Success/error status display
 * 
 * UI FEATURES:
 *   - Progress bar with real-time updates
 *   - Emoji status indicators (✅❌⚠️)
 *   - Granularity warnings with specific metrics
 */

// Attach event listener to file input element
// When user selects a file, trigger the handleUpload function
document.getElementById("fileInput").addEventListener("change", handleUpload);

// Main asynchronous function to handle file upload process
// async function handleUpload(event) {
//     // Get the first file from the input's file list
//     const file = event.target.files[0];
//     // If no file selected (user canceled), exit function
//     if (!file) return;

//     // Get DOM elements for status messages and progress bar
//     const status = document.getElementById("uploadStatus");
//     const progress = document.getElementById("uploadProgress");
    
//     // Reset UI elements for new upload
//     status.innerText = "";               // Clear previous status messages
//     progress.style.display = "block";    // Show progress bar
//     progress.value = 0;                  // Reset progress to 0%

//     // ---- PRE-UPLOAD GRANULARITY CHECK ----
//     // Step 1: Validate data sampling rate before full upload
//     status.innerText = "Checking file granularity...";
    
//     // Create FormData object to send file to server for analysis
//     const formData = new FormData();
//     formData.append("file", file);  // Attach selected file

//     // Send file to backend granularity check endpoint
//     const checkRes = await fetch("/api/check-granularity", {
//         method: "POST",      // HTTP POST request
//         body: formData       // Send file as request body
//     });
    
//     // Parse JSON response from server
//     const checkJson = await checkRes.json();

//     // Handle server error response
//     if (!checkRes.ok) {
//         status.innerText = `❌ ${checkJson.error}`;  // Display error message with X icon
//         progress.style.display = "none";             // Hide progress bar
//         return;                                      // Stop execution
//     }

//     // Check if file has excessive granularity (too frequent sampling)
//     if (checkJson.tooGranular) {
//         // Display warning with detailed metrics and recommendations
//         status.innerHTML =
//             `⚠️ File appears too granular.<br>` +  // Warning symbol and message
//             `Detected average interval: <b>${checkJson.avgIntervalMs.toFixed(2)} ms</b><br>` +  // Show sampling interval
//             `Recommendation: reduce sampling rate in SensorLogger.`;  // User guidance
        
//         progress.style.display = "none";  // Hide progress bar (upload won't proceed)
//         return;                           // Stop upload process
//     }


// ---------------- UI HELPERS ----------------

function setStatus(text) {
  const el = document.getElementById("statusText");
  if (el) el.innerText = text;
}

function showProgress() {
  const el = document.getElementById("uploadProgress");
  if (!el) return;
  el.style.display = "block";
  el.value = 0;
}

function setProgress(percent) {
  const el = document.getElementById("uploadProgress");
  if (!el) return;
  el.value = percent;
}

function hideProgress() {
  const el = document.getElementById("uploadProgress");
  if (el) el.style.display = "none";
}

// ------------- EVENT BINDING ----------------

// Attach event listener to file input element
// When user selects a file, trigger the handleUpload function
const fileInput = document.getElementById("fileInput");
if (fileInput) {
  fileInput.addEventListener("change", handleUpload);
}

// ------------- MAIN UPLOAD LOGIC ------------

async function handleUpload(event) {
  const file = event.target.files[0];

  // If no file selected (user canceled), exit early
  if (!file) return;

  setStatus("Preparing upload…");
  showProgress();

  // ----------------------------------------------------
  // LIGHTWEIGHT CLIENT-SIDE CSV STRUCTURE CHECK
  // ----------------------------------------------------
  // Purpose:
  //   - Fail fast if user uploads the wrong file
  //   - Avoid unnecessary server round-trips
  //   - Do NOT validate values, only shape
  // ----------------------------------------------------

  let text;
  try {
    text = await file.text();
  } catch (err) {
    setStatus("❌ Failed to read file");
    hideProgress();
    return;
  }

  const firstLine = text.split(/\r?\n/)[0];
  const headers = firstLine.split(",").map(h => h.trim());

  const expectedHeaders = [
    "timestamp",
    "seconds_elapsed",
    "z",
    "y",
    "x",
    "altitude",
    "speed_accuracy",
    "bearing_accuracy",
    "latitude",
    "altitude_msl",
    "bearing",
    "horizontal_accuracy",
    "vertical_accuracy",
    "longitude",
    "speed"
  ];

  // Only check minimum column count
  if (headers.length < expectedHeaders.length) {
    setStatus(
      "❌ CSV format not recognized.\n" +
      "This file does not appear to be SensorLogger output."
    );
    hideProgress();
    return;
  }

  // ----------------------------------------------------
  // PHASE 1: SERVER-SIDE GRANULARITY CHECK
  // ----------------------------------------------------

  setStatus("Checking file granularity…");

  const granularityForm = new FormData();
  granularityForm.append("file", file);

  let checkRes, checkJson;

  try {
    checkRes = await fetch("/api/check-granularity", {
      method: "POST",
      body: granularityForm
    });
    checkJson = await checkRes.json();
  } catch (err) {
    setStatus("❌ Granularity check failed");
    hideProgress();
    return;
  }

  if (!checkRes.ok) {
    setStatus(`❌ ${checkJson.error || "Granularity error"}`);
    hideProgress();
    return;
  }

  if (checkJson.tooGranular) {
    setStatus(
      `⚠️ File too granular\n` +
      `Avg interval: ${checkJson.avgIntervalMs.toFixed(2)} ms`
    );
    hideProgress();
    return;
  }

  // ----------------------------------------------------
  // PHASE 2: FILE UPLOAD WITH PROGRESS TRACKING
  // ----------------------------------------------------

  setStatus("Uploading…");

  const uploadReq = new XMLHttpRequest();
  uploadReq.open("POST", "/api/upload");

  // Track upload progress
  uploadReq.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const percent = (e.loaded / e.total) * 100;
    setProgress(percent);
  };

  // Upload completed
  uploadReq.onload = () => {
    if (uploadReq.status === 200) {
      setStatus("✅ Upload successful!");
    } else {
      setStatus("❌ Upload failed");
    }
    hideProgress();
  };

  // Network error
  uploadReq.onerror = () => {
    setStatus("❌ Network error");
    hideProgress();
  };

  // Timeout handling
  uploadReq.timeout = 30000;
  uploadReq.ontimeout = () => {
    setStatus("❌ Upload timed out");
    hideProgress();
  };

  // Send file
  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadReq.send(uploadData);
}