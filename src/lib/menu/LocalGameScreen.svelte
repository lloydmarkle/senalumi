<script lang="ts">
    import { type GameMap, type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import MapChooser from './MapChooser.svelte';
    import { availableTeamsFromMap, playerTeams } from '../data';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';

    let { localPlayer } = appContext();
    let map: GameMap = null;
    let availableTeams = playerTeams;
    $: if (map) {
        availableTeams = [
            playerTeams[0],
            ...availableTeamsFromMap(map),
        ];
    }
    $: playerTeam = availableTeams.find(t => t.value === $localPlayer.team)
        ? $localPlayer.team : selectRandom(availableTeams).value as Team;
    $: if (playerTeam) $localPlayer.team = playerTeam;

    const selectRandom = (items: any[]) =>
        items[1 + Math.floor(Math.random() * (items.length - 1))];
</script>

<h3 transition:delayFly>Single player</h3>
<div class="vstack">
    <div transition:delayFly>Map <span>{map?.props.name ?? ''}</span></div>
    <MapChooser bind:selectedMap={map} />
    <span transition:delayFly class="hstack">
        <div>Team</div>
        <TeamSelect options={availableTeams} bind:value={playerTeam} />
    </span>
    <a href="#team={playerTeam}&map={map?.props.name}"
        class="btn"
        use:audioQueue={'button'}
        transition:delayFly
        class:disabled={map === null}
    >Launch</a>
</div>

<style>
    span {
        opacity: .8;
    }

    .disabled {
        opacity: .5;
    }
</style>