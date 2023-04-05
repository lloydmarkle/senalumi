<script lang="ts">
    import { setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import LevelEditorScreen from './LevelEditorScreen.svelte';
    import { Context, key, type MenuScreens } from './context';

    let context = new Context();
    setContext(key, context);
    const { game, menu, prefs, audio, room, localPlayer } = context;

    import { Game, Planet } from './lib/game';
    import { point } from './lib/math';
    import ExpandingMenu from './lib/components/ExpandingMenu.svelte';
    import VolumeControl from './lib/components/VolumeControl.svelte';
    import Toggle from './lib/components/Toggle.svelte';
    import ConfirmButton from './lib/components/ConfirmButton.svelte';
    import { joinRemoteGame, rejoinRoom } from './lib/net-game';
    let p2Game = g => {
        g.planets = [
            new Planet(g, point(-200, 0), 3),
            new Planet(g, point(200, 0), 3),
        ];
        g.planets[0].capture(g.players[0])
        g.planets[1].capture(g.players[1])
        for (let i = 0; i < 2000; i++) {
            g.spawnSatellite(g.planets[0]);
            g.spawnSatellite(g.planets[1]);
        }
    }
    // $game = new Game();
    // $game = new Game(p2Game);
    // $localPlayer.team = $game.players[0].team;
    // $game.start(5);

    function quitGame() {
        $room?.leave();
        $room = null;
        $game = null;
        $menu = 'start';
    }

    function initializeAudio() {
        audio.resume();
        audio.volume($prefs.soundVolume);
    }

    $: hasGame = !!$game || $menu === 'edit';

    async function initializeFromUrl(pathname: string) {
        async function joinRemote(pathname: string): Promise<MenuScreens> {
            const remote = $prefs.remoteGame;
            if (remote) {
                try {
                    $room = await rejoinRoom(remote.roomId, remote.sessionId);
                    return 'lobby';
                } catch (e) {
                    console.log('reconnect failed',e)
                    delete $prefs.remoteGame
                }
            }

            const roomName = pathname.split('/')[2];
            if (roomName) {
                $room = await joinRemoteGame($localPlayer.displayName, roomName);
                return 'lobby';
            }

            return 'remote';
        }

        $menu =
            (pathname.startsWith('/mp/') || pathname.startsWith('/multi-player') || $prefs.remoteGame) ? await joinRemote(pathname) :
            (pathname === '/single-player' || pathname === '/sp') ? 'local' :
            'start'
    }
    initializeFromUrl(location.pathname.trim());

    menu.subscribe(m => {
        const url =
            (m === 'local') ? '/single-player' :
            (m === 'remote') ? '/multi-player' :
            (m === 'lobby') ? `/mp/${$room.state.label}` :
            '/'
        history.pushState(null, null, url);
    });
</script>

<svelte:window on:click|once|capture={initializeAudio} />

{#if $menu === 'edit'}
    <LevelEditorScreen />
{:else if $game}
    <GameScreen />
{:else}
    <MenuScreen />
{/if}

<div class="prefs-menu">
    <ExpandingMenu isOpen={!hasGame} closeable={hasGame}>
        <VolumeControl bind:volume={$prefs.soundVolume} />
        {#if !hasGame}
            <Toggle id={"background-demo"} bind:state={$prefs.showDemoGame}>Demo game</Toggle>
        {/if}
        {#if hasGame}
            <ConfirmButton
                text={'Quit'}
                confirmText={'Really leave?'}
                actionFn={quitGame}
            />
        {/if}
    </ExpandingMenu>
</div>

<style>
    .prefs-menu {
        position: fixed;
        top: 1em;
        left: 1em;
        opacity: 0.3;
        background: var(--theme-background);
        border-radius: var(--theme-border-radius);
        transition: opacity 0.3s;
    }
    .prefs-menu:hover {
        opacity: .8
    }
</style>