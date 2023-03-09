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
        border-radius: var(--theme-border-radius);
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
        position: relative;
    }

    button::after {
        content: '';
        position: absolute;
        display: block;
        top:0; bottom:0; left:0; right: 0;
        transition: opacity 0.5s ease-in-out;
        opacity: 0;
        box-shadow: 0px 0px 8px 6px var(--theme-link);
        border-radius: var(--theme-border-radius);
    }
    .selected-map::after {
        opacity: 1;
    }
</style>