<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { Game } from '../game';
    import type { Renderer } from '../render';
    import { Sound } from '../sound'
    import Toggle from './Toggle.svelte';

    export let gfx: Renderer;
    export let game: Game;

    const audio = new Sound(game);

    function spawn1K() {
        let end = game.satellites.length + 1000;
        while (game.satellites.length < end) {
            game.pulse();
        }
    }

    let repeatStart = 0;
    let repeatStop = 50;
    let repeatGap = 20;
    $: repeats = Math.max(repeatStart, repeatStop) - Math.min(repeatStart, repeatStop);
    const sleep = async (n: number) => new Promise(resolve => setTimeout(resolve, n));
    function partialAudio(fn: (n: number) => void) {
        return async () => {
            let direction = repeatStart < repeatStop ? 1 : -1;
            for (let i = repeatStart; i !== repeatStop; i += direction) {
                fn(i);
                await sleep(repeatGap);
            }
        }
    }
</script>

<svelte:body on:click={() => audio.resume()} />

<div class="debug-background banner" transition:fly={{ y: -50 }}>
    <p>Debug</p>
</div>

<div class="debug-background menu" in:fly={{ x: -200, delay: 200 }} out:fly={{ x: -200 }}>
    {#if gfx}
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
    {/if}
</div>

<div class="debug-background audio-test" in:fly={{ x: 200, delay: 400 }} out:fly={{ x: 200 }}>
    <h2>Audio Test</h2>

    <p>Standalone Sounds</p>
    <button class="option" on:click={() => audio.pulse()}>Pulse</button>
    <button class="option" on:click={() => audio.planetUpgrade()}>Planet Upgrade</button>
    <button class="option" on:click={() => audio.planetPop()}>Planet Pop</button>
    <button class="option" on:click={() => audio.planetCapture()}>Planet Capture</button>

    <hr style="width:100%" />

    <p>Rapid Sounds</p>
    <div class="opiton hstack">
        <label for="debug-audio-repeat-start">Start {repeatStart}</label>
        <input type="range" name="debug-audio-repeat-start" id="debug-audio-repeat-start" min="0" max="100" step="5" bind:value={repeatStart} />
    </div>
    <div class="opiton hstack">
        <label for="debug-audio-repeat-stop">Stop {repeatStop}</label>
        <input type="range" name="debug-audio-repeat-start" id="debug-audio-repeat-start" min="0" max="100" step="5" bind:value={repeatStop} />
    </div>
    <div class="opiton hstack">
        <label for="debug-audio-repeat-gap">Gap {repeatGap}ms</label>
        <input type="range" name="debug-audio-repeat-gap" id="debug-audio-repeat-gap" min="0" max="200" step="5" bind:value={repeatGap} />
    </div>

    <button class="option" on:click={partialAudio(n => audio.satellitePop())}>Satellite pop ({repeats}x)</button>
    <button class="option" on:click={partialAudio(n => audio.planetPartialHealthSound(n))}>Partial health ({repeats}x)</button>
    <button class="option" on:click={partialAudio(n => audio.planetPartialCaptureSound(n))}>Partial capture ({repeats}x)</button>
    <button class="option" on:click={partialAudio(n => audio.planetPartialUpgradeSound(n))}>Partial upgrade ({repeats}x)</button>
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

    .audio-test p {
        margin: 0;
        padding: 1em;
        font-size: 1.5em;
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
        gap: .5em;
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