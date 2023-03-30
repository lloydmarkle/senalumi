<script lang="ts">
    import type { Room } from "colyseus.js";
    import { playerTeams } from "../data";
    import type { GameSchema, PlayerSchema } from "../net-game";
    import TeamSelectionIcon from "./TeamSelectionIcon.svelte";

    export let room: Room<GameSchema>
    export let localPlayer: PlayerSchema;

    function updatePlayer() {
        console.log('changing player', localPlayer.displayName)
        room.send('player:info', localPlayer);
    }

    let gameState = room.state;

    let players: PlayerSchema[] = [];
    const resetPlayers = () => players = Array.from(gameState.players.values());
    gameState.players.forEach(player => {
        player.onChange = resetPlayers;
        player.onRemove = resetPlayers;
    });
    gameState.players.onAdd = player => {
        player.onChange = resetPlayers;
        player.onRemove = resetPlayers;
        resetPlayers();
    };
    resetPlayers();
</script>

<table class="room-table">
    <thead>
        <tr>
            <th></th>
            <th>Player</th>
            <th>Team</th>
            <th>Latency</th>
        </tr>
    </thead>
    <tbody>
        {#each players as player}
        <tr>
            <td>{player.admin ? '♚' : ''}</td>
            {#if player === localPlayer}
                <td contenteditable=true on:blur={updatePlayer} bind:textContent={player.displayName}>{player.displayName}</td>
            {:else}
                <td>{player.displayName}</td>
            {/if}
            <td><TeamSelectionIcon size={20} color={player.team} /></td>
            <td>{player.ping}ms</td>
        </tr>
    {/each}
    </tbody>
</table>

<style>
    table {
        font-size: .8rem;
        table-layout: fixed;
        border-collapse: collapse;
    }
    thead th:nth-child(2) {
        width: 80%;
    }
    th {
        text-align: left;
        background: rgb(200, 200, 200, 0.4);
        padding: .5em 1em;
    }
    tbody tr:nth-child(even) {
        background: rgb(200, 200, 200, 0.2);
    }
    td {
        padding: .5em 1em;
    }
</style>