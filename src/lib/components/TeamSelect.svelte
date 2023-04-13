<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { audioQueue } from "./audio-effect";
    import TeamSelectionIcon from "./TeamSelectionIcon.svelte";

    let dispatch = createEventDispatcher();
    type TeamInfo = { value: string, label: string };
    export let options: TeamInfo[];
    export let value: string = '';
    export let size = 32;

    function selectTeam(team: TeamInfo) {
        value = team.value;
        dispatch('select', { team: team.value });
    }
</script>

<div class="hstack">
    {#each options as team}
        <button
            use:audioQueue={'teamSelect'}
            class:selected={value === team.value}
            class="list-button"
            on:click={() => selectTeam(team)}
        >
            {#if team.value === ''}
                Watch
            {:else}
                <TeamSelectionIcon color={team.value} {size} />
            {/if}
        </button>
    {/each}
</div>

<style>
    .hstack {
        gap: 0em;
    }

    .selected {
        position: relative;
        box-shadow: 0px 0px 4px 4px var(--theme-link-hover);
    }

    .list-button {
        background: var(--theme-background);
        padding: 0;
        border-radius: 0;
    }
    .list-button:first-child {
        padding: .5em;
        margin-inline-end: .5em;
        border-radius: var(--theme-border-radius);
    }
    .list-button:nth-child(2) {
        border-top-left-radius: var(--theme-border-radius);
        border-bottom-left-radius: var(--theme-border-radius);
    }
    .list-button:last-child {
        border-top-right-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
    }
</style>