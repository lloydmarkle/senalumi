<script lang="ts">
    import { type GameMap, type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import MapChooser from './MapChooser.svelte';
    import { availableTeamsFromMap, playerTeams, prioritizedTeams, type TeamInfo } from '../data';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';
    import ExpandingMenu from '../components/ExpandingMenu.svelte';
    import TeamSelectionIcon from '../components/TeamSelectionIcon.svelte';

    let { localPlayer, prefs } = appContext();

    let priorityTeams: TeamInfo[] = $prefs.preferredTeams.map(e => playerTeams.find(t => t.value === e));
    let overrideTeams: TeamInfo[] = playerTeams.slice(1).filter(e => !priorityTeams.includes(e));
    let availableTeams = [playerTeams[0], ...priorityTeams, ...overrideTeams];
    let map: GameMap = null;
    $: if (map) availableTeams = [playerTeams[0], ...prioritizedTeams(availableTeamsFromMap(map), priorityTeams)];
    $: playerTeam = availableTeams.find(t => t.value === $localPlayer.team)
        ? $localPlayer.team : selectRandom(availableTeams).value as Team;
    $: if (playerTeam) $localPlayer.team = playerTeam;

    function prioritizeTeam(team: TeamInfo) {
        priorityTeams = [...priorityTeams, team];
        overrideTeams = overrideTeams.filter(e => e !== team);
        $prefs.preferredTeams = priorityTeams.map(e => e.value as Team);
    }
    function deprioritizeTeam(team: TeamInfo) {
        overrideTeams = [...overrideTeams, team];
        priorityTeams = priorityTeams.filter(e => e !== team);
        $prefs.preferredTeams = priorityTeams.map(e => e.value as Team);
    }

    const selectRandom = (items: any[]) =>
        items[1 + Math.floor(Math.random() * (items.length - 1))];
</script>

<h3 transition:delayFly>Single player</h3>
<div class="vstack">
    <div transition:delayFly>Map <span>{map?.props.name ?? ''}</span></div>
    <MapChooser bind:selectedMap={map} />
    <div transition:delayFly style="width:15em">
        <ExpandingMenu>
            <div class="hstack admin-toggle" slot="button-content" let:open>
                <span class="arrow" class:arrow-open={open}></span>Configure game
            </div>

            <div class="options-grid">
                <label for="colour-override" class="hstack">
                    <span>Colour override:</span>
                    <span class="hstack team-list">
                        {#if priorityTeams.length}
                            {#each priorityTeams as team}
                                <button
                                    use:audioQueue={'teamSelect'}
                                    class="list-button"
                                    on:click={() => deprioritizeTeam(team)}
                                >
                                    <TeamSelectionIcon color={team.value} size={32} />
                                </button>
                            {/each}
                        {:else}
                            No overrides
                        {/if}
                    </span>
                    <span>Available Colours:</span>
                    <span class="hstack team-list">
                        {#each overrideTeams as team}
                            <button
                                use:audioQueue={'teamSelect'}
                                class="list-button"
                                on:click={() => prioritizeTeam(team)}
                            >
                                <TeamSelectionIcon color={team.value} size={32} />
                            </button>
                        {/each}
                    </span>
                </label>

            </div>
        </ExpandingMenu>
    </div>
    <span transition:delayFly class="hstack">
        <div>Team</div>
        <TeamSelect options={availableTeams} bind:value={playerTeam} />
    </span>
    <a href="#team={availableTeams.findIndex(t => t.value === playerTeam)}&map={map?.props.name}"
        class="btn"
        use:audioQueue={'button'}
        transition:delayFly
        class:disabled={map === null}
    >Launch</a>
</div>

<style>
    span {
        opacity: .8;
    }

    .disabled {
        opacity: .5;
        pointer-events: none;
        cursor: default;
    }

    .list-button {
        padding: 0;
        margin: 0;
    }

    .team-list {
        gap:0em;
        justify-content:center;
    }

    .options-grid {
        display: grid;
        grid-template-columns: 1fr;
        row-gap: 0.5rem;
        column-gap: 0.5rem;
        background: var(--theme-background);
    }

    .arrow {
        border-top: .5em solid transparent;
        border-bottom: .5em solid transparent;
        border-left: .5em solid var(--theme-foreground);
        width: 0;
        height: 0;

        margin: 1em;
        display: inline-block;
        left: .5em;
        position: relative;
        transition: transform .3s;
    }
    .arrow-open {
        transform: rotate(90deg);
    }
</style>