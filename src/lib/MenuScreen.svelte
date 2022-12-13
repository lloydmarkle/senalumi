<script lang="ts">
    import { fly, fade } from 'svelte/transition';

    import type { Room, RoomAvailable } from 'colyseus.js';
    import { convertToRemoteGame, joinRemoteGame, listGameRooms, PlayerSchema, type GameSchema } from './net-game';
    import Select from './components/Select.svelte';
    import { Game, type Team } from './game';

    export let game: Game;
    export let players: PlayerSchema[];
    export let gameState: GameSchema;
    let room: Room<GameSchema>;
    $: currentPlayer = players.find(p => p.sessionId);

    type GameType = 'local' | 'remote';
    let gameType: GameType;
    let playerName = `Guest-${Math.ceil(Math.random() * 100)}`;

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

    function chooseSinglePlayer() {
        gameType = 'local';
        const player = new PlayerSchema(playerName, 'local');
        player.team = playerTeams[1 + Math.floor(Math.random() * (playerTeams.length - 1))].value as Team;
        players = [player];
    }
    chooseSinglePlayer();

    let gameMaps = [
        {
            name: 'a',
            fn: (game: Game) => {},
        },
        {
            name: 'b',
            fn: (game: Game) => {},
        },
        {
            name: 'c',
            fn: (game: Game) => {},
        },
        {
            name: 'd',
            fn: (game: Game) => {},
        },
        {
            name: 'e',
            fn: (game: Game) => {},
        },
        {
            name: 'f',
            fn: (game: Game) => {},
        },
    ];
    let gameFn: (game: Game) => void;
    function startSinglePlayer() {
        game = new Game();
        game.start(0);
        gameState.running = true;
        gameState.gameTimeMS = 1;
    }

    let gameRooms: Promise<RoomAvailable<any>[]>;
    async function chooseMultiplayer() {
        gameType = 'remote';
        gameRooms = listGameRooms();
    }

    let roomName: string = undefined;
    function generateRoomName() {
        return 'correct-horse-battery-staple';
    }

    async function joinRoom(gameName: string) {
        room = await joinRemoteGame(playerName, gameName);
        game = convertToRemoteGame(new Game(), room);

        const resetPlayers = () =>
            players = Array.from(room.state.players.entries(), ([key, player]) =>
                (key === room.sessionId)
                // add sessionid so the game can find the local player
                ? player.assign({ ...player, sessionId: 'local' })
                : player);
        room.state.players.onAdd = player => {
            player.onChange = resetPlayers;
            player.onRemove = resetPlayers;
            resetPlayers();
        };
        room.state.onChange = () => gameState = room.state;
    }

    function leaveRoom() {
        room.leave();
        room = null;
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
    }

    const myFly = (el: Element) => fly(el, { y: -40, duration: 300, delay: 0 });
    const myFadeIn = (el: Element) => fade(el, { duration: 300, delay: 100 });
    const myFadeOut = (el: Element) => fade(el, { duration: 400, delay: 0 });
    const flyIn = (el: Element, item: number) => fly(el, { y: -10, delay: item * 60 + 50 });
</script>

<div class="menu">
    {#if !gameType}
    <div style="text-align: center;" transition:myFly>
        <div in:myFadeIn out:myFadeOut>
            <h1 transition:flyIn={1}>Auralux - Clone</h1>
            <div class="hstack">
                <button class="large-button" transition:flyIn={2} on:click={chooseSinglePlayer}>Single player</button>
                <button class="large-button" transition:flyIn={3} on:click={chooseMultiplayer}>Multiplayer</button>
            </div>
        </div>
    </div>
    {:else if gameType === 'local'}
    <div transition:myFly>
        <div in:myFadeIn out:myFadeOut>
            <button transition:flyIn={1} class="back-button" on:click={() => gameType = null}>Auralux - Clone</button>
            <h1 transition:flyIn={2}>Single player</h1>
            <div class="vstack">
                <div transition:flyIn={3}>Map</div>
                <!-- <span class="hstack map-select">
                    {#each gameMaps as map}
                        <button on:click={() => gameFn = map.fn}>{map.name}</button>
                    {/each}
                </span> -->
                <span transition:flyIn={5} class="hstack">
                    <div>Team</div>
                    <Select options={playerTeams} bind:value={players[0].team} on:select={ev => players[0].team = ev.detail.value} />
                </span>
                <button transition:flyIn={6} on:click={startSinglePlayer}>Launch</button>
            </div>
        </div>
    </div>
    {:else if !room && gameType === 'remote'}
    <div transition:myFly>
        <div in:myFadeIn out:myFadeOut>
            <button transition:flyIn={1} class="back-button" on:click={() => gameType = null}>Auralux - Clone</button>
            <h1 transition:flyIn={2}>Multiplayer</h1>
            <div class="vstack">
                <span transition:flyIn={3} class="hstack">
                    <label for="player-name">Player name</label>
                    <input type="text" id="player-name" name="player-name" bind:value={playerName} />
                </span>
                <span class="grid-box" transition:flyIn={4}>
                {#if roomName !== undefined}
                <span class="hstack" transition:flyIn={1}>
                    <label for="room-name">Game name</label>
                    <input type="text" id="room-name" name="room-name" bind:value={roomName} />
                    <button transition:flyIn={4} on:click={() => joinRoom(roomName)}>Create and join</button>
                </span>
                {:else}
                    <button  on:click={() => roomName = generateRoomName()}>Create game</button>
                {/if}
                </span>
                {#await gameRooms}
                    Loading
                {:then rooms}
                    <table transition:flyIn={5} class="room-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>State</th>
                                <th>Players</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each rooms as gameRoom, idx}
                            <tr transition:flyIn={6 + idx}>
                                <td>{gameRoom.metadata.label}</td>
                                <td>{gameRoom.metadata.state}</td>
                                <td>{gameRoom.clients} / {gameRoom.maxClients ?? 16}</td>
                                <td><button on:click={() => joinRoom(gameRoom.metadata.label)}>Join</button></td>
                            </tr>
                        {/each}
                        </tbody>
                    </table>
                {:catch error}
                    error {error}
                {/await}
            </div>
        </div>
    </div>
    {:else if room}
    <div transition:myFly>
        <div in:myFadeIn out:myFadeOut>
            <button transition:flyIn={1} class="back-button" on:click={() => gameType = null}>Auralux - Clone</button>
            <button transition:flyIn={2} class="back-button" on:click={leaveRoom}>Multiplayer</button>
            <h1 transition:flyIn={3}><span>Game </span>{gameState.label}</h1>
            {#if currentPlayer?.admin}
                <details transition:flyIn={3} class="admin-panel">
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
            <div transition:flyIn={4} class="hstack">
                <h2>
                    {#if gameState.running}
                    Start in {Math.abs(gameState.gameTimeMS / 1000).toFixed(1)}
                    {:else}
                    Waiting for players
                    {/if}
                </h2>
                {#if currentPlayer?.admin && !gameState.running}
                    <button disabled={players.some(p => !p.ready)} on:click={startGame}>Start game</button>
                {/if}
            </div>
            <table transition:flyIn={5} class="player-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Ready</th>
                        <th>Name</th>
                        <th>Team</th>
                    </tr>
                </thead>
                <tbody>
                {#each players as player, idx}
                    <tr transition:flyIn={6 + idx}>
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
</div>

<style>
    .hstack {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem
    }
    .vstack {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        gap: 1rem
    }

    button {
        padding: 1rem 2rem;
    }
    .back-button {
        display: block;
        padding: 0.5rem 2rem;
        font-size: 2rem;
        border: none;
        background: none;
    }
    .large-button {
        padding: 1rem 4rem;
    }

    .map-select {
        max-width: 40vw;
        overflow-x: scroll;
        gap: 2rem;
    }
    .map-select button {
        aspect-ratio: 1;
        min-width: 20rem;
    }

    .menu {
        display: grid;
        align-items: center;
        min-height: 40vh;
        min-width: 40vw;
    }
    .menu > div {
        background: black;
        padding: 1rem 4rem 4rem;
        grid-row: 1;
        grid-column: 1;
    }

    .grid-box {
        display: grid;
        width: 100%;
        align-items: center;
    }
    .menu > * {
        align-self: center;
        justify-self: center;
        grid-row: 1;
        grid-column: 1;
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