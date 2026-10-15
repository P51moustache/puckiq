"""PuckIQ v2: original 15-second cinematic sports score and sound design.

Entirely synthesized, including puck transients and ice-like strokes. No samples,
downloads, licensed music, or input from the v1 soundtrack. Requires only numpy.
"""
from pathlib import Path
import json
import wave
import numpy as np

SR, N = 48000, 720000
BEAT = 60 / 128
rng = np.random.default_rng(26092602)
buses = {name: np.zeros((N, 2)) for name in ('drums', 'bass', 'music', 'fx', 'room')}


def time(dur):
    return np.arange(round(dur * SR)) / SR


def env(t, attack=.002, decay=.15):
    return -np.expm1(-t / attack) * np.exp(-t / decay)


def band_noise(dur, low, high):
    n = round(dur * SR)
    f = np.fft.rfftfreq(n, 1 / SR)
    response = np.exp(-(f / high) ** 6)
    if low:
        response *= 1 - np.exp(-(f / low) ** 4)
    x = np.fft.irfft(np.fft.rfft(rng.standard_normal(n)) * response, n=n)
    return x / (np.std(x) + 1e-12)


def add(bus, x, sec, gain=1, pan=0, room=0):
    start = round(sec * SR)
    if start < 0:
        x, start = x[-start:], 0
    count = min(len(x), N - start)
    if count <= 0:
        return
    if x.ndim == 1:
        x = np.column_stack((x * np.sqrt((1-pan)/2), x * np.sqrt((1+pan)/2)))
    buses[bus][start:start+count] += x[:count] * gain
    if room:
        buses['room'][start:start+count] += x[:count] * gain * room


def kick():
    t = time(.38)
    freq = 49 + 155*np.exp(-t/.013) + 27*np.exp(-t/.053)
    phase = 2*np.pi*np.cumsum(freq)/SR
    body = np.sin(phase)*env(t, .00045, .096)
    knock = np.sin(phase*2.0)*env(t, .0005, .028)*.19
    click = band_noise(.38, 1600, 7200)*np.exp(-t/.0023)*.075
    return np.tanh((body + knock)*1.75)/1.50 + click


def snare():
    t = time(.32)
    noise = band_noise(.32, 650, 8800)
    snap = noise * env(t, .0004, .038)
    clap = np.zeros_like(t)
    for delay, gain in [(0, .37), (.009, .27), (.019, .18)]:
        phase = np.maximum(t-delay, 0)
        clap += gain*noise*(t>=delay)*env(phase, .0002, .025)
    body = (np.sin(2*np.pi*178*t)+.3*np.sin(2*np.pi*327*t))*env(t,.0005,.052)
    return snap*.21 + clap*.28 + body*.24


def hat(dur=.075, open=False):
    t = time(dur)
    metallic = sum(np.sin(2*np.pi*f*t+p) for f,p in [(6511,.4),(8249,.9),(10957,.3)])/3
    return (band_noise(dur, 6400, 12500)*.8 + metallic*.2)*env(t,.0005,.038 if open else .011)


def puck(strength=1, pitch=1):
    t = time(.22)
    thwack = band_noise(.22, 1000, 8500)*env(t,.0002,.008)*.25
    shell = sum(a*np.sin(2*np.pi*f*pitch*t)*np.exp(-t/tau)
                for f,a,tau in [(487,.25,.032),(1361,.22,.023),(2277,.14,.014),(4129,.05,.009)])
    return strength*(thwack+shell)*(1-np.exp(-t/.0002))


def skate(sec, dur=.31, gain=.09, pan=0, reverse=False):
    t = time(dur)
    # Uneven granular scrape followed by a soft ice spray, no continuous hiss.
    shape = np.sin(np.pi*t/dur)**1.1
    grain = .72+.18*np.sin(2*np.pi*73*t)+.10*np.sin(2*np.pi*131*t+.8)
    x = band_noise(dur, 950, 6300)*shape*grain
    if reverse:
        x = x[::-1]
    add('fx', x, sec, gain, pan, .10)


def bass(freq, dur=.32, weight=1):
    t = time(dur+.10)
    phase = 2*np.pi*freq*t + .018*np.sin(2*np.pi*freq*2*t)*np.exp(-t/.10)
    x = np.zeros_like(t)
    for h in range(1, 10):
        x += np.sin(h*phase)*np.exp(-h/(2+3*np.exp(-t/.06)))/h
    shape = (1-np.exp(-t/.004))*np.exp(-t/.5)*np.exp(-np.maximum(t-dur,0)/.024)
    return np.tanh(x*2.8)*shape*weight


def chord(notes, dur, attack=.012, bright=1):
    t = time(dur)
    stereo = np.zeros((len(t),2))
    for c, detune in enumerate([.9977, 1.0023]):
        for ni, note in enumerate(notes):
            for h in range(1, 13):
                a = np.exp(-h/(2.8*bright)) / h**1.3
                a = a*(.43+.57*np.exp(-t/(.7+.2*ni)))
                stereo[:,c] += np.sin(2*np.pi*note*detune*h*t + ni*.6 + c*.04)*a
    shape = (1-np.exp(-t/attack))*np.exp(-t/1.5)
    shape *= np.minimum(1,np.maximum(dur-t,0)/.23)
    return np.tanh(stereo*.55)*shape[:,None]


def pluck(freq, dur=.85):
    t = time(dur)
    result = np.zeros((len(t),2))
    for c,detune in enumerate([.999,1.001]):
        for h in range(1,7):
            result[:,c] += np.sin(2*np.pi*freq*detune*h*t + h*.08)*np.exp(-t*h/.47)/h**1.8
    result *= env(t,.003,.46)[:,None]
    return result


def impact(sec, gain=.5, final=False):
    t = time(.92)
    phase = 2*np.pi*(42*t + 65*.035*(1-np.exp(-t/.035)))
    sub = np.sin(phase)*env(t,.001,.20)
    add('fx',sub,sec,gain)
    add('fx',puck(1.2,.82 if final else 1),sec,gain*.62,0,.50)
    # Wide low-mid strike produces size without overwhelming sub or dialogue.
    thud = band_noise(.92, 140, 1500)*env(t,.001,.06)
    add('fx',thud,sec,gain*.14,0,.5)


# 0–1.875: a cold opening that becomes anticipation, rather than an instant loop.
t = time(1.875)
ice_bed = band_noise(1.875, 280, 3900)*(.024+.014*np.sin(2*np.pi*.55*t))
ice_bed *= np.sin(np.pi*t/1.875)**.8
add('fx',ice_bed,0,1,-.18,.35)
add('music',chord([73.4162,146.8324,220],1.875,.18,.50),0,.047,room=.3)
skate(.06,.57,.053,-.55)
skate(.81,.49,.035,.55,True)
add('fx',puck(.3,.75),.07,.11,room=.35)
for index,sec in enumerate([.92,1.21,1.43,1.59,1.71,1.79]):
    add('fx',puck(.4,.82+index*.025),sec,.072+index*.016,(-1)**index*.3,.12)
t = time(1.25)
riser = band_noise(1.25,600,6600)*(t/1.25)**2
riser *= .72+.28*np.sin(2*np.pi*(8*t+13*t*t))
add('fx',riser,.60,.068,room=.15)

# 1.875 reveal: massive but brief; the subsequent beat has room to breathe.
impact(4*BEAT,.60)
add('music',chord([146.8324,220,293.665,349.228],2.5,.005,.8),4*BEAT,.115,room=.17)

kick_beats = [4,6,7.5,8,10,12,13.5,14,16,18,19.5,20,22,23.25,24,26,28,30]
for beat in kick_beats:
    add('drums',kick(),beat*BEAT,.66 if beat<24 else .56)
for beat in [5,7,9,11,13,15,17,19,21,23,25,27,29]:
    add('drums',snare(),beat*BEAT,.70 if beat<24 else .53,room=.16)
for beat in np.arange(4.5,29.5,.5):
    # Less ticking during the score animation and a small pause before each reveal.
    if 5.75<beat<8 or any(abs(beat-mark)<.26 for mark in [10,16,24]):
        continue
    is_off = beat%1!=0
    add('drums',hat(.12 if is_off else .07,is_off),beat*BEAT,
        .081 if is_off else .043,.23 if is_off else -.22)

# Seven exact foley score ticks (48 -> 41), isolated above a restrained groove.
click_times = [2.75 + i*.15 for i in range(7)]
for i,sec in enumerate(click_times):
    add('fx',puck(.8,1.18-i*.041),sec,.195 if i<6 else .25,0,.075)

D2, BB1, F2, C2 = 73.4162,58.2705,87.3071,65.4064
for beat,note,dur,amp in [
    (4,D2,.32,.24),(5.75,D2,.16,.15),(6.5,D2,.25,.17),
    (8,D2,.38,.23),(9.5,D2,.16,.16),(10,D2,.31,.22),
    (11.5,D2,.15,.17),(12,D2,.30,.23),(13.25,C2,.17,.16),(14,D2,.35,.22),
    (16,BB1,.38,.25),(17.5,BB1,.20,.19),(18,BB1,.32,.22),
    (20,F2,.36,.23),(21.5,F2,.20,.17),(22,C2,.32,.21),
    (24,F2,.55,.22),(26,F2,.36,.16),(28,C2,.30,.14),(30,F2,.45,.19)]:
    add('bass',bass(note,dur),beat*BEAT,amp)

skate(4.39,.27,.07,.48)
impact(10*BEAT,.32)
add('music',chord([146.8324,220,293.665],2.8,.018,.70),10*BEAT,.073,room=.2)

# Mini fill before the positive reveal, with hand-placed toms rather than a loop.
for beat,freq,amp in [(15,155,.09),(15.5,125,.10),(15.75,104,.12)]:
    t = time(.20)
    x = np.sin(2*np.pi*(freq*t + 14*.025*(1-np.exp(-t/.025))))*env(t,.001,.057)
    x += band_noise(.20,700,4400)*env(t,.0004,.015)*.07
    add('drums',x,beat*BEAT,amp,(-1 if beat==15 else 1)*.30,.14)
skate(7.12,.37,.088,-.48)

# 7.5: opening into Bb/F harmony and a rising three-note motif.
impact(16*BEAT,.47)
add('music',chord([116.541,174.614,233.082,293.665],2.2,.025,1.25),16*BEAT,.115,room=.3)
add('music',chord([130.813,174.614,220,261.626],2.2,.02,1.45),20*BEAT,.10,room=.3)
for beat,note,amp in [(16.5,293.665,.06),(18,349.228,.065),(19.5,440,.062),
                      (21.0,523.251,.048),(22.25,440,.044)]:
    x=pluck(note)
    add('music',x,beat*BEAT,amp,room=.40)
    add('music',x[:,::-1],beat*BEAT+BEAT*.75,amp*.22,room=.15)

# 11.25: distinct F(add9) brand stamp, percussion tapers to a clean final cadence.
skate(10.86,.38,.075,.4,True)
impact(24*BEAT,.65,True)
add('music',chord([87.3071,174.614,220,261.626,391.995],3.5,.008,1.6),24*BEAT,.14,room=.35)
for beat,note,amp in [(24,523.251,.055),(25.5,440,.048),(27,349.228,.055),(28.5,391.995,.035)]:
    add('music',pluck(note,1.2),beat*BEAT,amp,room=.4)
add('fx',puck(.7,.9),30*BEAT,.10,room=.3)
add('music',chord([174.614,220,261.626,349.228],.935,.006,1.3),30*BEAT,.10,room=.16)

# Short stereo room: early reflections plus filtered diffuse decay. This creates
# a cohesive soundstage while the kick and bass remain tightly centered and dry.
def room_ir(seed):
    rr=np.random.default_rng(seed)
    dur=.85
    t=time(dur)
    ir=rr.standard_normal(len(t))*np.exp(-t/.15)
    ir[t<.029]=0
    f=np.fft.rfftfreq(len(t),1/SR)
    ir=np.fft.irfft(np.fft.rfft(ir)*np.exp(-(f/4700)**4),n=len(t))
    ir*=.0028
    for sec,amp in [(.031,.11),(.053,.068),(.079,.039),(.113,.027),(.167,.018)]:
        ir[round(sec*SR)]+=amp
    return ir

room=np.zeros((N,2))
for c in [0,1]:
    impulse=room_ir(842+c*193)
    length=1<<(N+len(impulse)-2).bit_length()
    room[:,c]=np.fft.irfft(np.fft.rfft(buses['room'][:,c],length)*
                         np.fft.rfft(impulse,length),length)[:N]

# Clear sub transients with musical sidechain recovery.
duck=np.ones(N)
for beat in kick_beats:
    start=round(beat*BEAT*SR)
    count=min(round(.24*SR),N-start)
    tt=np.arange(count)/SR
    duck[start:start+count]*=1-.43*np.exp(-tt/.055)
buses['bass']*=duck[:,None]
buses['music']*=(.7+.3*duck)[:,None]

mix=buses['drums']+buses['bass']+buses['music']+buses['fx']+room
# Soft saturation controls the reveal accents so the quiet space can coexist
# with a substantial beat at phone-speaker playback levels.
mix=np.tanh(mix*2.10)/2.10
mix[:240]*=np.linspace(0,1,240)[:,None]
mix[-7200:]*=np.linspace(1,0,7200)[:,None]**1.35
mix*=10**(-1.3/20)/np.max(np.abs(mix))
pcm=np.round(mix*32767).astype('<i2')
output=Path(__file__).with_name('soundtrack.wav')
with wave.open(str(output),'wb') as out:
    out.setnchannels(2); out.setsampwidth(2); out.setframerate(SR)
    out.writeframes(pcm.tobytes())
report={
    'file':str(output),'duration_seconds':N/SR,'sample_rate':SR,'channels':2,
    'sample_frames':N,'bit_depth':16,'tempo_bpm':128,
    'peak_dbfs':float(20*np.log10(np.max(np.abs(pcm.astype(float)))/32768)),
    'rms_dbfs':float(20*np.log10(np.sqrt(np.mean((pcm.astype(float)/32768)**2)))),
    'clipped_samples':int(np.sum(np.abs(pcm.astype(int))>=32767)),
    'scene_accent_seconds':[0,1.875,4.6875,7.5,11.25],
    'score_click_seconds':click_times,'final_cadence_seconds':14.0625,
    'first_sample':pcm[0].tolist(),'last_sample':pcm[-1].tolist(),
    'rights':'Original deterministic synthesis; no external samples or music.'}
output.with_suffix('.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
