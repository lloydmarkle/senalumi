<script lang="ts">
    import { audioQueue } from "./audio-effect";


    // derived from https://www.smashingmagazine.com/2017/09/building-inclusive-toggle-buttons/
    export let id: string;
    export let state: boolean = false;
</script>

<div>
    <button role="switch" aria-checked="{state}" aria-labelledby={id} on:click={() => state = !state} on:click use:audioQueue={'toggle'}>
        <span>on</span><span>off</span>
    </button>
    <span {id}><slot /></span>
</div>

<style>
button {
    color: white;
    background-color: var(--theme-background-3);
    border-radius: var(--theme-border-radius);
    padding: 0.5em;
    position: relative;
    min-width: 7em;
}
button span {
    padding: 0 0.5em;
    width: 1.5em;
    display: inline-block;
    position: relative;
    transition: color .2s ease-in-out;
}

[role="switch"][aria-checked="true"] :first-child,
[role="switch"][aria-checked="false"] :last-child {
    color: var(--theme-background-3);
}

button::before {
    content: '';
    position: absolute;
    padding: .7em 1.2em;
    background: #fff;
    border-radius: var(--theme-border-radius);
    transition: transform .2s ease-in-out;
}
[role="switch"][aria-checked="false"]::before {
    transform: translate(110%, 0);
}
[role="switch"][aria-checked="true"]::before {
    color: var(--theme-background-3);
}
</style>