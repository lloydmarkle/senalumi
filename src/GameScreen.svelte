<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import { onMount, tick } from "svelte";
    import type { Game, GameStateSnapshot, Player, Team } from "./lib/game";
    import { fly } from "svelte/transition";
    import WorldSpaceOverlay from "./lib/components/WorldSpaceOverlay.svelte";
    import type { Renderer } from "./lib/render";
    import { DataStore, type MapData } from "./stored-data";
    import { writable } from "svelte/store";

    const { audio } = appContext();

    export let game: Game;
    export let player: Player;

    async function updateMapData(fn: (mapData: MapData) => MapData) {
        const db = await DataStore.load();
        const mapData = await db.loadMaps().then(maps => maps.find(m => m.id === game.mapName));
        db.storeMap(fn(mapData));
    }

    function recordGameStats(result: 'win' | 'loss', lastEvent: GameStateSnapshot) {
        updateMapData(md => {
            if (result === 'win') {
                md.stats.bestTime = lastEvent.time < md.stats.bestTime || md.stats.bestTime === 0 ? lastEvent.time : md.stats.bestTime;
                md.stats.wins += 1;
            } else {
                md.stats.loses += 1;
            }
            return md;
        });
    }

    let gameOver = '';
    let gameState = game.log ?? [];
    function checkScore() {
        gameState = game.log ?? [];
        if (gameOver) {
            return;
        }

        const lastEvent = gameState[gameState.length - 1];
        const possibleWinners = game.players.map(p => {
            const sats = lastEvent.satelliteCounts.get(p.team);
            const ownedPlanets = game.planets.filter(e => e.owner?.team === p.team);
            const partiallyOwnedPlanets = game.planets.filter(e => e.candidateOwner?.team === p.team);
            const canWin = ownedPlanets.length > 0
                || sats > 100
                || partiallyOwnedPlanets.some(p => p.upgrade + sats > 99);
            return  canWin ? p.team : '';
        }).filter(e => e);

        if (!possibleWinners.includes(player.team)) {
            gameOver = 'You lose';
            recordGameStats('loss', lastEvent);
        } else if (possibleWinners.length === 1 && possibleWinners[0] === player.team) {
            gameOver = 'You win!';
            recordGameStats('win', lastEvent);
        } else if (possibleWinners.length === 1) {
            gameOver = possibleWinners[0] + ' wins';
        }
    }

    onMount(() => {
        updateMapData(md => {
            md.stats.attempts += 1;
            return md;
        });

        const scoreUpdateInterval = setInterval(checkScore, 5000);
        return () => clearInterval(scoreUpdateInterval);
    });

    const gameConfig = game.config;
    let hudMessage = writable('');
    let hudText = '';
    let hudMessageNum = 0;
    $: handleHudMessage($hudMessage);
    async function handleHudMessage(text: string) {
        hudText = text;
        hudMessageNum += 1;
        await tick();
        $hudMessage = '';
    }

    let watchMode = false;
    const startWatching = () => {
        watchMode = true;
        showScore = false;
    }
    let showScore = false;
    let showDebugOptions = false;
    function keydown(ev: KeyboardEvent) {
        if (!game) {
            return;
        }

        if (ev.code === 'Backquote') {
            showDebugOptions = !showDebugOptions;
        }
        if (ev.code === 'Space' || ev.code === 'Escape') {
            showScore = !showScore || (gameOver.length > 0 && !watchMode);
        }

        // some helpful
        if (ev.code === 'BracketLeft') {
            gameConfig.gameSpeed -= .1;
            gameConfig.gameSpeed = Math.max(0.1, Math.min(5, game.config.gameSpeed));
            $hudMessage = `Game speed: ${gameConfig.gameSpeed.toFixed(1)}`;
        }
        if (ev.code === 'BracketRight') {
            gameConfig.gameSpeed += .1;
            gameConfig.gameSpeed = Math.max(0.1, Math.min(5, game.config.gameSpeed));
            $hudMessage = `Game speed: ${gameConfig.gameSpeed.toFixed(1)}`;
        }
    }

    function changeTabVisibility() {
        if (document.hidden) {
            showScore = true;
        }
    }

    let gfx: Renderer;
    $: if (gameOver && !watchMode) showScore = true;
    $: if (gfx) {
        gfx.paused = showScore || showDebugOptions;
        updateFpsLimit();
    }
    function updateFpsLimit() {
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

<div style="position:absolute; font-size:1.5rem; right:1rem; bottom: 3rem; z-index: 10">
    <div style="display:flex; flex-direction:column; overflow:hidden; gap:.5rem">
        {#key hudMessageNum}
            <div out:fly={{ y: '-1rem', delay: 2000 }}>
                <div in:fly={{ y: '1rem' }}>{hudText}</div>
            </div>
        {/key}
    </div>
</div>

{#key game}
<GameView {game} {audio} {player} bind:gfx={gfx}>
    {#if showScore}
        <OverlayBackground>
            <div class="overlay-root">
                <div class="vstack scoreboard">
                    {#if gameOver}
                        <div class="game-result">
                            <h2>{gameOver}</h2>
                            <a href="#menu=sp" class="btn">Leave</a>
                            <button on:click={startWatching}>Continue watching</button>
                        </div>
                    {/if}
                    <div class="chart">
                        <Scoreboard {gameState} />
                    </div>
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

<style>
    .game-result {
        display: flex;
        gap: 1rem;
        padding: 1rem 2rem;
        align-items: center;
    }
    .game-result h2 {
        text-transform: capitalize;
    }

    .overlay-root {
        display: flex;
        height: 100%;
        justify-content: center;
        align-items: center;
    }
    .scoreboard {
        background: var(--theme-gradient-fg2);
        width: 80%;
        height: 60%;
    }
    .chart {
		height: 100%;
		padding: 3em;
		max-height: 60rem;
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