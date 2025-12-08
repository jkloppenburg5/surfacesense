
// Upload handler for:
// -- file selection
// -- pre-upload granularity check
// -- progress bar with real progress events
// -- actual file upload to backend

document.getElementById("fileInput").addEventListener("change", handleUpload);

async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById("uploadStatus");
    const progress = document.getElementById("uploadProgress");
    status.innerText = "";
    progress.style.display = "block";
    progress.value = 0;

    // ---- PRE-UPLOAD GRANULARITY CHECK ----
    status.innerText = "Checking file granularity...";
    const formData = new FormData();
    formData.append("file", file);

    const checkRes = await fetch("/api/check-granularity", {
        method: "POST",
        body: formData
    });
    const checkJson = await checkRes.json();

    if (!checkRes.ok) {
        status.innerText = `❌ ${checkJson.error}`;
        progress.style.display = "none";
        return;
    }

    if (checkJson.tooGranular) {
        status.innerHTML =
            `⚠️ File appears too granular.<br>` +
            `Detected average interval: <b>${checkJson.avgIntervalMs.toFixed(2)} ms</b><br>` +
            `Recommendation: reduce sampling rate in SensorLogger.`;
        progress.style.display = "none";
        return;
    }

    status.innerText = "Uploading...";

    // ---- UPLOAD WITH PROGRESS ----
    const uploadReq = new XMLHttpRequest();
    uploadReq.open("POST", "/api/upload");
    uploadReq.upload.onprogress = (e) => {
        if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progress.value = percent;
        }
    };

    uploadReq.onload = () => {
        if (uploadReq.status === 200) {
            status.innerText = "✅ Upload successful!";
        } else {
            status.innerText = "❌ Upload failed.";
        }
        progress.style.display = "none";
    };

    const uploadData = new FormData();
    uploadData.append("file", file);
    uploadReq.send(uploadData);
}
