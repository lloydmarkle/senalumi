<script lang="ts">
    import Select from '../components/Select.svelte';
    import { Game, initializerFromMap, type GameMap, type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import MapChooser from './MapChooser.svelte';
    import { availableTeamsFromMap, playerTeams } from '../data';

    let { game, localPlayer } = appContext();
    let map: GameMap = null;
    let availableTeams = playerTeams;
    $: if (map) {
        availableTeams = [
            playerTeams[0],
            ...availableTeamsFromMap(map),
        ];
    }
    $: $localPlayer.team = availableTeams[1 + Math.floor(Math.random() * (availableTeams.length - 1))].value as Team;

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
        <Select options={availableTeams} bind:value={$localPlayer.team} on:select={ev => $localPlayer.team = ev.detail.value} />
    </span>
    <button
        transition:delayFly
        disabled={map === null}
        on:click={startGame}>Launch</button>
</div>