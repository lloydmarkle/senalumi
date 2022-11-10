<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { Game } from './game';
    import type { Renderer } from './render';
    import Toggle from './components/Toggle.svelte';

    export let gfx: Renderer;
    export let game: Game;
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
        <input type="number" name="debug-game-speed" id="debug-game-speed" bind:value={game.constants.gameSpeed}>
        <label for="debug-game-speed">Game speed</label>
    </div>
    <div class="option">
        <Toggle id="show-pulse-animation" bind:checked={gfx.dbg.config.enablePulseAnimation}>
            Pulse Animation
        </Toggle>
    </div>
    <div class="opiton">
        <input type="number" name="debug-game-pulse-rate" id="debug-game-pulse-rate" bind:value={game.constants.pulseRate}>
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
            <Toggle id="show-player-selection-{player.id}" bind:checked={gfx.dbg.config.showPlayerSelection[player.id]}>
                Show <span style="background:#{player.color.toString(16)}">{player.id}</span> player selection
            </Toggle>
        </div>
    {/each}
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
</style>