import sys
import json
import numpy as np
from scipy.fft import rfft, rfftfreq

# ================= CONFIG =================

SAMPLE_RATE = 50        # Hz
WINDOW_SECONDS = 2.0
WINDOW = int(SAMPLE_RATE * WINDOW_SECONDS)
OVERLAP = WINDOW // 2   # 50%

EPS = 1e-6

# Thresholds (FROM YOUR HISTOGRAM)
GRAVEL_ENTER = -2.0     # log-ratio > this → gravel
GRAVEL_EXIT  = -2.0    # log-ratio < this → pavement

PERSIST_N = 3           # consecutive windows required

# ==========================================


def band_power(freqs, spectrum, f_lo, f_hi):
    idx = (freqs >= f_lo) & (freqs < f_hi)
    if not np.any(idx):
        return 0.0
    # true power
    return float(np.mean(spectrum[idx] ** 2))
    # return np.mean(spectrum[idx])


# def compute_log_ratio(window):
#     """
#     window: (N,3) accelerometer window
#     """
#     x, y, z = window[:, 0], window[:, 1], window[:, 2]

#     # Remove DC (orientation + gravity proxy)
#     x -= x.mean()
#     y -= y.mean()
#     z -= z.mean()

#     mag = np.sqrt(x*x + y*y + z*z)
#     mag -= mag.mean()

#     yf = np.abs(rfft(mag))
#     xf = rfftfreq(len(mag), 1.0 / SAMPLE_RATE)

#     p13 = band_power(xf, yf, 1.0, 3.0)
#     p715 = band_power(xf, yf, 7.0, 15.0)

#     log_ratio = np.log(p715 + EPS) - np.log(p13 + EPS)

#     return float(log_ratio), {
#         "p_1_3": float(p13),
#         "p_7_15": float(p715),
#         "log_ratio": float(log_ratio)
#     }


def compute_log_ratio(window):
    """
    window: (N,3) accelerometer window
    """
    x = window[:, 0].astype(float)
    y = window[:, 1].astype(float)
    z = window[:, 2].astype(float)

    # Remove DC drift (fallback gravity handling)
    x -= x.mean()
    y -= y.mean()
    z -= z.mean()

    mag = np.sqrt(x*x + y*y + z*z)
    mag -= mag.mean()

    amp = np.abs(rfft(mag))
    freqs = rfftfreq(len(mag), 1.0 / SAMPLE_RATE)

    p13  = band_power(freqs, amp, 1.0, 3.0)
    p715 = band_power(freqs, amp, 7.0, 15.0)

    p13  = max(p13, EPS)
    p715 = max(p715, EPS)

    log_ratio = float(np.log(p715) - np.log(p13))

    return log_ratio, {
        "p_1_3": p13,
        "p_7_15": p715,
        "log_ratio": log_ratio
    }

def process(data):
    arr = np.array([[d["x"], d["y"], d["z"]] for d in data])
    times = [d["t"] for d in data]
    lats  = [d["lat"] for d in data]
    lons  = [d["lon"] for d in data]

    segments = []
    N = len(arr)

    state = "paved"
    gravel_count = 0
    paved_count = 0

    i = 0
    while i + WINDOW <= N:
        win = arr[i:i+WINDOW]

        log_ratio, features = compute_log_ratio(win)

        # ---------------- STATE MACHINE ----------------

        if state == "paved":
            if log_ratio > GRAVEL_ENTER:
                gravel_count += 1
                if gravel_count >= PERSIST_N:
                    state = "gravel"
                    gravel_count = 0
            else:
                gravel_count = 0

        else:  # state == gravel
            if log_ratio < GRAVEL_EXIT:
                paved_count += 1
                if paved_count >= PERSIST_N:
                    state = "paved"
                    paved_count = 0
            else:
                paved_count = 0

        # ------------------------------------------------

        segment = {
            "start_t": times[i],
            "end_t": times[i+WINDOW-1],
            "start_lat": lats[i],
            "start_lon": lons[i],
            "end_lat": lats[i+WINDOW-1],
            "end_lon": lons[i+WINDOW-1],
            "features": features,
            "surface": state
        }

        segments.append(segment)
        i += OVERLAP

    return segments


def main():
    raw = sys.stdin.read()
    msg = json.loads(raw)
    data = msg["data"]

    result = process(data)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
