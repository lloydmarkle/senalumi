<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import WorldSpaceOverlay from "./WorldSpaceOverlay.svelte";
    import type { Game, Player } from "../game";
    import { Renderer } from "../render";
    import type { IAnimateOptions } from "pixi-viewport";
    import type { Sound } from "../sound";

    export let game: Game;
    export let audio: Sound;
    export let player: Player = null;
    export let initialZoom: IAnimateOptions = null;

    let gfx: Renderer;
    let el: HTMLCanvasElement;
    onMount(() => {
        gfx = new Renderer(el, game, audio, player);
        if (initialZoom) {
            gfx.viewport.animate(initialZoom);
        }
    });
    onDestroy(() => {
        gfx.destroy();
    });
</script>

<canvas bind:this={el} />

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
</style>