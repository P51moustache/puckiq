"""Original PuckIQ sports sting. Pure synthesis, no third-party samples.

48 kHz stereo / 128 BPM / exactly 32 beats (15 seconds).
Scene accents land at beats 0, 8, 14, 20, 26; final resolved hit at beat 30.
Run with a Python interpreter that has numpy installed.
"""
from pathlib import Path
import json
import wave
import numpy as np

SR = 48000
BPM = 128
BEAT = 60 / BPM
DURATION = 15
N = SR * DURATION
rng = np.random.default_rng(311022)
drums = np.zeros((N, 2), dtype=np.float64)
music = np.zeros_like(drums)
fx = np.zeros_like(drums)


def times(dur):
    return np.arange(round(dur * SR), dtype=np.float64) / SR


def envelope(t, attack=.002, decay=.12):
    return (1 - np.exp(-t / attack)) * np.exp(-t / decay)


def noise(dur, low=0, high=24000):
    """Soft-edged spectral band limitation avoids piercing digital noise."""
    count = round(dur * SR)
    x = rng.standard_normal(count)
    spectrum = np.fft.rfft(x)
    freq = np.fft.rfftfreq(count, 1 / SR)
    response = np.ones_like(freq)
    if low:
        response *= 1 - np.exp(-(freq / low) ** 4)
    if high < SR / 2:
        response *= np.exp(-(freq / high) ** 6)
    x = np.fft.irfft(spectrum * response, n=count)
    return x / (np.std(x) + 1e-9)


def put(track, sound, sec, gain=1, pan=0):
    start = round(sec * SR)
    if start >= N:
        return
    if start < 0:
        sound = sound[-start:]
        start = 0
    count = min(len(sound), N - start)
    if sound.ndim == 1:
        left = np.sqrt((1 - pan) / 2)
        right = np.sqrt((1 + pan) / 2)
        sound = np.column_stack((sound * left, sound * right))
    track[start:start + count] += sound[:count] * gain


def kick(accent=False):
    t = times(.46)
    # Sweeping upper transient resolves into a round 51 Hz low end.
    f = 51 + 140 * np.exp(-t / .019) + 20 * np.exp(-t / .08)
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * envelope(t, .0008, .115)
    body += .18 * np.sin(2 * phase) * envelope(t, .001, .045)
    click = noise(.46, 1800, 7400) * np.exp(-t / .004) * .055
    x = np.tanh(1.6 * body) / 1.6 + click
    return x * (1.06 if accent else 1)


def snare():
    t = times(.30)
    snap = noise(.30, 850, 8400)
    clap_env = np.exp(-t / .026)
    for offset, level in [(.010, .75), (.022, .65), (.034, .4)]:
        clap_env += level * (t >= offset) * np.exp(-np.maximum(t - offset, 0) / .033)
    clap_env *= 1 - np.exp(-t / .0005)
    body = np.sin(2 * np.pi * 183 * t) * envelope(t, .001, .052)
    return .24 * snap * clap_env + .35 * body


def hat(opened=False):
    dur = .18 if opened else .065
    t = times(dur)
    x = noise(dur, 5700, 13300)
    metal = sum(np.sin(2 * np.pi * f * t + p)
                for f, p in [(6347, .3), (8183, .8), (9739, 1.4)]) / 3
    return (x * .82 + metal * .18) * envelope(t, .0006, .047 if opened else .013)


def bass(freq, dur):
    t = times(dur + .12)
    # Muted harmonic bass with a tiny decaying pitch scoop, no pure-tone beeps.
    phase = 2 * np.pi * np.cumsum(freq * (1 + .022 * np.exp(-t / .025))) / SR
    tone = np.zeros_like(t)
    for harmonic in range(1, 12):
        brightness = np.exp(-harmonic / (2.0 + 4.5 * np.exp(-t / .08)))
        tone += np.sin(phase * harmonic) * brightness / harmonic
    env = (1 - np.exp(-t / .005)) * np.exp(-t / .40)
    env *= np.exp(-np.maximum(t - dur, 0) / .025)
    return np.tanh(tone * 2.4) * env


def pluck(freq, dur=1.3):
    t = times(dur)
    left = np.zeros_like(t)
    right = np.zeros_like(t)
    for k in range(1, 8):
        a = np.exp(-k * t / .65) / (k ** 1.65)
        left += a * np.sin(2 * np.pi * freq * .9985 * k * t)
        right += a * np.sin(2 * np.pi * freq * 1.0015 * k * t + .07)
    env = (1 - np.exp(-t / .004)) * np.exp(-t / .6)
    return np.column_stack((left * env, right * env))


def transition(beat, strength=.6):
    sec = beat * BEAT
    t = times(.28)
    swish = noise(.28, 1100, 6200) * np.sin(np.pi * t / .28) ** 1.7
    if beat:
        put(fx, swish, sec - .28, .11, -.25)
    t = times(.66)
    sweep = 2 * np.pi * (48 * t + 55 * .04 * (1 - np.exp(-t / .04)))
    impact = np.sin(sweep) * envelope(t, .001, .15)
    ring = (np.sin(2 * np.pi * 1260 * t) + .4 * np.sin(2 * np.pi * 2084 * t))
    ring *= envelope(t, .0006, .025)
    put(fx, impact + ring * .15, sec, strength * .48)
    # Diffuse delayed ring, quieter than the centered puck-like snap.
    put(fx, ring, sec + .072, strength * .029, .65)
    put(fx, ring, sec + .121, strength * .019, -.65)


# Build a tight, forward-driving beat. Small rhythmic omissions leave breathing
# room for the product headlines; beat 30 begins a clean two-beat tail.
kick_beats = []
for bar in range(8):
    origin = bar * 4
    kicks = [0, 1.5, 2, 3.5] if bar % 2 == 0 else [0, 1.75, 2.5]
    for beat in kicks:
        when = origin + beat
        if when >= 30:
            continue
        kick_beats.append(when)
        put(drums, kick(beat == 0), when * BEAT, .74)
    for beat in [1, 3]:
        when = origin + beat
        if when < 30:
            put(drums, snare(), when * BEAT, .51)
    for index in range(8):
        when = origin + index / 2
        if when >= 29.5:
            continue
        velocity = .085 if index % 2 == 0 else .135
        put(drums, hat(index == 7), when * BEAT, velocity,
            -.25 if index % 2 == 0 else .28)
    if bar in [1, 4, 6]:
        for beat, velocity in [(3.25, .048), (3.75, .065)]:
            put(drums, hat(), (origin + beat) * BEAT, velocity, .45)

D2, C2, BB1, D3, A3 = 73.4162, 65.4064, 58.2705, 146.8324, 220.0
roots = [D2, D2, BB1, C2, D2, D2, BB1, D2]
for bar, root in enumerate(roots):
    for offset, length, amp in [(0, .65, .25), (.75, .40, .19),
                                (1.5, .30, .22), (2.25, .4, .20),
                                (3, .34, .21), (3.5, .3, .18)]:
        when = bar * 4 + offset
        if when < 29:
            freq = root * (2 if offset == 3.5 and bar % 2 else 1)
            put(music, bass(freq, length * BEAT), when * BEAT, amp)

# The sparse, soft plucks imply D minor without competing with screen text.
for beat, freq in [(2.5, 293.665), (6.5, 220), (10.5, 349.228),
                   (14.5, 261.626), (18.5, 293.665), (22.5, 440),
                   (26, 293.665), (27.5, 220)]:
    tone = pluck(freq)
    put(music, tone, beat * BEAT, .055)
    put(music, tone[:, ::-1], beat * BEAT + BEAT * .75, .020)

# Duck music around the kick transient, keeping the bottom end articulate.
duck = np.ones(N)
for beat in kick_beats:
    start = round(beat * BEAT * SR)
    count = min(round(.24 * SR), N - start)
    t = np.arange(count) / SR
    duck[start:start + count] *= 1 - .53 * np.exp(-t / .052)
music *= duck[:, None]

for beat in [0, 8, 14, 20, 26]:
    transition(beat, .85 if beat in [0, 26] else .63)

# The logo gets a small chord stamp and the final downbeat resolves the spot.
for freq, amp in [(146.8324, .065), (220, .05), (293.665, .043), (349.228, .03)]:
    put(music, pluck(freq, 2), 26 * BEAT, amp)
for freq, amp in [(73.4162, .14), (146.8324, .06), (220, .045), (293.665, .03)]:
    put(music, pluck(freq, 1), 30 * BEAT, amp)
put(drums, kick(True), 30 * BEAT, .52)
transition(30, .4)

mix = drums + music + fx
# Gentle master saturation catches coinciding accents without a hard limiter.
mix = np.tanh(mix * 1.12) / 1.12
fade_in = round(.006 * SR)
fade_out = round(.15 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.4
peak_target = 10 ** (-1.5 / 20)
mix *= peak_target / np.max(np.abs(mix))
output = Path(__file__).with_name('soundtrack.wav')
pcm = np.round(np.clip(mix, -1, 1) * 32767).astype('<i2')
with wave.open(str(output), 'wb') as writer:
    writer.setnchannels(2)
    writer.setsampwidth(2)
    writer.setframerate(SR)
    writer.writeframes(pcm.tobytes())
report = {
    'file': str(output), 'duration_seconds': len(pcm) / SR,
    'sample_rate': SR, 'channels': 2, 'sample_frames': len(pcm),
    'peak_dbfs': float(20 * np.log10(np.max(np.abs(pcm.astype(float))) / 32768)),
    'rms_dbfs': float(20 * np.log10(np.sqrt(np.mean((pcm.astype(float) / 32768) ** 2)))),
    'clipped_samples': int(np.sum(np.abs(pcm.astype(int)) >= 32767)),
    'tempo_bpm': BPM, 'scene_accent_seconds': [beat * BEAT for beat in [0, 8, 14, 20, 26]],
    'rights': 'Original deterministic synthesis; no external audio samples or licensed music.'
}
output.with_suffix('.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
