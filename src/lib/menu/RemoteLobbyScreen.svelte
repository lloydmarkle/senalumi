<script lang="ts">
    import { Game, type GameMap } from '../game';
    import { convertToRemoteGame, PlayerSchema,  } from '../net-game';
    import { delayFly, fly } from './transitions';
    import { appContext } from '../../context';
    import TeamSelectionIcon from '../components/TeamSelectionIcon.svelte';
    import { availableTeamsFromMap, playerTeams } from '../data';
    import MapChooser from './MapChooser.svelte';
    import MapTile from './MapTile.svelte';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';

    const { localPlayer, room, game, audio } = appContext();

    let map: GameMap;
    let players: PlayerSchema[] = [];

    let availableTeams = playerTeams;
    $: if (map) {
        availableTeams = [
            playerTeams[0],
            ...availableTeamsFromMap(map),
        ];
    }
    $: if ($localPlayer.admin && map) {
        gameState.config.gameMap = JSON.stringify(map);
        syncConfig();
    }
    $: waitingForReady = players.some(p => !p.ready) || !map;
    $: waitMessage = map ? '(Waiting for players)' : '(Waiting for players and map)';

    let gameState = $room.state;
    const resetPlayers = () => players = Array.from(gameState.players.values());
    gameState.players.forEach(player => {
        player.onChange = resetPlayers;
        player.onRemove = resetPlayers;
    })
    gameState.players.onAdd = player => {
        player.onChange = resetPlayers;
        player.onRemove = resetPlayers;
        resetPlayers();
    };
    resetPlayers();

    gameState.onChange = async () => {
        $localPlayer = gameState.players.get($room.sessionId);
        if (gameState.running && !$game) {
            // clear locally added listeners so we don't hold on to a reference to this svelte component
            gameState.onChange = null;
            gameState.config.onChange = null;
            gameState.players.onAdd = null;
            gameState.players.forEach(p => {
                p.onChange = null;
                p.onRemove = null;
            });
            $game = convertToRemoteGame(new Game(), $room);
        }
    }
    gameState.config.onChange = () => {
        const newMap: GameMap = JSON.parse(gameState.config.gameMap);
        if (newMap.props.img !== map?.props.img) {
            map = newMap;
        }
    }

    const teamName = team => (playerTeams.find(pt => pt.value === team) ?? playerTeams[0]).label;

    function updatePlayer(player: PlayerSchema) {
        $room.send('player:info', player);
        audio.menu.button();
    }

    function syncConfig() {
        $room.send('game:config', gameState.config);
    }

    function startGame() {
        gameState.config.startGame = true;
        syncConfig();
    }
</script>

<h3 transition:delayFly><span>Game</span> {gameState.label}</h3>
<div transition:delayFly>Map</div>
{#if $localPlayer.admin}
    <MapChooser bind:selectedMap={map} />
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
{:else if map}
    <span transition:delayFly class="map-tile-container">
        {#key map}
            <span transition:fly class="map-tile">
                <MapTile {map} />
            </span>
        {/key}
    </span>
{/if}
<table transition:delayFly class="player-table">
    <thead>
        <tr>
            <th></th>
            <th>Ready</th>
            <th>Name</th>
            <th>Team</th>
            <th>Latency</th>
        </tr>
    </thead>
    <tbody>
    {#each players as player}
        <tr transition:delayFly>
        {#if !gameState.running && player === $localPlayer}
            <td>{player.admin ? 'Admin' : ''}</td>
            <td><input type="checkbox" bind:checked={player.ready} on:change={() => updatePlayer(player)} /></td>
            <td><input type="text" bind:value={player.displayName} on:change={() => updatePlayer(player)} /></td>
            <td><TeamSelect size={24} options={availableTeams} bind:value={player.team} on:select={() => updatePlayer(player)} /></td>
            <td>{player.ping}ms</td>
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
            <td>{player.ping}ms</td>
        {/if}
        </tr>
    {/each}
    </tbody>
</table>
<div transition:delayFly class="hstack">
    {#if $localPlayer.admin && !gameState.running}
        <button disabled={waitingForReady} use:audioQueue={'button'} on:click={startGame}>Start Game</button>
    {/if}
    {#if waitingForReady}
        <div>{waitMessage}</div>
    {/if}
</div>

<style>
    .map-tile-container {
        display:grid;
    }
    .map-tile{
        grid-row: 1;
        grid-column: 1;
    }

    h3 span {
        opacity: 0.8;
    }

    .player-color {
        justify-content: flex-start;
    }

    button {
        text-align: start;
        padding: 1rem 2rem;
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
        width: 100px;
        min-height: 8em;
        max-height: 16em;
        width: 100%;
        display: block;
        overflow-y: scroll;
    }
    thead th:nth-child(3) {
        width: 80%;
    }
    th {
        text-align: left;
        position: sticky;
        top: 0;
        z-index: 1;
        background: var(--theme-background);
        padding: 1em .5em;
    }
    tbody tr:nth-child(even) {
        background: rgb(200, 200, 200, 0.2);
    }
    td {
        padding: .5em .5em;
    }
</style>