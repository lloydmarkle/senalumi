<script lang="ts">
    import { Game, initializerFromMap, type GameMap, type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import MapChooser from './MapChooser.svelte';
    import { availableTeamsFromMap, playerTeams } from '../data';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';

    let { game, localPlayer } = appContext();
    let map: GameMap = null;
    let availableTeams = playerTeams;
    $: if (map) {
        availableTeams = [
            playerTeams[0],
            ...availableTeamsFromMap(map),
        ];
    }
    $: $localPlayer.team = $localPlayer.team !== undefined && availableTeams.find(t => t.value === $localPlayer.team)
        ? $localPlayer.team : selectRandom(availableTeams).value as Team;

    const selectRandom = (items: any[]) =>
        items[1 + Math.floor(Math.random() * (items.length - 1))];

    function startGame() {
        $game = new Game(initializerFromMap(map));
        const player = $game.players.find(p => p.team === $localPlayer.team);
        if (player) {
            player.ai.enabled = false;
        }
        $game.start(0);
    }
</script>

<h3 transition:delayFly>Single player</h3>
<div class="vstack">
    <div transition:delayFly>Map</div>
    <MapChooser bind:selectedMap={map} />
    <span transition:delayFly class="hstack">
        <div>Team</div>
        <TeamSelect options={availableTeams} bind:value={$localPlayer.team} />
        {#if !$localPlayer.team}
            <span class="watching">(Watch)</span>
        {/if}
    </span>
    <button
        use:audioQueue={'button'}
        transition:delayFly
        disabled={map === null}
        on:click={startGame}>Launch</button>
</div>

<style>
    .watching {
        animation: pulse 1s infinite;
    }
    @keyframes pulse {
        0%, 100% { opacity: .6; }
        40%, 60% { opacity: 1; }
    }
</style>