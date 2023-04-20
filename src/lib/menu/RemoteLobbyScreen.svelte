<script lang="ts">
    import { Game, type GameMap } from '../game';
    import { convertToRemoteGame, GameSchema, joinRemoteGame, PlayerSchema, rejoinRoom,  } from '../net-game';
    import { delayFly, fade, fly } from './transitions';
    import { appContext } from '../../context';
    import TeamSelectionIcon from '../components/TeamSelectionIcon.svelte';
    import { availableTeamsFromMap, playerTeams } from '../data';
    import MapChooser from './MapChooser.svelte';
    import MapTile from './MapTile.svelte';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';
    import LoadingIndicator from '../components/LoadingIndicator.svelte';
    import { onDestroy } from 'svelte';
    import ExpandingMenu from '../components/ExpandingMenu.svelte';

    const { localPlayer, room, game, audio, url, prefs } = appContext();

    let destroyed = false;
    onDestroy(() => {
        destroyed = true;
    });

    let nameFromUrl = $url.split('/')[2]
    let roomName = nameFromUrl ?? $prefs.remoteGame?.name;
    const joinRoom = async () => {
        const remote = $prefs.remoteGame;
        if (remote && remote.name === nameFromUrl) {
            try {
                return await rejoinRoom(remote.roomId, remote.sessionId);
            } catch (e) {
                console.log('reconnect failed',e)
                delete $prefs.remoteGame
            }
        }

        try {
            return await joinRemoteGame($localPlayer.displayName, roomName);
        } catch (e) {
            console.log('Unable to join game room', e);
        }
    };

    let gameState: GameSchema;
    const joining = joinRoom().then(r => {
        if (destroyed) {
            // joining can take time depending on latency so it's possible the user hits "go back" before the join
            // above finished. If this component is destroyed before join completes then leave the room
            r.leave();
            return;
        }

        gameState = r.state;
        $room = r;

        const resetPlayers = () => players = Array.from(gameState.players.values());
        gameState.players.onAdd = player => {
            player.onChange = resetPlayers;
            player.onRemove = resetPlayers;
            resetPlayers();
        };
        gameState.players.triggerAll();
        $localPlayer = gameState.players.get($room.sessionId);

        gameState.onChange = async () => {
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
        const readConfig = () => {
            const newMap: GameMap = JSON.parse(gameState.config.gameMap);
            if (newMap.props.img !== map?.props.img) {
                map = newMap;
            }
        }
        gameState.config.onChange = readConfig;
        readConfig();
    });

    let map: GameMap;
    let players: PlayerSchema[] = [];

    let availableTeams = playerTeams;
    $: if (map) {
        availableTeams = [
            playerTeams[0],
            ...availableTeamsFromMap(map),
        ];
    }
    $: if ($localPlayer.admin && map && gameState) {
        gameState.config.gameMap = JSON.stringify(map);
        syncConfig();
    }
    $: waitingForReady = players.some(p => !p.ready) || !map;
    $: waitMessage = map ? '(Waiting for players)' : '(Waiting for players and map)';

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

<div class="root vstack">
{#await joining}
    <div class="joining-spinner hstack" transition:fade|local={{ duration: 1000 }}>
        <span>
            <span>Joining...</span>
            <span>{roomName}</span>
        </span>
        <LoadingIndicator size={80} color='#747bff' />
    </div>
{:then}
    <h3 transition:delayFly><span>Game</span> {gameState.label}</h3>
    <div transition:delayFly>Map</div>
    {#if $localPlayer.admin}
        <span transition:delayFly><MapChooser bind:selectedMap={map} /></span>
        <span transition:delayFly style="width:15em">
        <ExpandingMenu>
            <div class="hstack admin-toggle" slot="button-content" let:open>
                <span class="arrow" class:arrow-open={open} />Configure game
            </div>

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
        </ExpandingMenu>
        </span>
    {:else if map}
        <span transition:delayFly class="map-tile-container">
            {#key map}
                <span transition:fly class="map-tile">
                    <MapTile {map} />
                </span>
            {/key}
        </span>
    {/if}
    <div class="player-table">
        <table transition:delayFly>
            <thead>
                <tr>
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
                    <td><input type="checkbox" bind:checked={player.ready} on:change={() => updatePlayer(player)} /></td>
                    <td><input type="text" size="12" bind:value={player.displayName} on:change={() => updatePlayer(player)} /></td>
                    <td><TeamSelect options={availableTeams} bind:value={player.team} on:select={() => updatePlayer(player)} /></td>
                {:else}
                    <td>{player.ready ? 'Ready' : 'Not ready'}</td>
                    <td>{player.displayName}</td>
                    <td>
                        <div class="hstack player-color">
                            <TeamSelectionIcon color={player.team} />
                            <span>{teamName(player.team)}</span>
                        </div>
                    </td>
                {/if}
                <td>{player.ping}ms {player.admin ? '(Admin)' : ''}</td>
                </tr>
            {/each}
            </tbody>
        </table>
    </div>
    <div transition:delayFly class="hstack">
        {#if $localPlayer.admin && !gameState.running}
            <button disabled={waitingForReady} use:audioQueue={'button'} on:click={startGame}>Start Game</button>
        {/if}
        {#if waitingForReady}
            <div>{waitMessage}</div>
        {/if}
    </div>
{/await}
</div>

<style>
    .root {
        position: relative;
        min-height: 30em;
        gap: .5em;
    }

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

    .joining-spinner {
        z-index: 20;
        position: absolute;
        top: 0; left:0; bottom:0; right:0;
        margin-top: 4em;
        justify-content: center;
    }
    .joining-spinner span span:first-child {
        opacity: 0.7;
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
        grid-template-columns: 1fr;
        row-gap: 0.5rem;
        column-gap: 0.5rem;
        background: var(--theme-background);
    }

    .arrow {
        border-top: .5em solid transparent;
        border-bottom: .5em solid transparent;
        border-left: .5em solid var(--theme-foreground);
        width: 0;
        height: 0;

        margin: 1em;
        display: inline-block;
        left: .5em;
        position: relative;
        transition: transform .3s;
    }
    .arrow-open {
        transform: rotate(90deg);
    }

    .hstack {
        flex-wrap: wrap;
    }

    .player-table {
        min-height: 8em;
        max-height: 16em;
        overflow-y: scroll;
        max-width: calc(100vw - 2em);
    }
    table {
        border-collapse: collapse;
        width: 100%;
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

    @media(min-width: 400px) {
        .root {
            min-width: 80vw;
        }
        .options-grid {
            grid-template-columns: 1fr 1fr;
        }
        .player-table {
            max-width: unset;
        }
    }
    @media(min-width: 860px) {
        .root {
            min-width: 40em;
        }
    }
</style>