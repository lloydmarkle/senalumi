import type { Planet, Team, Renderable } from "./game";

// See also https://newt.phys.unsw.edu.au/jw/notes.html
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
    const set = (v: number, t :number) => gain.gain.linearRampToValueAtTime(v, T + t);
    set(0.0, -T);
    set(0.0, 0);
    set(1.0, a);
    set(sustain, a + d);
    set(sustain, a + d + s);
    set(0.0, a + d + s + r);
    return gain;
}

class AudioEffects {
    constructor(
        readonly ctx: AudioContext,
        readonly gain: GainNode,
    ) {}

    bend(freqStart: number, freqEnd: number, duration: number) {
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
        gain.connect(this.gain);

        step.start(now);
        step.stop(now + duration);
    }

    pop(freqStart: number, freqEnd: number) {
        const now = this.ctx.currentTime;
        const step = this.ctx.createOscillator();

        step.frequency.setValueAtTime(freqStart, now);
        step.frequency.linearRampToValueAtTime(freqEnd, now + 0.5);
        const gain = adsr(this.ctx.createGain(), now, .01, .01, .1, .05, .8);
        step.connect(gain);
        gain.connect(this.gain);

        step.start();
        step.stop(now + .5);
    }

    pulse() {
        const now = this.ctx.currentTime;
        const duration = 0.2;

        const gain = this.ctx.createGain();
        gain.connect(this.gain);
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
}

class DebounceSound {
    private nextSoundTime = 0;

    constructor(
        private interval: (() => number) | number,
        private playFn: (freq: number, detune: number) => void,
    ) {}

    play(freq: number, detune: number) {
        const tnow = new Date().getTime();
        if (tnow < this.nextSoundTime) {
            return;
        }

        const nextTime = typeof this.interval === 'function' ? this.interval() : this.interval;
        this.nextSoundTime = tnow + (nextTime * 1000);
        this.playFn(freq, detune);
    }
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
export class Sound {
    private ctx: AudioContext;
    private noiseBuffer: AudioBuffer;
    private main: GainNode;
    private fx?: AudioEffects;
    private shortSound?: DebounceSound;
    private satPopSound?: DebounceSound;

    menu?: MenuAudio;

    resume() {
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

        this.fx = new AudioEffects(this.ctx, this.main);
        this.menu = new MenuAudio(this.ctx, this.main, this.fx);

        this.shortSound = new DebounceSound(
            0.1,
            (freq, detune) => {
                const duration = 0.2;
                const now = this.ctx.currentTime;
                const gain = adsr(this.ctx.createGain(),
                    // now, .15 * duration, .002 * duration, .25 * duration, .6 * duration, .4);
                    // now, .2 * duration, .05 * duration, .05 * duration, .70 * duration, .4);
                    now, .04, .01, .01, .14, .4);
                // const gain = context.createGain();
                // gain.gain.setValueAtTime(0.001, 0);
                // gain.gain.linearRampToValueAtTime(1, now + duration * 0.1);
                // gain.gain.linearRampToValueAtTime(0.001, now + duration);
                gain.connect(this.main);

                const step = this.ctx.createOscillator();
                step.connect(gain);
                step.detune.value = detune;
                step.frequency.setValueAtTime(freq, now);

                // step.type = 'triangle';
                step.start();
                step.stop(now + duration);
            }
        );

        this.satPopSound = new DebounceSound(
            () => 0.05 + Math.random() * 0.05,
            (freq, detune) => {
                const now = this.ctx.currentTime;

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
        );
    }

    volume(value: number): void {
        if (this.ctx) {
            this.main.gain.setValueAtTime(value * .1, 0);
        }
    }

    pulse(): void {
        this.fx?.pulse();
    }

    planetCapture(): void {
        this.fx?.bend(mtof(60), mtof(67), 1.5);
        this.fx?.pop(mtof(52), mtof(60));
    }
    planetUpgrade(): void {
        this.fx?.bend(mtof(67), mtof(72), 1.5);
        this.fx?.pop(mtof(60), mtof(67));
    }
    planetPop(): void {
        this.fx?.bend(mtof(48), mtof(36), 1.5);
        this.fx?.pop(mtof(53), mtof(42));
    }

    planetPartialHealthSound(value: number): void {
        this.shortSound?.play(mtof(43), value * 24);
    }
    planetPartialUpgradeSound(value: number): void {
        this.shortSound?.play(mtof(48), value * 24);
    }
    planetPartialCaptureSound(value: number): void {
        this.shortSound?.play(mtof(36), value * 24);
    }

    satellitePop() {
        this.satPopSound?.play(mtof(60), (-12 + Math.round(Math.random() * 24)) * 100);
    }
}

// I'm not super happy with these sounds but at least it's wired up with the code so
// they can be changed if I get better ideas. Overall I'm not really loving the game
// audio either so this whole file needs some improvement.
class MenuAudio {
    constructor(
        private ctx: AudioContext,
        private main: GainNode,
        private fx: AudioEffects,
    ) {}

    forwardNavigation() {
        this.shortSound(mtof(60), 0);
    }

    backNavigation() {
        this.shortSound(mtof(48), 0);
    }

    toggle() {
        this.shortSound(mtof(64), 0);
    }

    button() {
        this.tick(mtof(76));
    }

    teamSelect() {
        this.tick(mtof(72));
    }

    menuOpen() {
        this.fx.bend(mtof(60), mtof(72), .5);
    }

    menuClose() {
        this.fx.bend(mtof(72), mtof(60), .5);
    }

    private tick(freq: number) {
        const duration = .05;
        const now = this.ctx.currentTime;

        const gain = adsr(this.ctx.createGain(), now,
            .01, .01, .0, .01, .4);
        gain.connect(this.main);

        const step = this.ctx.createOscillator();
        step.connect(gain);
        step.frequency.setValueAtTime(freq, now);

        step.type = 'triangle';
        step.start();
        step.stop(now + duration);
    }

    private shortSound(freq: number, detune: number) {
        const duration = .2;
        const now = this.ctx.currentTime;

        const gain = adsr(this.ctx.createGain(),
            // now, .15 * duration, .002 * duration, .25 * duration, .6 * duration, .4);
            // now, .2 * duration, .05 * duration, .05 * duration, .70 * duration, .4);
            now, .04, .01, .01, .14, .4);
        gain.connect(this.main);

        const step = this.ctx.createOscillator();
        step.connect(gain);
        step.detune.value = detune;
        step.frequency.setValueAtTime(freq, now);

        step.start();
        step.stop(now + duration);
    }
}