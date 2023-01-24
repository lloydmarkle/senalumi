<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { Game } from '../game';
    import type { Renderer } from '../render';
    import Toggle from './Toggle.svelte';
    import * as Tone from 'tone';

    export let gfx: Renderer;
    export let game: Game;

    function spawn1K() {
        let end = game.satellites.length + 1000;
        while (game.satellites.length < end) {
            game.pulse();
        }
    }

    const volume = new Tone.Volume(0).toDestination();
    const tgain = new Tone.Gain(.05).connect(volume);
    const osc = new Tone.Oscillator().connect(tgain);
    let ctx: AudioContext;
    let gain: GainNode;
    let active = false;
    let started = false;
    async function audioTest() {
        if (!started) {
            const AudioContext = (window.AudioContext ?? (window as any).webkitAudioContext);
            ctx = new AudioContext();
            gain = ctx.createGain();
            gain.gain.setValueAtTime(0.5, 0);
            gain.connect(ctx.destination);

            await Tone.start()
            started = true;
        }
        if (active) {
            return;
        }
        active = true;
        // osc.frequency.value = "C4";
        // osc.frequency.rampTo("G4", "+.5");
        // osc.volume.value = 0;
        // osc.volume.exponentialRampTo(-100, ".5")
        // osc.start().stop("+.5");

        let sleep = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));
        for (let i = 0; i < 4; i++) {
            osc.frequency.value = "A4";
            osc.volume.value = 0;
            osc.volume.linearRampTo(-500, 1)
            osc.detune.value = i * 100;
            osc.start().stop("+1");

            // const now = ctx.currentTime;
            // const duration = 1// * this.speed // seconds
            // const step = ctx.createOscillator();
            // // Frequency in Hz. This corresponds to a C note.
            // step.frequency.setValueAtTime(0 + Tone.intervalToFrequencyRatio(i) * 440, now);
            // // step.frequency.exponentialRampToValueAtTime(0.001, now + duration);

            // const ogain = ctx.createGain();
            // ogain.gain.setValueAtTime(1, 0);
            // ogain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            // step.connect(ogain);
            // ogain.connect(gain);

            // step.start();
            // step.stop(now + duration);
            await sleep(1);
        }
        // osc.volume.value = -200;
        // osc.stop();
        active = false;
    }
</script>

<div class="debug-background banner" transition:fly={{ y: -50 }}>
    <p>Debug</p>
</div>

<div class="debug-background menu" in:fly={{ x: -200, delay: 200 }} out:fly={{ x: -200 }}>
    <p>Settings</p>
    <div class="option">
        <Toggle id="show-overlay" bind:checked={gfx.dbg.config.showStats}>
            Show Stats
        </Toggle>
    </div>
    <div class="opiton">
        <input type="number" name="debug-game-speed" id="debug-game-speed" bind:value={game.config.gameSpeed}>
        <label for="debug-game-speed">Game speed</label>
    </div>
    <div class="option">
        <Toggle id="show-pulse-animation" bind:checked={gfx.dbg.config.enablePulseAnimation}>
            Pulse Animation
        </Toggle>
    </div>
    <div class="opiton">
        <input type="number" name="debug-game-pulse-rate" id="debug-game-pulse-rate" bind:value={game.config.pulseRate}>
        <label for="debug-game-pulse-rate">Satellites per pulse</label>
    </div>
    <div class="opiton">
        <input type="number" name="debug-update-frequency" id="debug-update-frequency" bind:value={gfx.dbg.config.updateFrequencyMS}>
        <label for="debug-update-frequency">Update frequency (ms)</label>
    </div>
    <div class="option">
        <Toggle id="show-quad-tree" bind:checked={gfx.dbg.config.showQuadTree}>
            Show collisions
        </Toggle>
    </div>
    <div class="option">
        <Toggle id="show-planet-stats" bind:checked={gfx.dbg.config.showPlanetStats}>
            Show Planet Stats
        </Toggle>
    </div>
    {#each game.players as player}
        <div class="option">
            <Toggle id="show-player-selection-{player.team}" bind:checked={gfx.dbg.config.showPlayerSelection[player.team]}>
                Show <span style="background:#{player.color.toString(16)}">{player.team}</span> player selection
            </Toggle>
        </div>
    {/each}
    <div class="opiton">
        <button on:click={spawn1K}>Spawn 1000 satellites</button>
    </div>
</div>


<div class="debug-background audio-test" in:fly={{ x: 200, delay: 400 }} out:fly={{ x: 200 }}>
    <p>Audio</p>
    <div class="opiton">
        <button on:click={audioTest}>Audio test</button>
    </div>
</div>

<style>
    .option {
        padding: 0.5em 0em;
    }
    .debug-background {
        background: linear-gradient(to bottom, rgba(200, 200, 200, 0.1), rgba(200, 200, 200, 0.3));
        backdrop-filter: blur(10px);
    }

    .banner {
        display: flex;
        align-items: center;
        justify-content: center;

        position: absolute;
        top: 0;
        left: 0;
        width: 100vw;
    }

    p {
        margin: 0;
        padding: 2rem;
        font-size: 3rem;
    }

    .menu {
        display: flex;
        flex-direction: column;
        overflow: scroll;

        padding: 0 1rem;
        position: absolute;
        top: 0rem;
        left: 0;
        height: 100vh;
        width: 20vw;
    }

    .audio-test {
        display: flex;
        flex-direction: column;
        overflow: scroll;

        padding: 0 1rem;
        position: absolute;
        top: 0rem;
        right: 0vw;
        height: 100vh;
        width: 20vw;
    }
</style>