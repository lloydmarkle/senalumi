<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import PlayerTable from "./lib/components/PlayerTable.svelte";
    import { onDestroy } from "svelte";
    import RoomStatusMessages from "./lib/components/RoomStatusMessages.svelte";

    const { room, game, audio, localPlayer } = appContext();

    let gameState = $game.log || [];
    const scoreUpdateInterval = setInterval(() => {
        gameState = $game.log || []
    }, 5000);

    onDestroy(() => {
        clearInterval(scoreUpdateInterval);
    });

    $: player = ($game && $localPlayer.team)
        ? $game.players.find(p => p.team === $localPlayer.team) : null;

    let showScore = false;
    let showDebugOptions = false;
    function keypress(ev: KeyboardEvent) {
        if (!$game) {
            return;
        }

        if (ev.key === '`' || ev.key === '~') {
            showDebugOptions = !$room && !showDebugOptions;
        }
        if (ev.key === ' ') {
            showScore = !showScore;
        }
    }
</script>

<svelte:body on:keypress={keypress} />

<GameView game={$game} {audio} {player} let:gfx>
    {#if showScore}
        <OverlayBackground>
            <div class="hstack scoreboard">
                <div class="chart">
                    <Scoreboard {gameState} />
                </div>
            </div>
        </OverlayBackground>
    {/if}

    {#if showDebugOptions}
        <DebugOptions game={$game} {gfx} />
    {/if}
</GameView>

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
</style>