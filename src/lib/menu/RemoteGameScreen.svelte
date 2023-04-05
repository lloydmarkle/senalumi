<script lang="ts">
    import { joinRemoteGame, listGameRooms } from '../net-game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import { uniqueNamesGenerator, adjectives, animals, colors } from 'unique-names-generator';
    import { onDestroy } from 'svelte';
    import type { RoomAvailable } from 'colyseus.js';
    import { blur, type BlurParams } from 'svelte/transition';
    import LoadingIndicator from '../components/LoadingIndicator.svelte';
    import { audioQueue } from '../components/audio-effect';

    let { room, localPlayer, menu } = appContext();

    let loading = false;
    let rooms: RoomAvailable<any>[] = [];
    async function refreshRooms() {
        loading = true;
        rooms = await listGameRooms();
        loading = false;
    }
    refreshRooms();
    let roomRefresher = setInterval(refreshRooms, 5000);

    let destroyed = false;
    let joining = null;
    async function joinRoom(roomName: string) {
        joining = roomName;
        try {
            let gameRoom = await joinRemoteGame($localPlayer.displayName, roomName);
            if (destroyed) {
                // joining can take time depending on latency so it's possible the user hits "go back" before the join
                // above finished. If this component is destroyed, leave the room
                gameRoom.leave();
                return;
            }

            $room = gameRoom;
            $menu = 'lobby';
        } catch (e) {
            joining = null;
            console.log('Unable to join game room', e);
        }
    }

    onDestroy(() => {
        destroyed = true;
        clearInterval(roomRefresher);
    });

    // Fade should be fine but blur performs better in firefox
    let fade = (el: Element, props?: BlurParams) => blur(el, { amount: 0, ...props });

    let roomName: string = undefined;
    function generateRoomName() {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, colors, animals],
            separator: '-',
            style: 'lowerCase',
        });
    }
</script>

{#if joining}
<div class="joining-spinner hstack" transition:fade|local={{ duration: 2000 }}>
    <span>
        <span>Joining...</span>
        <span>{joining}</span>
    </span>
    <LoadingIndicator size={80} color='#747bff' />
</div>
{/if}

<div class:disabled={joining} class="root vstack">
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

    .joining-spinner {
        z-index: 2;
        position: absolute;
        top: 0; left:0; bottom:0; right:0;
        margin-top: 4em;
        justify-content: center;
    }
    .joining-spinner span span:first-child {
        opacity: 0.7;
    }

    .root {
        position: relative;
        min-width: 60vw;
    }
    .disabled::before {
        content: '';
        position: absolute;
        top:0; left:0; right:0; bottom:0;
        background: var(--theme-gradient-fg2);
        z-index:1;
    }
    .grid-box {
        display: grid;
        width: 100%;
        align-items: center;
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
</style>