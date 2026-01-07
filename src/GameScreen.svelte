<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import { appContext } from "./context";
    import { onMount } from "svelte";
    import type { Game, GameStateSnapshot, Player, Team } from "./lib/game";
    import { fly } from "svelte/transition";
    import WorldSpaceOverlay from "./lib/components/WorldSpaceOverlay.svelte";
    import type { Renderer } from "./lib/render";
    import { DataStore, type MapData } from "./stored-data";

    const { audio } = appContext();

    export let game: Game;
    export let player: Player;

    async function updateMapData(fn: (mapData: MapData) => MapData) {
        const db = await DataStore.load();
        const mapData = await db.loadMaps().then(maps => maps.find(m => m.id === game.mapName));
        db.storeMap(fn(mapData));
    }

    // TODO: watchmode, pause, showscore... these are all kind of similar but the code is messy
    let watchMode = false;
    const startWatching = () => {
        watchMode = true;
        showScore = false;
        gfx.paused = false;
        updateFpsLimit();
    }

    function recordGameStats(winnerCandidate: Team, lastEvent: GameStateSnapshot) {
        updateMapData(md => {
            if (winnerCandidate === player.team) {
                gameOver = 'You win!';
                md.stats.bestTime = lastEvent.time < md.stats.bestTime && md.stats.bestTime > 0 ? lastEvent.time : md.stats.bestTime;
                md.stats.wins += 1;
            } else {
                gameOver = 'You lose';
                md.stats.loses += 1;
            }
            return md;
        });
    }

    $: gameConfig = game.config;
    let gameState = game.log ?? [];
    function checkScore() {
        gameState = game.log ?? [];

        const lastEvent = gameState[gameState.length - 1];
        const playerEliminated =
            !game.planets.some(p => p?.owner?.team === player.team) && lastEvent.satelliteCounts.get(player.team) < 100;
        const owners = game.planets.filter(p => p.owner).reduce((set, p) => set.add(p.owner.team), new Set<Team>());
        const winnerCandidate = owners.size === 1 ? [...owners.values()][0] : null;
        if (!watchMode && playerEliminated) {
            return recordGameStats(winnerCandidate, lastEvent);
        }

        // only one player owns a planet
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
        if (winnerCandidate === player.team) {
            recordGameStats(winnerCandidate, lastEvent);
        }
        gameOver = winnerCandidate + ' wins';
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
    $: if (gameOver && !watchMode) {
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
            showDebugOptions = !showDebugOptions;
        }
        if (ev.code === 'Space' || ev.code === 'Escape') {
            showScore = !showScore || (gameOver.length > 0 && !watchMode);
            gfx.paused = showScore;
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
            <div class="overlay-root">
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

    .top-info {
        position: absolute;
        top: 1rem;
        background: var(--theme-background);
        padding: .5rem 4rem;
        border-radius: var(--theme-border-radius);
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