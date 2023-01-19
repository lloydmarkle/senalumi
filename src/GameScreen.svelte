<script lang="ts">
    import DebugOptions from "./lib/components/DebugOptions.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import LevelEditor from "./lib/components/LevelEditor.svelte";
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import Scoreboard from "./lib/components/Scoreboard.svelte";
    import TeamList from "./lib/components/PlayerTable.svelte";
    import { appContext } from "./context";
    import type { Player } from "./lib/game";
    import PlayerTable from "./lib/components/PlayerTable.svelte";
    import { onDestroy } from "svelte";

    const { room, menu, game, localPlayer } = appContext();
    async function quitGame() {
        $menu = 'start';
        $room?.leave();
        $room = null;
        $game = null;
    }

    let gameState = $game.log || [];
    const int = setInterval(() => {
        gameState = $game.log || []
    }, 5000);
    onDestroy(() => {
        clearInterval(int);
    })

    let player: Player;
    $: if ($game && $localPlayer.team) {
        player = $game.players.find(p => p.team === $localPlayer.team);
    }

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

<GameView game={$game} {player} let:gfx>
    {#if $menu === 'edit'}
        <LevelEditor game={$game} {gfx} />
    {/if}

    {#if showScore}
        <OverlayBackground>
            <div class="vstack">
                <div class="hstack scoreboard">
                    <span class="chart">
                        <Scoreboard {gameState} />
                    </span>
                    {#if $room}
                        <span class="player-table">
                            <PlayerTable room={$room} />
                        </span>
                    {/if}
                </div>
                <div class="hstack">
                    <button on:click={quitGame}>Quit</button>
                </div>
            </div>
        </OverlayBackground>
    {/if}

    {#if $room}
        <TeamList room={$room} />
    {/if}

    {#if showDebugOptions}
        <DebugOptions game={$game} {gfx} />
    {/if}
</GameView>

<style>
    .scoreboard {
        align-items: flex-start;
		margin: 0 auto;
        background: rgba(0,0,0, 0.5);
        width: 80vw;
    }
    .chart {
        width: 100%;
		height: 60vh;
		padding: 3em;
		max-width: 80em;
		max-height: 60em;
	}

    .player-table {
        padding-top: 3em;
        padding-right: 1em;
    }
</style>