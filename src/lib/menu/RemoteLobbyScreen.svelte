<script lang="ts">
    import type { Room } from 'colyseus.js';
    import Select from '../components/Select.svelte';
    import { Game } from '../game';
    import { convertToRemoteGame, joinRemoteGame, GameSchema, type PlayerSchema } from '../net-game';
    import { delayFly } from './transitions';
    import { appContext } from '../../context';
    import TeamSelectionIcon from '../components/TeamSelectionIcon.svelte';

    const { localPlayer, roomName, menu, game } = appContext();

    let room: Room<GameSchema>;
    let players: PlayerSchema[] = [];
    let gameState = new GameSchema(null, '');

    async function joinRoom() {
        room = await joinRemoteGame($localPlayer.displayName, $roomName);

        // load game properties from room
        const resetPlayers = () =>
            (players = Array.from(room.state.players.entries(), ([key, player]) =>
                // capture local player in app context
                key === room.sessionId
                    ? ($localPlayer = player)
                    : player
            ));
        room.state.players.onAdd = player => {
            player.onChange = resetPlayers;
            player.onRemove = resetPlayers;
            resetPlayers();
        };
        room.state.onChange = () => {
            gameState = room.state;
            if (gameState.running && !$game) {
                $game = convertToRemoteGame(new Game(), room);
            }
        }
    }
    joinRoom();

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

    const teamName = team =>
        (playerTeams.find(pt => pt.value === team) ?? playerTeams[0]).label;

    function leaveRoom() {
        room.leave();
        $menu = 'remote';
    }

    function updatePlayer(player: PlayerSchema) {
        room.send('player:info', player);
    }

    function syncConfig() {
        room.send('game:config', gameState.config);
    }
    function startGame() {
        gameState.config.startGame = true;
        syncConfig();
        $menu = 'start';
    }
</script>

<button transition:delayFly class="back-button" on:click={leaveRoom}>Multiplayer</button>
<h1 transition:delayFly><span>Game </span>{gameState.label}</h1>
{#if $localPlayer.admin}
    <details transition:delayFly class="admin-panel">
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
<div transition:delayFly class="hstack">
    <h2>
        {#if gameState.running}
        Start in {Math.abs(gameState.gameTimeMS / 1000).toFixed(1)}
        {:else}
        Waiting for players
        {/if}
    </h2>
    {#if $localPlayer.admin && !gameState.running}
        <button disabled={players.some(p => !p.ready)} on:click={startGame}>Start game</button>
    {/if}
</div>
<table transition:delayFly class="player-table">
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
        <tr transition:delayFly>
        {#if !gameState.running && player === $localPlayer}
            <td>{player.admin ? 'Admin' : ''}</td>
            <td><input type="checkbox" bind:checked={player.ready}  on:change={() => updatePlayer(player)} /></td>
            <td><input type="text" bind:value={player.displayName} on:change={() => updatePlayer(player)} /></td>
            <td><Select options={playerTeams} bind:value={player.team} on:select={() => updatePlayer(player)} /></td>
        {:else}
            <td>{player.admin ? 'Admin' : ''}</td>
            <td>{player.ready ? 'Ready' : 'Not ready'}</td>
            <td>{player.displayName}</td>
            <td>
                <div class="hstack player-color">
                    <TeamSelectionIcon color={player.team} />
                    <span>{teamName(player.team)}</span>
                </div>
            </td>
        {/if}
        </tr>
    {/each}
    </tbody>
</table>

<style>
    h1 span {
        opacity: 0.8;
    }

    .player-color {
        justify-content: flex-start;
    }

    button {
        padding: 1rem 2rem;
    }
    .back-button {
        display: block;
        padding: 0.5rem 2rem 0.5rem 0rem;
        font-size: 2rem;
        border: none;
        background: none;
    }

    .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        row-gap: 0.5rem;
        column-gap: 0.5rem;
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