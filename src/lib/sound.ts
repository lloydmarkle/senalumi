import type { Game } from "./game";
import * as Tone from 'tone';

interface AudioDriver {
    resume(): void;

    pulse(): void;
    satellitePop(): void;
    planetCapture(): void;
    planetUpgrade(): void;
    planetPop(): void;

    volume(value: number): void;
}

export class ToneSound implements AudioDriver {
    private drumSynth: Tone.MembraneSynth;
    private satSynth: Tone.PolySynth<any>;
    private planetSynth: Tone.PolySynth<any>;
    constructor(readonly game: Game) {}

    async resume() {
        if (this.satSynth) {
            return;
        }
        await Tone.start().then(() => {
            this.planetSynth = new Tone.PolySynth({
                maxPolyphony: 16,
                voice: Tone.Synth,
            }).toDestination();

            this.satSynth = new Tone.PolySynth({
                maxPolyphony: 32,
                volume: -15,
                voice: Tone.Synth,
            }).toDestination();

            this.drumSynth = new Tone.MembraneSynth({ volume: -10 }).toDestination();
        });
    }

    volume(value: number) {
        if (this.satSynth) {
            this.satSynth.volume.value = -20 * (1 - value);
        }
    }

    pulse(): void {
        if (!this.satSynth) {
            return;
        }
        this.drumSynth.triggerAttackRelease("C1", .2);
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
        this.planetSynth.triggerAttackRelease("C4", .5);
        this.planetSynth.triggerAttackRelease("A5", .5);
        // const now = this.planetSynth.now();
        // this.planetSynth.triggerAttackRelease("C5", 1);
        // this.planetSynth.triggerAttackRelease("E5", .75, .25 + now);
        // this.planetSynth.triggerAttackRelease("G5", .5, .5 + now);
    }
    planetPop(): void {
        if (!this.satSynth) {
            return;
        }
        this.planetSynth.triggerAttackRelease("D#4", .5);
    }

    satellitePop() {
        if (!this.satSynth) {
            return;
        }
        this.satSynth.triggerAttackRelease("E3", .005);
        // this.synth.triggerAttackRelease("E4", .005);
    }
}

// mostly based on https://ui.dev/web-audio-api
export class WebAudioSound implements AudioDriver {
    private ctx: AudioContext;
    private primaryGain: GainNode;
    private get now() { return this.ctx.currentTime; }
    private get speed() { return this.game.config.gameSpeed; }

    constructor(readonly game: Game) {
    }

    resume() {
        const AudioContext = (window.AudioContext ?? (window as any).webkitAudioContext);
        this.ctx = new AudioContext();
        this.primaryGain = this.ctx.createGain();
        this.primaryGain.gain.setValueAtTime(0.5, 0);
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
