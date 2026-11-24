"""Cuts the keypress sounds out of the owner-supplied Freesound recording
`799122__sadiquecat__fujitsu-computers-keyboard-key-press-mono-multi-take.wav`
(96 kHz, 32-bit, mono, 12.5 s, about 8 separate presses) into short web clips.

    python scripts/extract-keyboard-sfx.py [source.wav] [out-dir]

Needs numpy and scipy. No encoder for OGG is available here, so the clips are 16-bit mono WAV at
48 kHz (each under 40 KB); every browser decodes WAV through Web Audio.

The recording has no labels: it does not say which physical key each press is. The clips are
sorted by their sound only. The "space" and "enter" clips are the presses with the deepest and the
longest, heaviest sound; they are not recordings of those keys, and the report says so.
"""
import os
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "assets-src", "audio", "keyboard", "799122__sadiquecat__fujitsu-computers-keyboard-key-press-mono-multi-take.wav")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "public", "assets", "audio", "keyboard")
OUT_RATE = 48000
PRE_ROLL_S = 0.002   # keeps the attack: the cut starts 2 ms before the onset
MAX_LEN_S = 0.32     # long enough for press and release clicks, short enough for fast typing
FADE_OUT_S = 0.012
TARGET_RMS_DBFS = -20.0
PEAK_LIMIT_DBFS = -3.0
CLIP_LEVEL = 0.98    # a press that reaches this was clipped in the recording and is skipped


def load(path):
    rate, data = wavfile.read(path)
    x = data.astype(np.float64)
    if data.dtype == np.int16:
        x /= 32768.0
    elif data.dtype == np.int32:
        x /= 2.0 ** 31
    if x.ndim > 1:
        x = x.mean(axis=1)
    return rate, x


def envelope(x, rate, ms=5):
    win = max(1, int(rate * ms / 1000))
    return np.sqrt(np.convolve(x ** 2, np.ones(win) / win, mode="same"))


def find_presses(x, rate):
    env = envelope(x, rate)
    floor = np.percentile(env, 20)
    threshold = max(floor * 8, env.max() * 0.05)
    above = env > threshold
    gap = int(rate * 0.12)
    presses = []
    i = 0
    n = len(env)
    while i < n:
        if not above[i]:
            i += 1
            continue
        start = last = i
        j = i
        while j < n and j - last < gap:
            if above[j]:
                last = j
            j += 1
        presses.append((start, last))
        i = j
    return presses, floor


def describe(seg, rate):
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
    freqs = np.fft.rfftfreq(len(seg), 1 / rate)
    centroid = float((spec * freqs).sum() / max(spec.sum(), 1e-12))
    return centroid


def main():
    rate, x = load(SRC)
    presses, floor = find_presses(x, rate)
    print(f"source: {rate} Hz, {len(x) / rate:.2f} s, noise floor {20 * np.log10(floor + 1e-12):.1f} dBFS, {len(presses)} events")
    clips = []
    previous = None
    for start, end in presses:
        length = (end - start) / rate
        if previous is not None and (start - previous) / rate < 0.3:
            print(f"  skip t={start / rate:.2f}s: the release of the press before it")
            continue
        previous = start
        a = max(0, start - int(PRE_ROLL_S * rate))
        b = min(len(x), a + int(MAX_LEN_S * rate))
        seg = x[a:b].copy()
        peak = float(np.abs(x[start:end + 1]).max())
        if length < 0.03:
            print(f"  skip t={start / rate:.2f}s: {length * 1000:.0f} ms is a release click, not a press")
            continue
        if peak >= CLIP_LEVEL:
            print(f"  skip t={start / rate:.2f}s: peak {peak:.3f} is clipped in the recording")
            continue
        # The tail ends where the press has decayed to twice the noise floor.
        env = envelope(seg, rate)
        quiet = np.where(env[int((end - a) * 0.5):] < floor * 2)[0]
        if len(quiet):
            seg = seg[: min(len(seg), int((end - a) * 0.5) + quiet[0] + int(0.01 * rate))]
        fade = int(FADE_OUT_S * rate)
        seg[-fade:] *= np.linspace(1, 0, fade)
        clips.append({"t": start / rate, "seg": seg, "centroid": describe(seg, rate), "length": len(seg) / rate, "peak": peak})
    if len(clips) < 4:
        raise SystemExit("not enough separate presses for the clip set")

    # Deepest long press -> space; longest heavy press -> enter; one more -> backspace; rest -> normal.
    by_depth = sorted(clips, key=lambda c: (c["centroid"], -c["length"]))
    space = by_depth[0]
    rest = [c for c in clips if c is not space]
    enter = max(rest, key=lambda c: c["length"] * c["peak"])
    rest = [c for c in rest if c is not enter]
    backspace = min(rest, key=lambda c: c["centroid"])
    normals = [c for c in rest if c is not backspace][:4]
    named = [(f"key-{i + 1}", c) for i, c in enumerate(normals)] + [("key-space", space), ("key-enter", enter), ("key-backspace", backspace)]

    os.makedirs(OUT, exist_ok=True)
    for name, clip in named:
        seg = resample_poly(clip["seg"], OUT_RATE, rate)
        rms = np.sqrt((seg ** 2).mean())
        gain = 10 ** (TARGET_RMS_DBFS / 20) / max(rms, 1e-9)
        peak_limit = 10 ** (PEAK_LIMIT_DBFS / 20)
        gain = min(gain, peak_limit / max(np.abs(seg).max(), 1e-9))
        seg = np.clip(seg * gain, -1, 1)
        path = os.path.join(OUT, f"{name}.wav")
        wavfile.write(path, OUT_RATE, (seg * 32767).astype(np.int16))
        print(f"  {name}: from t={clip['t']:.2f}s, {len(seg) / OUT_RATE * 1000:.0f} ms, centroid {clip['centroid']:.0f} Hz, gain {20 * np.log10(gain):+.1f} dB, {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()
