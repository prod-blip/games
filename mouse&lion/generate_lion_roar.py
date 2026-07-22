import math
import random
import struct
import wave


RATE = 48_000
DURATION = 3.0
FRAMES = int(RATE * DURATION)
random.seed(82471)

# A synthetic cinematic roar: pitched throat pulses, turbulent breath, sub-bass,
# and short early reflections. Kept deterministic so it can be regenerated.
raw = []
low_noise = 0.0
band_low = 0.0
phase = 0.0

for i in range(FRAMES):
    t = i / RATE

    attack = min(1.0, t / 0.055)
    release = max(0.0, min(1.0, (DURATION - t) / 0.42))
    body = attack * release
    surges = (
        1.00 * math.exp(-((t - 0.34) / 0.22) ** 2)
        + 0.90 * math.exp(-((t - 1.05) / 0.35) ** 2)
        + 0.72 * math.exp(-((t - 1.82) / 0.43) ** 2)
        + 0.40 * math.exp(-((t - 2.52) / 0.38) ** 2)
    )
    env = body * min(1.0, 0.25 + surges)

    # Falling, irregular throat pitch with three rough harmonics.
    f0 = 82.0 - 25.0 * (t / DURATION) + 7.0 * math.sin(2 * math.pi * 1.65 * t)
    f0 += 3.5 * math.sin(2 * math.pi * 7.3 * t)
    phase += 2 * math.pi * f0 / RATE
    throat = (
        math.sin(phase)
        + 0.58 * math.sin(2.02 * phase + 0.5)
        + 0.30 * math.sin(3.01 * phase + 1.2)
        + 0.17 * math.sin(4.93 * phase)
    )

    # Two simple filters produce chest rumble and rasp from white noise.
    n = random.uniform(-1.0, 1.0)
    low_noise += 0.018 * (n - low_noise)
    band_low += 0.11 * (n - band_low)
    rasp = n - band_low
    turbulence = 3.8 * low_noise + 0.28 * rasp

    sub = math.sin(2 * math.pi * (34.0 - 5.0 * t / DURATION) * t)
    flutter = 0.78 + 0.22 * math.sin(2 * math.pi * (12.0 + 2.0 * math.sin(t)) * t)
    sample = env * (0.48 * throat * flutter + 0.58 * turbulence + 0.22 * sub)
    raw.append(math.tanh(2.35 * sample))

# Add compact cave-like early reflections for weight without extending duration.
mixed = raw[:]
for delay_s, gain in ((0.043, 0.24), (0.087, 0.17), (0.151, 0.11), (0.237, 0.07)):
    delay = int(delay_s * RATE)
    for i in range(delay, FRAMES):
        mixed[i] += gain * raw[i - delay]

peak = max(abs(x) for x in mixed) or 1.0
scale = 0.965 / peak

with wave.open("lion_roar.wav", "wb") as wav:
    wav.setnchannels(2)
    wav.setsampwidth(2)
    wav.setframerate(RATE)
    for i, value in enumerate(mixed):
        # Tiny stereo decorrelation gives the roar more physical width.
        right_source = mixed[max(0, i - 19)]
        left = int(max(-1.0, min(1.0, value * scale)) * 32767)
        right = int(max(-1.0, min(1.0, right_source * scale)) * 32767)
        wav.writeframesraw(struct.pack("<hh", left, right))
