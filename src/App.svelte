<script lang="ts">
    import { setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import LevelEditorScreen from './LevelEditorScreen.svelte';
    import { Context, gameTitle, key } from './context';

    const context = new Context();
    setContext(key, context);
    const { game, url, prefs, audio, room } = context;

    import ExpandingMenu from './lib/components/ExpandingMenu.svelte';
    import VolumeControl from './lib/components/VolumeControl.svelte';
    import Toggle from './lib/components/Toggle.svelte';
    import ConfirmButton from './lib/components/ConfirmButton.svelte';

    function quitGame() {
        $room = null;
        $game = null;
        $url = '/';
    }

    function initializeAudio() {
        audio.resume();
        audio.volume($prefs.soundVolume);
    }

    let screenWidth: number;
    $: hasGame = !!$game || $url === '/editor';
    $: menuOpen = !hasGame && screenWidth > 400
</script>

<svelte:head>
    <title>{gameTitle}</title>
</svelte:head>
<svelte:window
    bind:innerWidth={screenWidth}
    on:click|once|capture={initializeAudio} />

{#if $url === '/editor'}
    <LevelEditorScreen />
{:else if $game}
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