<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import PlayerTable from "./lib/components/PlayerTable.svelte";
    import { onMount } from "svelte";
    import RoomStatusMessages from "./lib/components/RoomStatusMessages.svelte";
    import type { Game, Player, Team } from "./lib/game";
    import { fly } from "svelte/transition";
    import WorldSpaceOverlay from "./lib/components/WorldSpaceOverlay.svelte";
    import type { Renderer } from "./lib/render";
    import { DataStore, type MapData } from "./stored-data";

    const { room, audio, localPlayer } = appContext();

    export let game: Game;
    export let player: Player;

    async function updateMapData(fn: (mapData: MapData) => MapData) {
        const db = await DataStore.load();
        const mapData = await db.loadMaps().then(maps => maps.find(m => m.id === game.mapName));
        db.storeMap(fn(mapData));
    }

    $: gameConfig = game.config;
    let gameState = game.log ?? [];
    function checkScore() {
        gameState = game.log ?? [];

        let lastEvent = gameState[gameState.length - 1];
        const owners = game.planets.filter(p => p.owner).reduce((set, p) => set.add(p.owner.team), new Set<Team>());
        // only one player owns a planet
        const winnerCandidate = owners.size === 1 ? [...owners.values()][0] : null;
        if (!winnerCandidate) {
            return;
        }

        let canComeback = false;
        for (const [team, count] of lastEvent.satelliteCounts.entries()) {
            if (team !== winnerCandidate) {
                canComeback = canComeback || count > 100;
            }
        }
        // and the other players don't have enough satellites to capture
        if (canComeback) {
            return;
        }

        // so it's game over
        updateMapData(md => {
            md.stats.bestTime = lastEvent.time;
            if (winnerCandidate === player.team) {
                gameOver = 'You win!';
                md.stats.wins += 1;
            } else {
                gameOver = 'You lose';
                md.stats.loses += 1;
            }
            return md;
        });
    }

    onMount(() => {
        updateMapData(md => {
            md.stats.attempts += 1;
            return md;
        });

        const scoreUpdateInterval = setInterval(checkScore, 5000);
        return () => clearInterval(scoreUpdateInterval);
    });

    let gameOver = '';
    $: if (gameOver) {
        gfx.paused = true;
        showScore = true;
    }
    let gfx: Renderer;
    let showScore = false;
    let showDebugOptions = false;
    function keydown(ev: KeyboardEvent) {
        if (!game) {
            return;
        }

        if (ev.code === 'Backquote') {
            showDebugOptions = !$room && !showDebugOptions;
        }
        if (ev.code === 'Space' || ev.code === 'Escape') {
            showScore = !showScore || gameOver.length > 0;
            gfx.paused = showScore && !$room;
            updateFpsLimit();
        }

        // some helpful
        if (ev.code === 'BracketLeft') {
            gameConfig.gameSpeed -= .1;
            gameConfig.gameSpeed = Math.max(0.1, Math.min(4, game.config.gameSpeed));
        }
        if (ev.code === 'BracketRight') {
            gameConfig.gameSpeed += .1;
            gameConfig.gameSpeed = Math.max(0.1, Math.min(4, game.config.gameSpeed));
        }
    }

    function changeTabVisibility() {
        if (document.hidden) {
            gfx.paused = true;
            showScore = true;
            updateFpsLimit();
        }
    }

    function updateFpsLimit() {
        if (!gfx) return;
        if (gfx.paused) {
            gfx.fpsLimit.maxFPS = 5;
            gfx.fpsLimit.minFPS = 1;
        } else {
            gfx.fpsLimit.maxFPS = 0;
            gfx.fpsLimit.minFPS = 10;
        }
    }
</script>

<svelte:window
    on:keydown={keydown}
    on:visibilitychange={changeTabVisibility} />

{#key game}
<GameView {game} {audio} {player} bind:gfx={gfx}>
    {#if showScore}
        <OverlayBackground>
            {#if gfx.paused}
            <div transition:fly={{ y:'-100%', delay: 400 }} class="top-info">
                <h2>Paused</h2>
            </div>
            {/if}
            <div class="vstack scoreboard">
                {#if gameOver}
                    <div class="game-result">
                        <h2>{gameOver}</h2>
                        <a href="#menu=sp" class="btn">Leave</a>
                    </div>
                {/if}
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
    .game-result {
        display: flex;
        gap: 1rem;
        padding: 1rem 2rem;
        align-items: center;
    }

    .scoreboard {
        align-items: flex-start;
        background: var(--theme-gradient-fg2);
        width: 80%;
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