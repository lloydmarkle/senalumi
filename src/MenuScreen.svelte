<script lang="ts">
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import StartScreen from "./lib/menu/StartScreen.svelte";
    import LocalGameScreen from "./lib/menu/LocalGameScreen.svelte";
    import RemoteGameScreen from "./lib/menu/RemoteGameScreen.svelte";
    import RemoteLobbyScreen from "./lib/menu/RemoteLobbyScreen.svelte";
    import BackArrow from "./lib/menu/BackArrow.svelte";
    import { delayFly } from "./lib/menu/transitions";
    import { Game } from "./lib/game";
    import { appContext } from "./context";
    import { fly } from 'svelte/transition';

    const myFly = (el: Element) => fly(el, { y: -40, duration: 400 });

    const { menu, room } = appContext();
    function goHome() {
        if ($room) {
            $room.leave();
            $room = null;
        }
        $menu = 'start';
    }

    function leaveRoom() {
        $room.leave();
        $room = null;
        $menu = 'remote';
    }

    const demoGame = new Game();
    demoGame.start(0);
</script>

<!-- <GameView
    game={demoGame}
    initialZoom={{ scale: .4, time: 5000, ease: 'easeInOutQuad' }}/> -->
<OverlayBackground blurBackground>
    <div class="menu">
        {#if $menu === 'start'}
            <div transition:myFly class="menu-page">
                <StartScreen />
            </div>
        {:else if $menu === 'local'}
            <div transition:myFly class="menu-page">
                <button transition:delayFly={1} class="back-button" on:click={goHome}><BackArrow /> Auralux - Clone</button>
                <LocalGameScreen />
            </div>
        {:else if $menu === 'remote'}
            <div transition:myFly class="menu-page">
                <button transition:delayFly={1} class="back-button" on:click={goHome}><BackArrow />Auralux - Clone</button>
                <RemoteGameScreen />
            </div>
        {:else if $menu === 'lobby'}
            <div transition:myFly class="menu-page">
                <div class="hstack">
                    <button transition:delayFly={1} class="back-button" on:click={goHome}><BackArrow /> Auralux - Clone</button>
                    <button transition:delayFly class="back-button" on:click={leaveRoom}><BackArrow />Multiplayer</button>
                </div>
                <RemoteLobbyScreen />
            </div>
        {/if}
    </div>
</OverlayBackground>

<style>
    .menu {
        display: grid;
        align-items: center;
        min-height: 40vh;
        min-width: 40vw;
    }

    .menu-page {
        background: var(--theme-background-3);
        padding: 1em 4em 4em;
        align-self: center;
        justify-self: center;
        grid-row: 1;
        grid-column: 1;

        display: flex;
        position:relative;
        flex-direction: column;
        align-items: stretch;
        border-radius: var(--theme-border-radius);

        box-shadow: 0em 3em 3em -1em var(--theme-background-2);
    }

    button {
        text-align: start;
        padding: 1em 2em;
    }
    .back-button {
        display: block;
        padding: 0.5em 0em;
        border: none;
        background: none;
    }
</style>
