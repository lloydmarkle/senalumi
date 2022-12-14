<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { onDestroy, onMount } from "svelte";
    import OverlayBackground from "./components/OverlayBackground.svelte";
    import WorldSpaceOverlay from "./components/WorldSpaceOverlay.svelte";
    import DebugOptions from "./DebugOptions.svelte";
    import Scoreboard from "./Scoreboard.svelte";
    import LevelEditor from "./LevelEditor.svelte";
    import type { Game, Player } from "./game";
    import { Renderer } from "./render";

    export let game: Game;
    export let player: Player = null;

    const dispatch = createEventDispatcher();
    let gfx: Renderer;
    let el: HTMLCanvasElement;
    onMount(() => {
        console.log('onMount')
        gfx = new Renderer(el, game, player);
    });
    onDestroy(() => {
        console.log('onDestroy')
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
        <Scoreboard data={game?.log || []} />
        <div>
            <button on:click={() => dispatch('resetGame', null)}>Quit</button>
        </div>
    </OverlayBackground>
{/if}

{#if showDebugOptions}
    {#if game}
        <DebugOptions {game} {gfx} />
    {/if}
    <LevelEditor {game} {gfx} on:resetGame />
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