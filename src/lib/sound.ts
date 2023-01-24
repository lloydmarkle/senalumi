import type { Planet, Game, Team, Renderable } from "./game";
import * as Tone from 'tone';

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
    // resume(): void;

    // primaryGain: AudioNode | Tone.Gain;

    // pulse(): void;
    // satellitePop(): void;
    // planetCapture(): void;
    // planetUpgrade(): void;
    // planetHurt(value: number): void;
    // planetHeal(value: number): void;
    // planetPower(value: number): void;
    // planetPop(): void;

    // volume(value: number): void;
}

export class PlanetAudio implements Renderable {
    private lastState: {
        health: number,
        upgrade: number,
        level: number,
        ownerTeam?: Team,
    };
    private changeOscillator: Tone.Oscillator;
    private stepOscillator: Tone.Oscillator;
    private nextShortSoundTime = 0;

    constructor(readonly planet: Planet, readonly audio: Sound) {
        this.lastState = {
            health: planet.health,
            upgrade: planet.upgrade,
            level: planet.level,
            ownerTeam: planet.owner?.team,
        };
        this.changeOscillator = new Tone.Oscillator().connect(audio.primaryGain);
        this.stepOscillator = new Tone.Oscillator().connect(audio.primaryGain);
    }

    destroy() {
        this.changeOscillator.dispose();
        this.stepOscillator.dispose();
    }

    tick(elapsedMS: number) {
        if (this.lastState.level !== this.planet.level) {
            if (this.lastState.level > this.planet.level) {
                this.popSound();
            } else {
                this.upgradeSound();
            }
            this.lastState.level = this.planet.level;
        } else if (this.lastState.ownerTeam !== this.planet.owner?.team) {
            if (this.planet.owner) {
                this.captureSound();
            }
            this.lastState.ownerTeam = this.planet.owner?.team;
        } else if (this.lastState.health !== this.planet.health) {
            this.partialHealthSound(this.planet.health);
            this.lastState.health = this.planet.health;
        } else if (this.lastState.upgrade !== this.planet.upgrade) {
            if (this.lastState.ownerTeam) {
                this.partialUpgradeSound(this.planet.upgrade);
            } else {
                this.partialCaptureSound(this.planet.upgrade);
            }
            this.lastState.upgrade = this.planet.upgrade;
        }
    }

    private shortSound(freq: number, detune: number) {
        const tnow = new Date().getTime();
        if (tnow < this.nextShortSoundTime) {
            return;
        }

        const context = this.audio.audioContext;
        const pause = 0.1;
        const duration = .2 // * game.speed ?
        const now = context.currentTime;
        this.nextShortSoundTime = tnow + (pause * 1000);

        const gain = adsr(this.audio.audioContext.createGain(),
            // now, .15 * duration, .002 * duration, .25 * duration, .6 * duration, .4);
            now, .2 * duration, .05 * duration, .05 * duration, .70 * duration, .4);
            // now, .04, .01, .01, .14, .4);
        // const gain = context.createGain();
        // gain.gain.setValueAtTime(0.001, 0);
        // gain.gain.linearRampToValueAtTime(1, now + duration * 0.1);
        // gain.gain.linearRampToValueAtTime(0.001, now + duration);
        gain.connect(this.audio.main);

        const step = context.createOscillator();
        step.connect(gain);
        step.detune.value = detune;
        step.frequency.setValueAtTime(freq, now);
        // step.frequency.exponentialRampToValueAtTime(0.001, now + duration);

        step.start();
        step.stop(now + duration);

    //     // // based on https://clockworkchilli.com/blog/3_html5_drum_machine_with_web_audio
    //     //var noiseEnvelope = this.audio.audioContext.createGain();
    //     var noiseEnvelope = adsr(this.audio.audioContext.createGain(), now, .01, .01, .04, .14, .2);
    //     noiseEnvelope.connect(this.audio.main);
    //     // noiseEnvelope.gain.setValueAtTime(1, now);
    //     // noiseEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration);

    //     var noiseFilter = this.audio.audioContext.createBiquadFilter();
    //     noiseFilter.type = 'highpass';
    //     noiseFilter.frequency.value = 1000;
    //     noiseFilter.connect(noiseEnvelope);

    //     var noise = this.audio.audioContext.createBufferSource();
    //     noise.buffer = this.audio.noiseBuffer;
    //     noise.connect(noiseFilter);

    //     var oscEnvelope = this.audio.audioContext.createGain();
    //     oscEnvelope.connect(this.audio.main);
    //     oscEnvelope.gain.setValueAtTime(0.7, now);
    //     oscEnvelope.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.5);

    //     var osc = this.audio.audioContext.createOscillator();
    //     osc.type = 'triangle';
    //     osc.connect(oscEnvelope);
    //     osc.frequency.setValueAtTime(freq, now);
    //     osc.detune.value = detune;

    //     osc.start();
    //     osc.stop(now + duration);
    //     noise.start();
    //     noise.stop(now + duration);
    }

    private bendSound(freqStart: number, freqEnd: number, duration: number) {
        // const duration = 0.1 // * game.speed ?
        const now = this.audio.audioContext.currentTime;
        const step = this.audio.audioContext.createOscillator();

        step.frequency.setValueAtTime(freqStart, now);
        step.frequency.linearRampToValueAtTime(freqEnd, now + duration);
        step.detune.linearRampToValueAtTime(6, now + duration);

        const gain = this.audio.audioContext.createGain();
        gain.gain.setValueAtTime(0, 0);
        gain.gain.linearRampToValueAtTime(.8, now + duration * 0.2);
        gain.gain.linearRampToValueAtTime(0, now + duration);
        step.connect(gain);
        gain.connect(this.audio.main);

        step.start();
        step.stop(now + duration);
    }

    private captureSound(): void {
        this.upgradeSound();
    }
    private upgradeSound(): void {
        // this.changeOscillator.frequency.value = "C4";
        // this.changeOscillator.frequency.rampTo("G4", 2);
        // this.changeOscillator.volume.value = 0;
        // this.changeOscillator.volume.rampTo(-100, 2)
        // this.changeOscillator.start().stop("+2");
        this.bendSound(Tone.mtof(60), Tone.mtof(67), 1.5);
    }
    private popSound(): void {
        // this.changeOscillator.frequency.value = "C3";
        // this.changeOscillator.frequency.rampTo("C2", 2);
        // this.changeOscillator.volume.value = 0;
        // this.changeOscillator.volume.rampTo(-100, 2)
        // this.changeOscillator.start().stop("+2");
        this.bendSound(Tone.mtof(48), Tone.mtof(36), 1.5);
    }

    private partialHealthSound(value: number): void {
        if (this.stepOscillator.state === 'stopped') {
            // this.stepOscillator.frequency.value = "G4";
            // this.stepOscillator.volume.value = 0;
            // this.stepOscillator.volume.rampTo(-100, .2)
            // this.stepOscillator.detune.value = value * 6;
            // this.stepOscillator.start().stop("+0.2");
            this.shortSound(Tone.mtof(43), value * 24);
        }
    }
    private partialUpgradeSound(value: number): void {
        if (this.stepOscillator.state === 'stopped') {
            // this.stepOscillator.frequency.value = "C4";
            // this.stepOscillator.volume.value = 0;
            // this.stepOscillator.volume.rampTo(-100, .2)
            // this.stepOscillator.detune.value = value * 6;
            // this.stepOscillator.start().stop("+.2");

            // this.stepOscillator.frequency.value = "C4";
            // this.stepOscillator.volume.exponentialRampTo(-10, "+0.01")
            // this.stepOscillator.volume.exponentialRampTo(-100, "+0.1")
            // this.stepOscillator.detune.value = value * 6;
            // this.stepOscillator.start().stop("+0.1");
            this.shortSound(Tone.mtof(48), value * 24);
        }
    }
    private partialCaptureSound(value: number): void {
        if (this.stepOscillator.state === 'stopped') {
            // this.stepOscillator.frequency.value = "C3";
            // this.stepOscillator.volume.value = 0;
            // this.stepOscillator.volume.rampTo(-100, 0.2)
            // this.stepOscillator.detune.value = value * 12;
            // this.stepOscillator.start().stop("+0.2");
            this.shortSound(Tone.mtof(48), value * 24);
        }
    }
}

export class ToneSound implements AudioDriver {
    private drumSynth: Tone.MembraneSynth;
    private satSynth: Tone.PolySynth<any>;
    private planetSynth: Tone.PolySynth<any>;
    private _volume: Tone.Volume;
    primaryGain: Tone.Gain;
    main: GainNode;
    noiseBuffer: AudioBuffer;

    get audioContext() { return Tone.getContext().rawContext; }
    constructor(readonly game: Game) {
        this.main = this.audioContext.createGain();
        this.primaryGain = new Tone.Gain(.05)
    }

    async resume() {
        if (this.satSynth) {
            return;
        }
        await Tone.start().then(() => {
            this._volume = new Tone.Volume(0);
            this._volume.toDestination();
            this._volume.connect(this.main)
            this.primaryGain.connect(this._volume);

            // based on https://clockworkchilli.com/blog/3_html5_drum_machine_with_web_audio
            // which may have copied some parts of https://dev.opera.com/articles/drum-sounds-webaudio/
            // also https://webaudioplayground.appspot.com/# is really cool
            const len = 1; // second
            this.noiseBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * len, this.audioContext.sampleRate);
            var noiseBufferOutput = this.noiseBuffer.getChannelData(0);
            for (var i = 0; i < this.noiseBuffer.length; i++) {
                noiseBufferOutput[i] = Math.random() * 2 - 1;
            }

            const comp = this.audioContext.createDynamicsCompressor();
            comp.connect(this.audioContext.destination);
            this.main.gain.value = 0.1;
            this.main.connect(comp)

            this.planetSynth = new Tone.PolySynth({
                maxPolyphony: 16,
                voice: Tone.Synth,
            }).connect(this.primaryGain);

            this.satSynth = new Tone.PolySynth({
                maxPolyphony: 32,
                volume: -15,
                voice: Tone.Synth,
            }).connect(this.primaryGain);

            this.drumSynth = new Tone.MembraneSynth({ volume: -10 }).connect(this.primaryGain);
        });
    }

    volume(value: number) {
        if (this.satSynth) {
            // this._volume.volume.value = -10 * (1 - value);
        }
    }

    pulse(): void {
        if (!this.satSynth) {
            return;
        }

        const now = this.audioContext.currentTime;
        const duration = 0.2 //* this.speed // seconds

        const gain = this.audioContext.createGain();
        gain.connect(this.main);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1.2, now + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        const osc = this.audioContext.createOscillator();
        osc.connect(gain);
        osc.frequency.value = Tone.mtof(36)
        osc.frequency.exponentialRampToValueAtTime(Tone.mtof(0), now + duration);

        osc.start();
        osc.stop(now + duration);

        // this.drumSynth.triggerAttackRelease("C1", .2);
    }
    planetCapture(): void {
        if (!this.satSynth) {
            return;
        }
        this.planetSynth.triggerAttackRelease("G4", .5);
        // this.planetSynth.triggerAttackRelease("C4", .5);
        // this.planetSynth.triggerAttackRelease("E4", .5);
        // this.planetSynth.triggerAttackRelease("G4", .5);
    }
    planetUpgrade(): void {
        if (!this.satSynth) {
            return;
        }
        // this.osc.frequency.value = "C3";
        // this.osc.frequency.rampTo("C4", .5);
        // this.osc.start().stop("+0.5");
    }
    planetPop(): void {
        if (!this.satSynth) {
            return;
        }
        // this.osc.frequency.value = "C4";
        // this.osc.frequency.rampTo("C2", .5);
        // this.osc.start().stop("+0.5");
    }
    planetHurt(value: number): void {
        if (!this.satSynth) {
            return;
        }
        // this.osc.frequency.setValueAtTime("C5", "+0");
        // this.osc.detune.setValueAtTime(-value, "+0")
        // this.osc.start().stop("+0.1");
        // this.planetSynth.triggerAttackRelease("C#4", .5);
    }
    planetHeal(value: number): void {
        if (!this.satSynth) {
            return;
        }
    }
    planetPower(value: number): void {
        if (!this.satSynth) {
            return;
        }
    }

    satellitePop() {
        if (!this.satSynth) {
            return;
        }
        this.satSynth.triggerAttackRelease("E3", .001);
        // this.synth.triggerAttackRelease("E4", .005);
    }
}

// mostly based on https://ui.dev/web-audio-api
export class WebAudioSound implements AudioDriver {
    private ctx: AudioContext;
    primaryGain: GainNode;
    private get now() { return this.ctx.currentTime; }
    private get speed() { return this.game.config.gameSpeed; }

    constructor(readonly game: Game) {
    }

    resume() {
        const AudioContext = (window.AudioContext ?? (window as any).webkitAudioContext);
        this.ctx = new AudioContext();
        this.primaryGain = this.ctx.createGain();
        this.primaryGain.gain.setValueAtTime(0.05, 0);
        this.primaryGain.connect(this.ctx.destination);
    }

    volume(value: number): void {
        if (this.ctx) {
            this.primaryGain.gain.setValueAtTime(value, 0);
        }
    }

    pulse(): void {
    }
    planetCapture(): void {
    }
    planetUpgrade(): void {
    }
    planetPop(): void {
    }
    planetHurt(value: number): void {
    }
    planetHeal(value: number): void {
    }
    planetPower(value: number): void {
    }

    satellitePop() {
        if (!this.ctx) {
            return;
        }
        const duration = 0.5 * this.speed // seconds
        const kickOscillator = this.ctx.createOscillator();
        // Frequency in Hz. This corresponds to a C note.
        kickOscillator.frequency.setValueAtTime(Math.random() * 240 + 1300 * this.speed, this.now);
        kickOscillator.frequency.exponentialRampToValueAtTime(0.001, this.now + duration);

        const kickGain = this.ctx.createGain();
        kickGain.gain.setValueAtTime(1, 0);
        kickGain.gain.exponentialRampToValueAtTime(0.001, this.now + duration);
        kickOscillator.connect(kickGain);
        kickGain.connect(this.primaryGain);

        kickOscillator.start();
        // stop the oscillator after half a second.
        kickOscillator.stop(this.now + duration);
    }
}

export class Sound extends ToneSound {}
