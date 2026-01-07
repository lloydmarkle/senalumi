<script lang="ts">
    import { onMount } from "svelte";
    import type { Game, Player } from "../game";
    import { Renderer } from "../render";
    import type { IAnimateOptions } from "pixi-viewport";
    import type { Sound } from "../sound";

    export let game: Game;
    export let audio: Sound;
    export let player: Player = null;
    export let initialZoom: IAnimateOptions = null;
    export let gfx: Renderer = null;

    let el: HTMLCanvasElement;
    onMount(() => {
        gfx = new Renderer(el, game, audio, player);
        if (initialZoom) {
            gfx.viewport.animate(initialZoom);
        }
        return () => gfx.destroy();
    });
</script>

<canvas bind:this={el}></canvas>
<slot {gfx} />

<style>
    canvas {
        position: absolute;
        inset: 0;
    }
</style>