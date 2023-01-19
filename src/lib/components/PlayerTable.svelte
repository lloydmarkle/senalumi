<script lang="ts">
    import type { Room } from "colyseus.js";
    import { playerTeams } from "../data";
    import type { GameSchema, PlayerSchema } from "../net-game";
    import TeamSelectionIcon from "./TeamSelectionIcon.svelte";

    export let room: Room<GameSchema>

    let gameState = room.state;

    const teamName = team => (playerTeams.find(pt => pt.value === team) ?? playerTeams[0]).label;

    let players: PlayerSchema[] = [];
    const resetPlayers = () => players = Array.from(gameState.players.values());
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
            <td>{player.displayName}</td>
            <td>
                <div class="hstack player-color">
                    <TeamSelectionIcon size={20} color={player.team} />
                    <span>{teamName(player.team)}</span>
                </div>
            </td>
            <td>0ms</td>
        </tr>
    {/each}
    </tbody>
</table>

<style>
    .player-color {
        justify-content: flex-start;
    }

    table {
        font-size: .8rem;
        table-layout: fixed;
        border-collapse: collapse;
    }
    thead th:nth-child(3) {
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