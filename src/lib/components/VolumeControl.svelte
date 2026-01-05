<script lang="ts">
    import { audioQueue } from "./audio-effect";

    let hoverVolume: number;
    export let volume: number = 0;
    let levels = [0, .2, .4, .6, .8, 1];
</script>

<div class="volume-buttons">
    <span>Volume {volume * 100}%</span>
    {#each levels as level}
        <button
            use:audioQueue={'button'}
            class="vlevel"
            class:volume={volume >= level}
            class:over={hoverVolume >= level}
            on:pointermove={() => hoverVolume = level}
            on:click={() => volume = level}
            style="--bar-height:calc({level} * 4em)" />
    {/each}
</div>

<style>
    .volume-buttons {
        position: relative;
        display: flex;
        gap: 0.1em;
    }

    span {
        pointer-events: none;
        position: absolute;
        top: 0;
        left: 1em;
        z-index: 1;
    }

    .vlevel {
        border: none;
        padding: 0;
        border-radius: 0;
        position: relative;
        width: 2em;
        height: 4em;
        background: var(--theme-gradient-fg2);
    }
    .volume-buttons:hover .vlevel:hover {
        background: var(--theme-background-2);
    }

    .vlevel::before,
    .vlevel::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 2em;
        height: var(--bar-height);
        background: var(--theme-gradient-bg1);
        transition: opacity .3s, background .3s;
    }
    .volume::after {
        background: var(--theme-link);
    }

    .volume-buttons:hover .over::before {
        background: var(--theme-link);
    }
    .volume-buttons:hover .volume::after {
        opacity: .4;
    }
</style>