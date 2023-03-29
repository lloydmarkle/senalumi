<script lang="ts">
    import { fly } from "../menu/transitions";

    export let confirmText: string;
    export let text: string;
    export let actionFn: () => void;

    let toggle = false;
</script>

<div class="hstack">
    {#if toggle}
        <span in:fly>{confirmText}</span>
        <button in:fly on:click={actionFn}>Yes</button>
        <button in:fly on:click={() => toggle = false}>No</button>
    {:else}
        <button in:fly on:click={() => toggle = true}>{text}</button>
    {/if}
</div>
