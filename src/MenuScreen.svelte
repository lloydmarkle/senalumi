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

    const myFly = (el: Element) => fly(el, { y: -40, duration: 400, delay: 0 });

    const { menu, room } = appContext();
    function goHome() {
        if ($room) {
            $room.leave();
            $room = null;
        }
        $menu = 'start';
    }

    const demoGame = new Game();
    demoGame.start(0);
</script>

<!-- <GameView game={demoGame} /> -->
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
                <button transition:delayFly={1} class="back-button" on:click={goHome}><BackArrow /> Auralux - Clone</button>
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
        background: black;
        padding: 1rem 4rem 4rem;
        align-self: center;
        justify-self: center;
        grid-row: 1;
        grid-column: 1;
    }

    button {
        padding: 1rem 2rem;
    }
    .back-button {
        display: block;
        padding: 0.5rem 2rem 0.5rem 0rem;
        font-size: 2rem;
        border: none;
        background: none;
    }
</style>
