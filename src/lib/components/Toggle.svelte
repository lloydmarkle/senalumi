<script lang="ts">
    // derived from https://www.smashingmagazine.com/2017/09/building-inclusive-toggle-buttons/
    export let id: string;
    export let checked: boolean = false;
</script>

<button role="switch" aria-checked="{checked}" aria-labelledby={id} on:click={() => checked = !checked} on:click>
    <span>on</span>
    <span>off</span>
</button>
<span {id}><slot /></span>

<style>
button {
    color: white;
    background-color: #000;
    border-radius: 0.5rem;
    padding: 0.5em 0.5em;
}
button span {
    padding: 0 0.5em;
}

[role="switch"][aria-checked="true"] :first-child,
[role="switch"][aria-checked="false"] :last-child {
    color: #000;
    background: #fff;
}
</style>