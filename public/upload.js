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
async function handleUpload(event) {
    // Get the first file from the input's file list
    const file = event.target.files[0];
    // If no file selected (user canceled), exit function
    if (!file) return;

    // Get DOM elements for status messages and progress bar
    const status = document.getElementById("uploadStatus");
    const progress = document.getElementById("uploadProgress");
    
    // Reset UI elements for new upload
    status.innerText = "";               // Clear previous status messages
    progress.style.display = "block";    // Show progress bar
    progress.value = 0;                  // Reset progress to 0%

    // ---- PRE-UPLOAD GRANULARITY CHECK ----
    // Step 1: Validate data sampling rate before full upload
    status.innerText = "Checking file granularity...";
    
    // Create FormData object to send file to server for analysis
    const formData = new FormData();
    formData.append("file", file);  // Attach selected file

    // Send file to backend granularity check endpoint
    const checkRes = await fetch("/api/check-granularity", {
        method: "POST",      // HTTP POST request
        body: formData       // Send file as request body
    });
    
    // Parse JSON response from server
    const checkJson = await checkRes.json();

    // Handle server error response
    if (!checkRes.ok) {
        status.innerText = `❌ ${checkJson.error}`;  // Display error message with X icon
        progress.style.display = "none";             // Hide progress bar
        return;                                      // Stop execution
    }

    // Check if file has excessive granularity (too frequent sampling)
    if (checkJson.tooGranular) {
        // Display warning with detailed metrics and recommendations
        status.innerHTML =
            `⚠️ File appears too granular.<br>` +  // Warning symbol and message
            `Detected average interval: <b>${checkJson.avgIntervalMs.toFixed(2)} ms</b><br>` +  // Show sampling interval
            `Recommendation: reduce sampling rate in SensorLogger.`;  // User guidance
        
        progress.style.display = "none";  // Hide progress bar (upload won't proceed)
        return;                           // Stop upload process
    }

    // Granularity check passed - proceed with upload
    status.innerText = "Uploading...";

    // ---- UPLOAD WITH PROGRESS TRACKING ----
    // Use XMLHttpRequest instead of fetch() for progress event support
    const uploadReq = new XMLHttpRequest();
    uploadReq.open("POST", "/api/upload");  // Configure POST request to upload endpoint
    
    // Attach progress event handler to track upload progress
    uploadReq.upload.onprogress = (e) => {
        // Check if total size is known (computable)
        if (e.lengthComputable) {
            // Calculate percentage completed
            const percent = (e.loaded / e.total) * 100;
            progress.value = percent;  // Update progress bar value
        }
        // Note: Progress events fire multiple times during upload
    };

    // Define what happens when upload completes (regardless of success/failure)
    uploadReq.onload = () => {
        // Check HTTP status code for success (200 = OK)
        if (uploadReq.status === 200) {
            status.innerText = "✅ Upload successful!";  // Green checkmark success
        } else {
            status.innerText = "❌ Upload failed.";      // Red X failure
        }
        progress.style.display = "none";  // Hide progress bar after completion
    };

    // Prepare file for upload
    const uploadData = new FormData();
    uploadData.append("file", file);  // Attach file to new FormData object
    
    // Initiate the actual upload
    uploadReq.send(uploadData);
    
    // Network error handling
    uploadReq.onerror = () => {
        status.innerText = "❌ Network error. Check connection.";
        progress.style.display = "none";
    };

    // Timeout handling:
    uploadReq.timeout = 30000; // 30 second timeout
    uploadReq.ontimeout = () => { /* handle timeout */ };

}