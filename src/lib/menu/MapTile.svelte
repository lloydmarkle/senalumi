<script lang="ts">
    import type { GameMap } from "../game";
    export let map: GameMap;
</script>

<div>
    {#if map.props.img}
        <img src={map.props.img} alt="map: {map.props.displayName}" />
    {/if}
    <span>{map.props.displayName}</span>
</div>

<style>
    div {
        aspect-ratio: 1;
        width: 64px;
        position: relative;
        background: var(--theme-background-3);
        border-radius: var(--theme-border-radius);
    }
    img {
        position: relative;
        width: 48px;
        top: .5em;
    }
    span {
        display: none;
        position: absolute;
        right: 0.5rem;
        bottom: 0.5rem;
    }

    @media(min-width: 400px) {
        span {
            display: inline;
        }
        div {
            width: 96px;
        }
        img {
            width: 64px;
            top: 1em;
        }
    }
    @media(min-width: 860px) {
        div {
            width: 160px;
        }
        img {
            width: 128px;
        }
    }
</style>