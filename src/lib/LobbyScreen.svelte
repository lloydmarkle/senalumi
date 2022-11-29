<script lang="ts">
    import { fly } from 'svelte/transition';
    import type { Room } from 'colyseus.js';
    import type { GameSchema, PlayerSchema } from './net-game';
    import Select from './components/Select.svelte';

    export let players: PlayerSchema[];
    export let gameState: GameSchema;
    export let room: Room<GameSchema>;
    $: currentPlayer = players.find(p => p.sessionId);

    let playerTeams = [
        { value: '', label: 'Watching' },
        { value: 'red', label: 'Red' },
        { value: 'orange', label: 'Orange' },
        { value: 'yellow', label: 'Yellow' },
        { value: 'green', label: 'Green' },
        { value: 'blue', label: 'Blue' },
        { value: 'violet', label: 'Violet' },
        { value: 'pink', label: 'Pink' },
    ];

    let blurBackground = false;

    function updatePlayer(player: PlayerSchema) {
        room.send('player:info', player);
    }

    function syncConfig() {
        room.send('game:config', gameState.config);
    }
    function startGame() {
        gameState.config.startGame = true;
        syncConfig();
    }
</script>

{#if room}
<div class="container"
    class:container-visible={blurBackground}
    on:introend={() => blurBackground = true}
    on:outroend={() => blurBackground = false}
    transition:fly={{ y: (window.innerHeight * -0.8) }}
    >
    <div class="lobby-screen">
        <h1><span>Game </span>{gameState.label}</h1>
        {#if currentPlayer.admin}
            <details class="admin-panel">
                <summary>Configure Game</summary>
                <div class="options-grid">
                    <span>
                        <label for="config-warmup">Warmup time (seconds):</label>
                        <input type="number" id="config-warmup" name="config-warmup" bind:value={gameState.config.warmupSeconds} on:change={syncConfig} />
                    </span>
                    <span>
                        <label for="config-speed">Play speed:</label>
                        <input type="number" id="config-speed" name="config-speed" bind:value={gameState.config.gameSpeed} on:change={syncConfig} />
                    </span>
                    <span>
                        <label for="config-pulseRate">Pulse rate:</label>
                        <input type="number" id="config-pulseRate" name="config-pulseRate" bind:value={gameState.config.pulseRate} on:change={syncConfig} />
                    </span>
                    <span>
                        <label for="config-maxWorld">World size:</label>
                        <input type="number" id="config-maxWorld" name="config-maxWorld" bind:value={gameState.config.maxWorld} on:change={syncConfig} />
                    </span>
                    <span>
                        <input type="checkbox" id="config-coop" name="config-coop" bind:checked={gameState.config.allowCoop} on:change={syncConfig} />
                        <label for="config-coop">Allow multiple players per colour</label>
                    </span>
                    <span>
                        <label for="config-maxPlayers">Max players:</label>
                        <input type="number" id="config-maxPlayers" name="config-maxPlayers" bind:value={gameState.config.maxPlayers} />
                    </span>
                    <!--
                        TODO: customize colours?
                    <span>
                        <label for="config-colours">Colours:</label>
                        <Select options={playerTeams} bind:value={player.team} on:select={() => updatePlayer(player)} />
                    </span>
                    -->
                </div>
            </details>
        {/if}
        <div class="info-panel">
            <h2>
                {#if gameState.running}
                Start in {Math.abs(gameState.gameTimeMS / 1000).toFixed(1)}
                {:else}
                Waiting for players
                {/if}
            </h2>
            {#if currentPlayer.admin && !gameState.running}
                <button disabled={players.some(p => !p.ready)} on:click={startGame}>Start game</button>
            {/if}
        </div>
        <table class="player-table">
            <thead>
                <tr>
                    <th></th>
                    <th>Ready</th>
                    <th>Name</th>
                    <th>Team</th>
                </tr>
            </thead>
            <tbody>
            {#each players as player}
                <tr>
                {#if !gameState.running && player.sessionId}
                    <td>{player.admin ? 'Admin' : ''}</td>
                    <td><input type="checkbox" bind:checked={player.ready}  on:change={() => updatePlayer(player)} /></td>
                    <td><input type="text" bind:value={player.displayName} on:change={() => updatePlayer(player)} /></td>
                    <td><Select options={playerTeams} bind:value={player.team} on:select={() => updatePlayer(player)} /></td>
                {:else}
                    <td>{player.admin ? 'Admin' : ''}</td>
                    <td>{player.ready ? 'Ready' : 'Not ready'}</td>
                    <td>{player.displayName}</td>
                    <td>{player.team || 'watching'}</td>
                {/if}
                </tr>
            {/each}
            </tbody>
        </table>
    </div>
</div>
{/if}

<style>
    .container {
        display: flex;
        align-items: center;
        justify-content: center;

        transition: backdrop-filter 2s;
        backdrop-filter: blur(3px) opacity(0);
        background: linear-gradient(to bottom, rgb(200, 200, 200, 0.1), rgb(200, 200, 200, 0.3));
        position: absolute;
        top: 0;
        left: 0;
        right:0;
        /* width: 100vw; */
        height: 100vh;
    }
    .container-visible {
        backdrop-filter: blur(3px) opacity(1);
    }

    .lobby-screen {
        background: black;
        min-height: 40vh;
        min-width: 60vw;
        max-width: 80vw;
        padding: 1rem 4rem;
    }

    .info-panel {
        padding-bottom: 0.5rem;
        display: flex;
        justify-content: space-between;
    }

    .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        row-gap: 0.5rem;
        column-gap: 0.5rem;
    }

    h1 span {
        opacity: .8;
    }

    div {
        display: inline-block;
    }

    table {
        table-layout: fixed;
        border-collapse: collapse;
    }
    thead th:nth-child(3) {
        width: 80%;
    }
    th {
        text-align: left;
        background: rgb(200, 200, 200, 0.4);
        padding: 1rem 2rem;
    }
    tbody tr:nth-child(even) {
        background: rgb(200, 200, 200, 0.2);
    }
    td {
        padding: 1rem 2rem;
    }
</style>