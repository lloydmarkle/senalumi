<script lang="ts">
    import Select from '../components/Select.svelte';
    import { Game, type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';

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

    let { menu, game, localPlayer } = appContext();
    $localPlayer.team = playerTeams[1 + Math.floor(Math.random() * (playerTeams.length - 1))].value as Team;
    function startGame() {
        $menu = 'start';
        $game = new Game();
        $game.start(0);
    }
</script>

<h1 transition:delayFly>Single player</h1>
<div class="vstack">
    <div transition:delayFly>Map</div>
    <!-- <span class="hstack map-select">
        {#each gameMaps as map}
            <button on:click={() => gameFn = map.fn}>{map.name}</button>
        {/each}
    </span> -->
    <span transition:delayFly class="hstack">
        <div>Team</div>
        <Select options={playerTeams} bind:value={$localPlayer.team} on:select={ev => $localPlayer.team = ev.detail.value} />
    </span>
    <button transition:delayFly on:click={startGame}>Launch</button>
</div>