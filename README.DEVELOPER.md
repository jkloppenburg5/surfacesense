# SurfaceSense - Where Every Road Tells a Story

**SurfaceSense** is a full‑stack data platform that classifies road surface types (paved vs gravel) from smartphone sensor data and visualizes the results on an interactive map.

At a high level, it answers:

> *“Based on vibration patterns, what surface did this route actually traverse?”*

---

## What It Does

* Ingests CSV sensor logs (GPS + accelerometer)
* Stores data in PostgreSQL
* Analyzes vibration frequency content using Python
* Classifies short route segments as **paved** or **gravel**
* Displays results on a Leaflet map with inspectable metrics

---

## Architecture Overview

```
Sensor Logs → Backend Processing → Interactive Map
```

### 1. Data Ingestion

* CSV files uploaded from SensorLogger
* Granularity check prevents overly dense data
* Valid rows inserted into `surface_sensor_data` (PostgreSQL)

### 2. Backend Processing

**Node.js / Express**

* Handles uploads, APIs, database access
* Orchestrates Python classification

**Python Classifier**

* Windowed FFT on accelerometer magnitude
* Computes log spectral ratio:

  * log(P(7–15 Hz)) − log(P(1–3 Hz))
* Uses persistence + hysteresis to label surfaces

**PostgreSQL (AWS RDS)**

* Stores raw sensor records
* Serves as the single source of truth

### 3. Frontend Visualization

* Leaflet map with satellite imagery
* Toggleable layers:

  * Raw GPS points
  * Surface classification segments
* Popups expose:

  * Surface label
  * Log ratio
  * Band power metrics
  * Timestamps and lat/lon

---

## Key Design Choices

* **Relative frequency ratios** instead of raw variance
* **Log scale** for robustness across speeds and mounting
* **State machine with hysteresis** to prevent flicker
* **Explainable features** (no black‑box ML)

---

## What This Is (and Isn’t)

**Is:**

* A physics‑backed surface classifier
* Transparent and debuggable
* Designed for cycling and road analysis

**Is not (yet):**

* Real‑time
* Neural‑network based
* Fully production‑hardened

---

## Future Directions

* Surface quality scoring
* Gravel / pavement heatmaps
* Routing by surface preference
* Community‑contributed surface maps

---

## One‑Line Summary

**SurfaceSense turns raw smartphone sensor data into an interactive map that reveals what surfaces you actually rode—using vibration physics, not guesswork.**
