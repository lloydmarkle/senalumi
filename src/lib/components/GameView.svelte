<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import OverlayBackground from "./OverlayBackground.svelte";
    import WorldSpaceOverlay from "./WorldSpaceOverlay.svelte";
    import DebugOptions from "./DebugOptions.svelte";
    import Scoreboard from "./Scoreboard.svelte";
    import type { Game, Player } from "../game";
    import { Renderer } from "../render";
    import { appContext } from "../../context";

    export let game: Game;
    export let player: Player = null;

    let context = appContext();
    let gfx: Renderer;
    let el: HTMLCanvasElement;
    onMount(() => {
        gfx = new Renderer(el, game, player);
    });
    onDestroy(() => {
        gfx.destroy();
    });

    let showScore = false;
    let showDebugOptions = false;
    function keypress(ev: KeyboardEvent) {
        if (!player) {
            return;
        }

        if (ev.key === '`' || ev.key === '~') {
            showDebugOptions = !showDebugOptions;
        }
        if (ev.key === ' ') {
            showScore = !showScore;
        }
        game.state.running = !(showScore || showDebugOptions);
    }
</script>

<svelte:body on:keypress={keypress} />

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

{#if showScore}
    <OverlayBackground>
        <div class="vstack">
            <Scoreboard data={game?.log || []} />
            <div class="hstack">
                <button on:click={() => context.game.set(null)}>Quit</button>
            </div>
        </div>
    </OverlayBackground>
{/if}

{#if showDebugOptions && game}
    <DebugOptions {game} {gfx} />
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