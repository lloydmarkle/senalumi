<script lang="ts">
    import { onMount, setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import LevelEditorScreen from './LevelEditorScreen.svelte';
    import { Context, gameTitle, key } from './context';

    const context = new Context();
    setContext(key, context);
    const { game, urlParams, prefs, audio, room, localPlayer } = context;

    import ExpandingMenu from './lib/components/ExpandingMenu.svelte';
    import VolumeControl from './lib/components/VolumeControl.svelte';
    import Toggle from './lib/components/Toggle.svelte';
    import ConfirmButton from './lib/components/ConfirmButton.svelte';
    import { Game, type Team } from './lib/game';
    import { gameMaps } from './lib/data';

    function quitGame() {
        history.pushState(null, null, '#');
        parseUrlParams();
    }

    function initializeAudio() {
        audio.resume();
        audio.volume($prefs.soundVolume);
    }

    function parseUrlParams() {
        try {
            $urlParams = new URLSearchParams(window.location.hash.substring(1));

            if ($urlParams.has('team') && $urlParams.has('map')) {
                const map = gameMaps.find(m => m.props.name === $urlParams.get('map'));
                $game = new Game(map);
                $localPlayer.team = $urlParams.get('team') as Team;
                const player = $game.players.find(p => p.team === $localPlayer.team);
                if (player) {
                    player.ai.enabled = false;
                }
                $game.start();
            } else if (!$urlParams.has('lobby')) {
                $game = null;
                $room = null;
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
    <GameScreen />
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