<script lang="ts">
    import { onMount, setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import LevelEditorScreen from './LevelEditorScreen.svelte';
    import { Context, gameTitle, key } from './context';

    const context = new Context();
    setContext(key, context);
    const { game, urlParams, prefs, audio, localPlayer } = context;

    import ExpandingMenu from './lib/components/ExpandingMenu.svelte';
    import VolumeControl from './lib/components/VolumeControl.svelte';
    import Toggle from './lib/components/Toggle.svelte';
    import ConfirmButton from './lib/components/ConfirmButton.svelte';
    import { Game, Player, type Team } from './lib/game';
    import { availableTeamsFromMap, playerTeams, prioritizedTeams } from './lib/data';
    import { DataStore } from './stored-data';

    function quitGame() {
        history.pushState(null, null, '#');
        parseUrlParams();
    }

    function initializeAudio() {
        audio.resume();
        audio.volume($prefs.soundVolume);
    }

    async function loadMap(mapName: string) {
        // such a hack to customize the colour overrides... there has got to be a simpler way
        const gameMaps = await DataStore.load().then(d => d.loadMaps());
        const map = { ...gameMaps.map(e => e.map).find(m => m.props.name === mapName) };
        let teams: Team[] = [];
        if (map.setup) {
            map.setup = { ...map.setup };
            const teamsFromMap = availableTeamsFromMap(map);
            const priorityTeams = $prefs.preferredTeams.map(e => playerTeams.find(p => p.value === e));
            teams = prioritizedTeams(teamsFromMap, priorityTeams).map(e => e.value) as Team[];
            map.setup.teams = teams;
        } else {
            map.planets = map.planets.map(p => ({ ...p }));
            const teamsFromMap = availableTeamsFromMap(map);
            const priorityTeams = $prefs.preferredTeams.map(e => playerTeams.find(p => p.value === e));
            teams = prioritizedTeams(teamsFromMap, priorityTeams).map(e => e.value) as Team[];
            map.planets.map(p => {
                if (p.ownerTeam) {
                    p.ownerTeam =  teams[teamsFromMap.findIndex(v => v.value === p.ownerTeam)]
                }
                return p;
            });
        }
        return { map, teams };
    }

    let player: Player;
    $: if ($game) player = $game.players.find(p => p.team === $localPlayer.team)
    function parseUrlParams() {
        try {
            $urlParams = new URLSearchParams(window.location.hash.substring(1));

            if ($urlParams.has('team') && $urlParams.has('map')) {
                loadMap($urlParams.get('map')).then(({ map, teams }) => {
                    $game = new Game(map);
                    const playerTeam = teams[parseInt($urlParams.get('team')) - 1];
                    player = $game.players.find(p => p.team === playerTeam);
                    if (player) {
                        player.ai.enabled = false;
                    }

                    $game.start();
                });
            } else if (!$urlParams.has('lobby')) {
                $game = null;
            }
        } catch {
            // TODO: what to do with errors?
        }
    }
    onMount(parseUrlParams);

    let screenWidth: number;
    $: screen = $game ? 'game' : $urlParams.get('menu');
    $: hasGame = !!$game || screen === 'editor';
    $: menuOpen = !hasGame && screenWidth > 400
</script>

<svelte:head>
    <title>{gameTitle}</title>
</svelte:head>
<svelte:window
    bind:innerWidth={screenWidth}
    on:popstate={parseUrlParams}
    on:click|once|capture={initializeAudio} />

{#if screen === 'editor'}
    <LevelEditorScreen />
{:else if screen === 'game'}
    <GameScreen game={$game} {player} />
{:else}
    <MenuScreen />
{/if}

<div class="prefs-menu">
    <ExpandingMenu isOpen={menuOpen} closeable={!menuOpen}>
        <div class="prefs-contents">
            <VolumeControl bind:volume={$prefs.soundVolume} />
            {#if !hasGame}
                <Toggle id={"background-demo"} bind:state={$prefs.showDemoGame}>Demo</Toggle>
            {/if}
            {#if hasGame}
                <ConfirmButton
                    text={'Quit'}
                    confirmText={'Really leave?'}
                    actionFn={quitGame}
                />
            {/if}
        </div>
    </ExpandingMenu>
</div>

<style>
    .prefs-menu {
        position: fixed;
        top: 1em;
        left: 1em;
        opacity: var(--theme-hover-opacity-off);
        background: var(--theme-background);
        border-radius: var(--theme-border-radius);
        transition: opacity 0.3s;
    }
    .prefs-menu:hover {
        opacity: var(--theme-hover-opacity-on);
    }

    .prefs-contents {
        display: flex;
        flex-direction: column;
        align-items: start;
        gap: 1em;
    }
    @media(min-width: 400px) {
        .prefs-contents {
            flex-direction: row;
        }
    }
</style>