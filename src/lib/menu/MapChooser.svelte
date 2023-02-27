<script lang="ts">
    import type { GameMap } from '../game';
    import { gameMaps } from '../data';
    import { delayFly } from './transitions';
    import MapTile from './MapTile.svelte';

    export let selectedMap: GameMap;

    function setMapFunction(map: GameMap) {
        selectedMap = map;
    }
</script>

<div transition:delayFly={3} class="hstack map-select">
    {#each gameMaps as map}
        <button
            class:selected-map={selectedMap === map}
            on:click={() => setMapFunction(map)}>
            <MapTile {map} />
        </button>
    {/each}
</div>

<style>
    .map-select {
        max-height: calc(4em + 160px);
        flex-wrap: wrap;
        overflow-y: scroll;
        gap: 1.2em;
        padding: 1em 1em;
        background: #1a1a1a;
        justify-content: flex-start;
    }

    button {
        padding: 0;
    }

    .selected-map {
        box-shadow: 0px 0px 2px 4px cornflowerblue;
    }
</style>