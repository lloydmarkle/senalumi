<script lang="ts">
    import { listGameRooms } from '../net-game';
    import { appContext } from '../../context';
    import { delayFly, fade } from './transitions';
    import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';
    import { onDestroy } from 'svelte';
    import type { RoomAvailable } from 'colyseus.js';
    import LoadingIndicator from '../components/LoadingIndicator.svelte';
    import { audioQueue } from '../components/audio-effect';

    let { localPlayer, url } = appContext();

    let loading = false;
    let rooms: RoomAvailable<any>[] = [];
    async function refreshRooms() {
        loading = true;
        rooms = await listGameRooms();
        loading = false;
    }
    refreshRooms();

    let roomRefresher = setInterval(refreshRooms, 5000);
    onDestroy(() => {
        clearInterval(roomRefresher);
    });

    let roomName: string = undefined;
    function joinRoom(roomName: string) {
        $url = `/mp/${roomName}`;
    }

    function generateRoomName() {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
            separator: '-',
            style: 'lowerCase',
        });
    }
</script>

<div class="root vstack">
    <h3 transition:delayFly>Multiplayer</h3>
    <span transition:delayFly class="hstack">
        <label for="player-name">Player name</label>
        <input type="text" id="player-name" name="player-name" bind:value={$localPlayer.displayName} />
    </span>
    <div transition:delayFly class="room-table">
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>State</th>
                    <th>Players</th>
                    <th></th>
                </tr>
            </thead>
            <tbody transition:delayFly={0}>
                {#each rooms as room}
                    <tr>
                        <td>{room.metadata.label}</td>
                        <td>{room.metadata.state}</td>
                        <td>{room.clients} / {room.maxClients ?? 16}</td>
                        <td><button on:click={() => joinRoom(room.metadata.label)}>Join</button></td>
                    </tr>
                {/each}
            </tbody>
        </table>
        {#if loading}
            <span class="loader" transition:fade>
                <LoadingIndicator size={40} color='#747bff' />
            </span>
        {/if}
    </div>
    <span class="grid-box" transition:delayFly>
        {#if roomName !== undefined}
            <span class="hstack" transition:delayFly={1}>
                <label for="room-name">Game name</label>
                <input type="text" id="room-name" name="room-name" bind:value={roomName} />
                <button transition:delayFly use:audioQueue={'button'} on:click={() => roomName = generateRoomName()}>↻</button>
                <button transition:delayFly use:audioQueue={'button'} on:click={() => joinRoom(roomName)}>Create and join</button>
            </span>
        {:else}
            <button style="width:30%" use:audioQueue={'button'} on:click={() => roomName = generateRoomName()}>Create new game</button>
        {/if}
    </span>
</div>

<style>
    .room-table {
        position: relative;
    }

    .loader {
        bottom: 0;
        right: .5em;
        position: absolute;
    }

    .root {
        position: relative;
    }

    .grid-box {
        display: grid;
        width: 100%;
        align-items: center;
    }
    .grid-box .hstack {
        flex-wrap: wrap;
    }

    table {
        table-layout: fixed;
        border-collapse: collapse;
        min-height: 16em;
        max-height: 24em;
        width: 100%;
        display: block;
        overflow-y: scroll;
    }
    thead th:nth-child(1) {
        width: 100%;
    }
    th {
        position: sticky;
        top: 0;
        text-align: left;
        background: var(--theme-background);
        padding: 1em .5em;
    }
    tbody tr:nth-child(even) {
        background: rgb(200, 200, 200, 0.2);
    }
    td {
        padding: 1em .5em;
    }

    @media(min-width: 400px) {
        .root {
            min-width: 80vw;
        }
    }
    @media(min-width: 860px) {
        .root {
            min-width: 40em;
        }
    }
</style>