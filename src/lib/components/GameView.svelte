<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { writable } from "svelte/store";
    import WorldSpaceOverlay from "./WorldSpaceOverlay.svelte";
    import type { Game, Player } from "../game";
    import { Renderer } from "../render";
    import { fly } from "svelte/transition";
    import type { IAnimateOptions } from "pixi-viewport";

    export let game: Game;
    export let player: Player = null;
    export let initialZoom: IAnimateOptions = null;

    let warmupTime = writable(0);
    let warmupWatcher = setInterval(() => {
        $warmupTime = game.state.gameTimeMS;
        if (game.state.gameTimeMS >= 0) {
            clearInterval(warmupWatcher);
            $warmupTime = 0;
        }
    }, 0);

    let gfx: Renderer;
    let el: HTMLCanvasElement;
    onMount(() => {
        gfx = new Renderer(el, game, player);
        if (initialZoom) {
            gfx.viewport.animate(initialZoom);
        }
    });
    onDestroy(() => {
        clearInterval(warmupWatcher);
        gfx.destroy();
    });
</script>

<canvas bind:this={el} />

{#if $warmupTime < 0}
<div
    class="warmup-container vstack"
    transition:fly|local={{ y:-100, opacity: 0, duration: 1000 }}
>
    <strong>Warmup</strong>
    <div class="hstack">
        <span>Game starts in:</span>
        <em>{($warmupTime / -1000).toFixed(1)} seconds</em>
    </div>
</div>
{/if}

{#if gfx && gfx.dbg.config.showPlanetStats}
    <WorldSpaceOverlay {gfx}>
        {#each game.planets as planet}
            <div class="viewport-transform" style="transform:translate({planet.position.x}px, {planet.position.y}px)">
                {planet.health + ':' + planet.upgrade + (planet.candidateOwner?.team[0] ?? '') + ':' + planet.level}
            </div>
        {/each}
    </WorldSpaceOverlay>
{/if}

<slot {gfx} />

<style>
    canvas {
        position: absolute;
    }
    .viewport-transform {
        top: 0; left: 0;
        position: absolute;
        pointer-events: auto;
        transform-origin: 0 0;
        padding: 0;
        margin: 0;
    }

    .warmup-container {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translate(-50%, 0);
        gap: 0em;
        padding: 1em 2em;
        border-bottom-left-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
        background: var(--theme-gradient-background);
    }
</style>