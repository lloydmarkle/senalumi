<script lang="ts">
    import type { GameMap } from "../game";
    export let map: GameMap;
</script>

<div>
    {#if map.props.img}
        <img src={map.props.img} alt="map" />
    {/if}
    <span>{map.props.name}</span>
</div>

<style>
    div {
        aspect-ratio: 1;
        width: 160px;
        position: relative;
        background: var(--theme-background-3);
        border-radius: var(--theme-border-radius);
    }
    img {
        position: relative;
        top: 1rem;
    }
    span {
        position: absolute;
        right: 0.5rem;
        bottom: 0.5rem;
    }
</style>