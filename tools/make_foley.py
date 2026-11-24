"""Build the foley sprite: trimmed, faded, normalised slices of CC0 recordings, one mono file + offsets."""
import wave, array, math, json, sys, os
SRC = sys.argv[1]; OUT = sys.argv[2]
SR = 44100
def load(id):
    w = wave.open(f"{SRC}/{id}.wav"); assert w.getframerate() == SR
    return [v / 32768 for v in array.array('h', w.readframes(w.getnframes()))]
cache = {}
def seg(id, t0, t1):
    if id not in cache: cache[id] = load(id)
    a = cache[id]; return a[int(t0 * SR):int(t1 * SR)]
def fade(x, fi=0.002, fo=0.02):
    n = len(x); a = int(fi * SR); b = int(fo * SR)
    for i in range(min(a, n)): x[i] *= i / a
    for i in range(min(b, n)): x[n - 1 - i] *= i / b
    return x
def hp(x, f=60):  # one-pole high-pass: rumble out
    rc = 1 / (2 * math.pi * f); dt = 1 / SR; k = rc / (rc + dt); y = [0.0] * len(x); prev = 0.0; py = 0.0
    for i, v in enumerate(x): py = k * (py + v - prev); prev = v; y[i] = py
    return y
def gate(x, thr_db=-50, floor=0.25):
    # duck the noise floor between transients (keeps the hiss of cheap recorders out of the mix)
    thr = 10 ** (thr_db / 20); env = 0.0; out = []
    for v in x:
        env = max(abs(v), env * 0.9995)
        g = 1.0 if env > thr else floor + (1 - floor) * env / thr
        out.append(v * g)
    return out
def norm_peak(x, db=-3):
    p = max(abs(v) for v in x) or 1; k = 10 ** (db / 20) / p; return [v * k for v in x]
def norm_rms(x, db=-24):
    r = math.sqrt(sum(v * v for v in x) / len(x)) or 1; k = 10 ** (db / 20) / r
    return [max(-1, min(1, v * k)) for v in x]
def loopify(x, xf=0.25):
    X = int(xf * SR); N = len(x) - X; out = x[:N]
    for i in range(X): w = i / X; out[i] = x[i] * w + x[N + i] * (1 - w)
    return out

CUES = []
def one(name, id, t0, t1, db=-3, g=True, h=80):
    x = seg(id, t0, t1); x = hp(x, h); x = gate(x) if g else x; CUES.append((name, fade(norm_peak(x, db)), False))
def loop(name, id, t0, t1, db=-24, h=60):
    x = hp(seg(id, t0, t1), h); x = norm_rms(x, db); CUES.append((name, loopify(x), True))

# transport keys: the not_yr deck's buttons (press variants), softer ones as releases
for i, t in enumerate([5.600, 7.720, 8.880, 10.555, 11.615]): one(f"key-down{i}", "680832", t - 0.012, t + 0.2, -4)
for i, t in enumerate([2.240, 3.960, 6.385]): one(f"key-up{i}", "680832", t - 0.01, t + 0.14, -9)
one("latch", "452905", 0.22, 0.78, -5)                 # kyles: the deck engaging play
one("stop", "452905", 18.72, 19.72, -4)                # kyles: the transport releasing
for i, t in enumerate([2.000, 3.950]): one(f"door-open{i}", "635656", t - 0.012, t + 0.38, -6)
for i, t in enumerate([0.290, 3.160, 8.515]): one(f"door-close{i}", "635656", t - 0.012, t + 0.4, -5)
one("case-open", "680834", 1.60, 2.16, -5)
one("case-close", "680834", 2.98, 3.32, -4)
one("lift", "680835", 0.44, 0.96, -8)
one("seat", "507532", 0.47, 0.80, -6)
one("insert", "826353", 7.55, 8.70, -6, g=False)
for i, t in enumerate([0.235, 0.640]): one(f"tick{i}", "477685", t - 0.008, t + 0.09, -8)
one("switch", "275630", 0.09, 0.30, -6)
one("spinup", "680721", 0.0, 1.25, -8, g=False)
loop("motor", "452905", 2.0, 6.25, -26)                 # kyles: the deck running
loop("wind", "348079", 14.0, 17.05, -20)               # kingsrow: fast wind

GAP = int(0.15 * SR)
out = [0.0] * int(0.1 * SR)
# a calibration click at exactly 0.100 s lets the app correct for any encoder delay
out += [0.9, -0.9] + [0.0] * (GAP - 2)
meta = {"calib": 0.1, "cues": {}}
for name, x, isloop in CUES:
    start = len(out) / SR
    out += x
    meta["cues"][name] = {"at": round(start, 4), "dur": round(len(x) / SR, 4), **({"loop": True} if isloop else {})}
    out += [0.0] * GAP
w = wave.open(OUT + ".wav", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes(array.array('h', [int(max(-1, min(1, v)) * 32767) for v in out]).tobytes()); w.close()
json.dump(meta, open(OUT + ".json", "w"), indent=1)
print(f"{len(CUES)} cues, {len(out)/SR:.1f}s")
