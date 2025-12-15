import sys
import json
import numpy as np
from scipy.fft import rfft, rfftfreq

# ---- CONFIG ----
SAMPLE_RATE = 50      # Hz
WINDOW_SECONDS = 2.0
# WINDOW_SECONDS = 0.5 # for testing small samples
WINDOW = int(SAMPLE_RATE * WINDOW_SECONDS)


def compute_features(window):
    # window shape: (N, 3) for x,y,z
    x, y, z = window[:,0], window[:,1], window[:,2]

    # Remove gravity by subtracting window mean
    x -= x.mean()
    y -= y.mean()
    z -= z.mean()

    # Vector magnitude (vibration energy)
    mag = np.sqrt(x*x + y*y + z*z)

    # Variance
    variance = np.var(mag)

    # Jerk (derivative)
    jerk = np.diff(mag) * SAMPLE_RATE
    jerk_rms = np.sqrt(np.mean(jerk**2))

    # FFT
    yf = np.abs(rfft(mag))
    xf = rfftfreq(len(mag), 1.0 / SAMPLE_RATE)

    # Frequency power in gravel band
    gravel_band = (xf > 15) & (xf < 40)
    gravel_power = np.mean(yf[gravel_band])

    return {
        "variance": float(variance),
        "jerk_rms": float(jerk_rms),
        "gravel_power": float(gravel_power)
    }


def classify(features):
    """
    Simple heuristic model:
    Gravel produces:
      - higher variance
      - higher jerk RMS
      - more high-frequency FFT power
    """

    if (
        features["variance"] > 0.8 or
        features["jerk_rms"] > 4.0 or
        features["gravel_power"] > 6.0
    ):
        return "gravel"
    else:
        return "paved"


def process(data):
    """
    Input: list of dicts:
       {"t": unix, "x":..., "y":..., "z":..., "lat":..., "lon":...}
    """
    arr = np.array([[d["x"], d["y"], d["z"]] for d in data])
    times = [d["t"] for d in data]
    lats  = [d["lat"] for d in data]
    lons  = [d["lon"] for d in data]

    segments = []
    i = 0
    N = len(arr)

    while i + WINDOW <= N:
        win = arr[i:i+WINDOW]

        features = compute_features(win)
        surf = classify(features)

        segment = {
            "start_t": times[i],
            "end_t": times[i+WINDOW-1],
            "start_lat": lats[i],
            "start_lon": lons[i],
            "end_lat": lats[i+WINDOW-1],
            "end_lon": lons[i+WINDOW-1],
            "features": features,
            "surface": surf
        }

        segments.append(segment)
        i += WINDOW // 2   # 50% overlap

    return segments


def main():
    raw = sys.stdin.read()
    msg = json.loads(raw)
    data = msg["data"]  # array of points

    result = process(data)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
