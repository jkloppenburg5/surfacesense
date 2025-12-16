# surfacesense
Surfacesense - Where Every Road Tells a Story

SurfaceSense is a sensor-driven platform for mapping road surface conditions using vibration physics and GPS data.

Designed for cyclists, runners, planners, and researchers, SurfaceSense identifies the surfaces you actually traveled and improves the accuracy of existing maps—using measured vibration signatures rather than assumptions or map tags alone.

Users upload GPS tracks alongside high-frequency accelerometer data collected from a smartphone or sensor device. SurfaceSense analyzes these signals using modern signal-processing techniques, including time-windowed spectral analysis, short-time Fourier transforms (STFT), and log band-power ratios. By examining how vibration energy is distributed across frequency bands over time—and enforcing persistence and hysteresis to avoid transient misclassifications—the system reliably distinguishes between smooth pavement and rougher surfaces such as gravel, dirt, cobblestones, and trails.

Rather than relying on raw amplitude or simple variance, SurfaceSense focuses on relative frequency content. Low-frequency motion reflects pedaling and body movement, while higher-frequency energy reveals surface texture. Comparing these bands in a normalized, logarithmic space allows the classifier to remain robust across different mounting orientations, speeds, and riding styles.

Each classified window is anchored to precise geographic coordinates, producing a spatially continuous surface map composed of short, data-driven segments. These segments are rendered on an interactive map where users can explore results in detail, inspect underlying metrics, and verify classifications in context.

To support refinement and trust, SurfaceSense includes a visual review workflow. Surface segments are color-coded by surface type and can be inspected individually, allowing users to identify outliers, transitions, or ambiguous zones. This combination of automated inference and human validation ensures that surface data improves over time and remains grounded in real-world experience.

The result is a richer understanding of the roads and paths we move across. Athletes can choose routes that match their equipment and goals, commuters can avoid uncomfortable or hazardous surfaces, and planners can gain insight into how infrastructure is actually experienced on the ground. By uniting vibration analytics, geospatial mapping, and iterative validation, SurfaceSense transforms raw sensor data into meaningful environmental intelligence—revealing the true character of the surfaces beneath our wheels and feet.




If you’re interested in the internal architecture, data pipeline, or classifier design, see: [Developer README](README.DEVELOPER.md).
