<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import PlayerTable from "./lib/components/PlayerTable.svelte";
    import { onMount } from "svelte";
    import RoomStatusMessages from "./lib/components/RoomStatusMessages.svelte";
    import type { Game } from "./lib/game";
    import { fly } from "svelte/transition";
    import WorldSpaceOverlay from "./lib/components/WorldSpaceOverlay.svelte";
    import type { Renderer } from "./lib/render";

    const { room, audio, localPlayer } = appContext();

    export let game: Game;

    let gameState = game.log ?? [];
    onMount(() => {
        const scoreUpdateInterval = setInterval(() => gameState = game.log ?? [], 5000);
        return () => clearInterval(scoreUpdateInterval);
    });

    $: player = (game && $localPlayer.team)
        ? game.players.find(p => p.team === $localPlayer.team) : null;

    let gfx: Renderer;
    let showScore = false;
    let showDebugOptions = false;
    function keyup(ev: KeyboardEvent) {
        if (!game) {
            return;
        }

        if (ev.code === 'Backquote') {
            showDebugOptions = !$room && !showDebugOptions;
        }
        if (ev.code === 'Space' || ev.code === 'Escape') {
            showScore = !showScore;
            gfx.paused = showScore && !$room;
        }
    }
</script>

<svelte:window on:keyup={keyup} />

{#key game}
<GameView {game} {audio} {player} bind:gfx={gfx}>
    {#if showScore}
        <OverlayBackground>
            {#if gfx.paused}
            <div transition:fly={{ y:'-100%', delay: 400 }} class="top-info">
                <h2>Paused</h2>
            </div>
            {/if}
            <div class="hstack scoreboard">
                <div class="chart">
                    <Scoreboard {gameState} />
                </div>
            </div>
        </OverlayBackground>
    {/if}

    {#if showDebugOptions}
        <DebugOptions {game} {gfx} />
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
</GameView>
{/key}

<div class="fullscreen-container">
    {#if $room}
    <div class="player-table">
        <PlayerTable room={$room} localPlayer={$localPlayer} />
    </div>
    <RoomStatusMessages room={$room} />
    {/if}
</div>

<style>
    .scoreboard {
        align-items: flex-start;
		margin: 0 auto;
        background: var(--theme-gradient-fg2);
        width: 80vw;
    }
    .chart {
        width: 100%;
		height: 60vh;
		padding: 3em;
		max-width: 80em;
		max-height: 60em;
	}

    .top-info {
        position: absolute;
        top: 1rem;
        background: var(--theme-background);
        padding: .5rem 4rem;
        border-radius: var(--theme-border-radius);
    }

    .fullscreen-container {
        pointer-events: none;
        position: absolute;
        top:0; left:0 ;
        width: 100vw;
        height: 100vh;
    }
    .player-table {
        pointer-events: all;
        position: absolute;
        width: 20em;
        left: 1em;
        bottom: 1em;
        opacity: var(--theme-hover-opacity-off);
        transition: opacity .3s;
    }
    .player-table:hover, .player-table:active {
        opacity: var(--theme-hover-opacity);
    }

    .viewport-transform {
        inset: 0;
        position: absolute;
        pointer-events: auto;
        transform-origin: 0 0;
        padding: 0;
        margin: 0;
    }
</style>