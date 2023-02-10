import type { Planet, Game, Team, Renderable } from "./game";

const A4 = 440;
function mtof(note: number): number {
	return A4 * Math.pow(2, (note - 69) / 12);
}

// Several links that helped along the way:
// https://en.wikipedia.org/wiki/Piano_key_frequencies
// https://ui.dev/web-audio-api
// Some "drum" sounds based on https://clockworkchilli.com/blog/3_html5_drum_machine_with_web_audio
// which may have copied some parts of https://dev.opera.com/articles/drum-sounds-webaudio/
// also (probably) copied to https://ui.dev/web-audio-api but it's a nice writeup
// https://www.redblobgames.com/x/1618-webaudio/
// Also
// https://webaudioplayground.appspot.com/# is really cool
// and so is https://hoch.github.io/canopy/
// https://web.dev/webaudio-games/

function adsr(gain: GainNode, T: number, a: number, d: number, s: number, r: number, sustain: number) {
    const set = (v, t) => gain.gain.linearRampToValueAtTime(v, T + t);
    set(0.0, -T);
    set(0.0, 0);
    set(1.0, a);
    set(sustain, a + d);
    set(sustain, a + d + s);
    set(0.0, a + d + s + r);
    return gain;
}

interface AudioDriver {
    resume(): void;

    pulse(): void;
    satellitePop(): void;
    planetCapture(): void;
    planetUpgrade(): void;
    planetPartialHealthSound(value: number): void;
    planetPartialUpgradeSound(value: number): void;
    planetPartialCaptureSound(value: number): void;
    planetPop(): void;

    volume(value: number): void;
}

export class PlanetAudio implements Renderable {
    private lastState: {
        health: number,
        upgrade: number,
        level: number,
        ownerTeam?: Team,
    };

    constructor(readonly planet: Planet, readonly audio: Sound) {
        this.lastState = {
            health: planet.health,
            upgrade: planet.upgrade,
            level: planet.level,
            ownerTeam: planet.owner?.team,
        };
    }

    destroy() {}

    tick(elapsedMS: number) {
        if (this.lastState.level !== this.planet.level) {
            if (this.lastState.level > this.planet.level) {
                this.audio.planetPop();
            } else {
                this.audio.planetUpgrade();
            }
            this.lastState.level = this.planet.level;
        } else if (this.lastState.ownerTeam !== this.planet.owner?.team) {
            if (this.planet.owner) {
                this.audio.planetCapture();
            }
            this.lastState.ownerTeam = this.planet.owner?.team;
        } else if (this.lastState.health !== this.planet.health) {
            this.audio.planetPartialHealthSound(this.planet.health);
            this.lastState.health = this.planet.health;
        } else if (this.lastState.upgrade !== this.planet.upgrade) {
            if (this.lastState.ownerTeam) {
                this.audio.planetPartialUpgradeSound(this.planet.upgrade);
            } else {
                this.audio.planetPartialCaptureSound(this.planet.upgrade);
            }
            this.lastState.upgrade = this.planet.upgrade;
        }
    }
}

// mostly based on https://ui.dev/web-audio-api
export class WebAudioSound implements AudioDriver {
    private nextSatellitePopSoundTime = 0;
    private nextShortSoundTime = 0;

    ctx: AudioContext;
    noiseBuffer: AudioBuffer;
    main: GainNode;

    constructor(readonly game: Game) {}

    resume() {
        return
        if (this.ctx) {
            return;
        }

        const AudioContext = (window.AudioContext ?? (window as any).webkitAudioContext);
        this.ctx = new AudioContext();

        const comp = this.ctx.createDynamicsCompressor();
        comp.connect(this.ctx.destination);

        this.main = this.ctx.createGain();
        this.main.gain.setValueAtTime(0.05, 0);
        this.main.connect(comp)
        // this.main.connect(this.ctx.destination)

        // based on https://clockworkchilli.com/blog/3_html5_drum_machine_with_web_audio
        // which may have copied some parts of https://dev.opera.com/articles/drum-sounds-webaudio/
        // also https://webaudioplayground.appspot.com/# is really cool
        const len = 1; // second
        this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * len, this.ctx.sampleRate);
        var noiseBufferOutput = this.noiseBuffer.getChannelData(0);
        for (var i = 0; i < this.noiseBuffer.length; i++) {
            noiseBufferOutput[i] = Math.random() * 2 - 1;
        }
    }

    volume(value: number): void {
        if (this.ctx) {
            this.main.gain.value = value;
        }
    }

    pulse(): void {
        if (!this.ctx) {
            return;
        }
        const now = this.ctx.currentTime;
        const duration = 0.2 //* this.speed // seconds

        const gain = this.ctx.createGain();
        gain.connect(this.main);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1.2, now + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        const osc = this.ctx.createOscillator();
        osc.connect(gain);
        osc.frequency.value = mtof(36)
        osc.frequency.exponentialRampToValueAtTime(mtof(0), now + duration);

        osc.start();
        osc.stop(now + duration);
    }

    planetCapture(): void {
        this.bendSound(mtof(60), mtof(67), 1.5);
        this.pop(mtof(52), mtof(60));
    }
    planetUpgrade(): void {
        this.bendSound(mtof(67), mtof(72), 1.5);
        this.pop(mtof(60), mtof(67));
    }
    planetPop(): void {
        this.bendSound(mtof(48), mtof(36), 1.5);
        this.pop(mtof(53), mtof(42));
    }

    private bendSound(freqStart: number, freqEnd: number, duration: number) {
        if (!this.ctx) {
            return;
        }

        const now = this.ctx.currentTime;
        const step = this.ctx.createOscillator();

        step.frequency.setValueAtTime(freqStart, now);
        step.frequency.linearRampToValueAtTime(freqEnd, now + duration);
        step.detune.linearRampToValueAtTime(6, now + duration);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(.8, now + duration * 0.2);
        gain.gain.linearRampToValueAtTime(0, now + duration);
        step.connect(gain);
        gain.connect(this.main);

        step.start(now);
        step.stop(now + duration);
    }

    private pop(freqStart: number, freqEnd: number) {
        if (!this.ctx) {
            return;
        }

        const now = this.ctx.currentTime;
        const step = this.ctx.createOscillator();

        step.frequency.setValueAtTime(freqStart, now);
        step.frequency.linearRampToValueAtTime(freqEnd, now + 0.5);
        const gain = adsr(this.ctx.createGain(), now, .01, .01, .1, .05, .8);
        step.connect(gain);
        gain.connect(this.main);

        step.start();
        step.stop(now + .5);
    }

    planetPartialHealthSound(value: number): void {
        this.shortSound(mtof(43), value * 24);
    }
    planetPartialUpgradeSound(value: number): void {
        this.shortSound(mtof(48), value * 24);
    }
    planetPartialCaptureSound(value: number): void {
        this.shortSound(mtof(36), value * 24);
    }

    private shortSound(freq: number, detune: number) {
        if (!this.ctx) {
            return;
        }

        const tnow = new Date().getTime();
        if (tnow < this.nextShortSoundTime) {
            return;
        }

        const context = this.ctx;
        const pause = 0.1;
        const duration = .2 // * game.speed ?
        const now = context.currentTime;
        this.nextShortSoundTime = tnow + (pause * 1000);

        const gain = adsr(this.ctx.createGain(),
            // now, .15 * duration, .002 * duration, .25 * duration, .6 * duration, .4);
            // now, .2 * duration, .05 * duration, .05 * duration, .70 * duration, .4);
            now, .04, .01, .01, .14, .4);
        // const gain = context.createGain();
        // gain.gain.setValueAtTime(0.001, 0);
        // gain.gain.linearRampToValueAtTime(1, now + duration * 0.1);
        // gain.gain.linearRampToValueAtTime(0.001, now + duration);
        gain.connect(this.main);

        const step = context.createOscillator();
        step.connect(gain);
        step.detune.value = detune;
        step.frequency.setValueAtTime(freq, now);

        // step.type = 'triangle';
        step.start();
        step.stop(now + duration);
    }

    satellitePop() {
        this.satPop(mtof(60), (-12 + Math.round(Math.random() * 24)) * 100);
    }

    private satPop(freq: number, detune: number) {
        if (!this.ctx) {
            return;
        }

        const tnow = new Date().getTime();
        if (tnow < this.nextSatellitePopSoundTime) {
            return;
        }

        const context = this.ctx;
        const pause = 0.05 + Math.random() * 0.05;
        const now = context.currentTime;
        this.nextSatellitePopSoundTime = tnow + (pause * 1000);

        const duration = 1.2 + Math.random() * 1.6; // * game.speed?
        var oscEnvelope = this.ctx.createGain();
        oscEnvelope.connect(this.main);
        oscEnvelope.gain.setValueAtTime(0.6, now);
        oscEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.4);

        var osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.connect(oscEnvelope);
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.value = detune;

        osc.start();
        osc.stop(now + duration);

        var oscEnvelope = this.ctx.createGain();
        oscEnvelope.connect(this.main);
        oscEnvelope.gain.setValueAtTime(0.4, now);
        oscEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.2);

        osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.connect(oscEnvelope);
        osc.frequency.setValueAtTime(mtof(68), now);
        osc.detune.value = detune * 2;

        osc.start();
        osc.stop(now + duration);
    }
}

export class Sound extends WebAudioSound {}
