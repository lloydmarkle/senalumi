<script lang="ts">
    import { fly } from "../menu/transitions";
    import { audioQueue } from "./audio-effect";

    export let confirmText: string;
    export let text: string;
    export let actionFn: () => void;

    let toggle = false;
</script>

<div class="hstack">
    {#if toggle}
        <span in:fly>{confirmText}</span>
        <button in:fly use:audioQueue={'button'} on:click={actionFn}>Yes</button>
        <button in:fly use:audioQueue={'menuClose'} on:click={() => toggle = false}>No</button>
    {:else}
        <button in:fly use:audioQueue={'menuOpen'} on:click={() => toggle = true}>{text}</button>
    {/if}
</div>
