<script lang="ts">
    import { type Team } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';
    import MapChooser from './MapChooser.svelte';
    import { availableTeamsFromMap, playerTeams, prioritizedTeams, type TeamInfo } from '../data';
    import TeamSelect from '../components/TeamSelect.svelte';
    import { audioQueue } from '../components/audio-effect';
    import ExpandingMenu from '../components/ExpandingMenu.svelte';
    import TeamSelectionIcon from '../components/TeamSelectionIcon.svelte';
    import { DataStore, type MapData } from '../../stored-data';
    import LoadingIndicator from '../components/LoadingIndicator.svelte';

    let { localPlayer, prefs } = appContext();
    const gameMaps = DataStore.load().then(db => db.loadMaps());

    let priorityTeams: TeamInfo[] = $prefs.preferredTeams.map(e => playerTeams.find(t => t.value === e));
    let overrideTeams: TeamInfo[] = playerTeams.slice(1).filter(e => !priorityTeams.includes(e));
    let availableTeams = [playerTeams[0], ...priorityTeams, ...overrideTeams];
    let mapData: MapData = null;
    $: if (mapData) availableTeams = [playerTeams[0], ...prioritizedTeams(availableTeamsFromMap(mapData.map), priorityTeams)];
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

    const formatTime = (duration: number) => [
        Math.floor(duration / 60).toString().padStart(2, '0'),
        Math.floor(duration % 60).toString().padStart(2, '0'),
    ].join(':');
    const formatPercent = (num: number) =>
        (num * 100).toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 0 }) + '%';

    const selectRandom = (items: any[]) =>
        items[1 + Math.floor(Math.random() * (items.length - 1))];
</script>

<h3 transition:delayFly>Single player</h3>
<div class="vstack">
    {#await gameMaps}
        <LoadingIndicator size={80} color='#747bff' />
    {:then gameMaps}
        <MapChooser maps={gameMaps} bind:selectedMap={mapData} let:mapData>
            {@render mapTileWithStats(mapData as MapData)}
        </MapChooser>
    {/await}
    <div transition:delayFly class="hstack">
        Map
        <span>{mapData?.map.props.name ?? ''}</span>
        <span>Wins rate: {!mapData || mapData.stats.attempts === 0 ? 'No data' : formatPercent(mapData.stats.wins / mapData.stats.attempts)}</span>
        <span>(win: {mapData?.stats.wins ?? 0}, loss: {mapData?.stats.loses ?? 0}, attempt: {mapData?.stats.attempts ?? 0})</span>
    </div>
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
    <a href="#team={availableTeams.findIndex(t => t.value === playerTeam)}&map={mapData?.map.props.name}"
        class="btn"
        use:audioQueue={'button'}
        transition:delayFly
        class:disabled={mapData === null}
    >Launch</a>
</div>

{#snippet mapTileWithStats(md: MapData)}
    <div class="map-tile" >
        {#if md.map.props.img}
            <img src={md.map.props.img} alt="map: {md.map.props.displayName}" />
        {/if}
        <span>{md.map.props.displayName}</span>
        {#if md.stats.bestTime}
            <div class="hstack win-stats">
                <div class="trophy">🏆</div>
                <div class="best-time">Time: {formatTime(md.stats.bestTime)}</div>
            </div>
        {/if}
    </div>
{/snippet}

<style>
    .map-tile {
        aspect-ratio: 1;
        width: 64px;
        position: relative;
        background: var(--theme-background-3);
        border-radius: var(--theme-border-radius);
    }
    .map-tile .win-stats {
        position: absolute;
        top: .5rem;
        left: .5rem;
        gap: .5rem;
    }
    .map-tile .trophy {
        font-size: 1.5rem;
    }
    .map-tile img {
        position: relative;
        width: 48px;
        top: .5em;
    }
    .map-tile span:first-child {
        display: none;
        position: absolute;
        right: 0.5rem;
        bottom: 0.5rem;
    }

    @media(min-width: 400px) {
        .map-tile span {
            display: inline;
        }
        .map-tile {
            width: 96px;
        }
        .map-tile img {
            width: 64px;
            top: 1em;
        }
    }
    @media(min-width: 860px) {
        .map-tile {
            width: 160px;
        }
        .map-tile img {
            width: 128px;
        }
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