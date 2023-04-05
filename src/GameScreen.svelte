<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import PlayerTable from "./lib/components/PlayerTable.svelte";
    import { onDestroy } from "svelte";
    import { writable } from "svelte/store";
    import { fly } from "svelte/transition";
    import RoomStatusMessages from "./lib/components/RoomStatusMessages.svelte";

    const { room, game, audio, localPlayer } = appContext();

    let warmupTime = writable(0);
    let warmupWatcher = setInterval(() => {
        $warmupTime = $game.state.gameTimeMS;
        if ($game.state.gameTimeMS >= 0) {
            clearInterval(warmupWatcher);
            $warmupTime = 0;
        }
    }, 100);

    let gameState = $game.log || [];
    const scoreUpdateInterval = setInterval(() => {
        gameState = $game.log || []
    }, 5000);

    onDestroy(() => {
        clearInterval(warmupWatcher);
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
            showDebugOptions = !showDebugOptions;
        }
        if (ev.key === ' ') {
            showScore = !showScore;
        }
        $game.state.running = !(showScore || showDebugOptions);
    }
</script>

<svelte:body on:keypress={keypress} />

<GameView game={$game} {audio} {player} let:gfx>
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
        opacity: .5;
        transition: opacity .3s;
    }
    .player-table:hover {
        opacity: 1;
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