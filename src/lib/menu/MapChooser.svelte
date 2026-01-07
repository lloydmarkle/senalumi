<script lang="ts">
    import { delayFly } from './transitions';
    import MapTile from './MapTile.svelte';
    import { audioQueue } from '../components/audio-effect';
    import type { MapData } from 'src/stored-data';

    export let maps: Iterable<MapData>;
    export let selectedMap: MapData;

    function setMapFunction(map: MapData) {
        selectedMap = map;
    }
</script>

<div transition:delayFly={3} class="hstack map-select">
    {#each maps as md}
        <button
            use:audioQueue={'button'}
            class:selected-map={selectedMap?.id === md.id}
            on:click={() => setMapFunction(md)}
        >
            <slot mapData={md}>
                <MapTile map={md.map} />
            </slot>
        </button>
    {/each}
</div>

<style>
    .map-select {
        border-radius: var(--theme-border-radius);
        max-height: calc(2em + 60px);
        flex-wrap: wrap;
        overflow-y: scroll;
        gap: .6em;
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

    @media(min-width: 400px) {
        .map-select {
            gap: .8em;
            max-height: calc(2em + 90px);
        }
    }
    @media(min-width: 860px) {
        .map-select {
            gap: 1.2em;
            max-height: calc(4em + 160px);
        }
    }
</style>