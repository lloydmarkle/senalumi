<script lang="ts">
    import { listGameRooms } from '../net-game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';

    let { localPlayer, roomName, menu } = appContext();
    function joinRoom(gameRoomName: string) {
        $roomName = gameRoomName;
        $menu = 'lobby';
    }

    let gameRooms = listGameRooms();
    let gameRoomName: string = undefined;
    function generateRoomName() {
        return 'correct-horse-battery-staple';
    }
</script>

<h1 transition:delayFly>Multiplayer</h1>
<div class="vstack">
    <span transition:delayFly class="hstack">
        <label for="player-name">Player name</label>
        <input type="text" id="player-name" name="player-name" bind:value={$localPlayer.displayName} />
    </span>
    <span class="grid-box" transition:delayFly>
        {#if gameRoomName !== undefined}
            <span class="hstack" transition:delayFly={1}>
                <label for="room-name">Game name</label>
                <input type="text" id="room-name" name="room-name" bind:value={gameRoomName} />
                <button transition:delayFly on:click={() => joinRoom(gameRoomName)}>Create and join</button>
            </span>
        {:else}
            <button on:click={() => gameRoomName = generateRoomName()}>Create game</button>
        {/if}
    </span>
    {#await gameRooms}
        Loading
    {:then rooms}
        <table transition:delayFly class="room-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Players</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {#each rooms as gameRoom}
                <tr transition:delayFly>
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

<style>
    .grid-box {
        display: grid;
        width: 100%;
        align-items: center;
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