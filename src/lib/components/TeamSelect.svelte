<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { audioQueue } from "./audio-effect";
    import TeamSelectionIcon from "./TeamSelectionIcon.svelte";

    let dispatch = createEventDispatcher();
    type TeamInfo = { value: string, label: string };
    export let options: TeamInfo[];
    export let value: string = '';
    export let size = 32;

    $: watchTeam = options.find(e => e.value === '');
    $: teams = options.filter(e => e.value !== '');

    function selectTeam(team: TeamInfo) {
        value = team.value;
        dispatch('select', { team: team.value });
    }
</script>

<div class="hstack outer">
    {#if watchTeam}
        <button
            use:audioQueue={'teamSelect'}
            class:selected={value === watchTeam.value}
            on:click={() => selectTeam(watchTeam)}
        >
            Watch
        </button>
    {/if}
    <div class="hstack inner">
        {#each teams as team}
            <button
                use:audioQueue={'teamSelect'}
                class:selected={value === team.value}
                class="list-button"
                on:click={() => selectTeam(team)}
            >
                <TeamSelectionIcon color={team.value} {size} />
            </button>
        {/each}
    </div>
</div>

<style>
    .hstack {
        flex-wrap: wrap;
    }
    .inner {
        gap: 0em;
        justify-content: center;
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
        border-top-left-radius: var(--theme-border-radius);
        border-bottom-left-radius: var(--theme-border-radius);
    }
    .list-button:last-child {
        border-top-right-radius: var(--theme-border-radius);
        border-bottom-right-radius: var(--theme-border-radius);
    }
</style>