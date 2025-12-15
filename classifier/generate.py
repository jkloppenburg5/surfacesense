#!/usr/bin/env python3
import json, math, random

out = []
t = 0.0
for i in range(300):  # 6 seconds of 50 Hz data
    t += 0.02
    z = 9.8 + 0.8*math.sin(40*t) + random.uniform(-0.2,0.2)
    out.append({
        "t": t,
        "x": 0,
        "y": 0,
        "z": z,
        "lat": 40,
        "lon": -90
    })

print(json.dumps({"data": out}))
