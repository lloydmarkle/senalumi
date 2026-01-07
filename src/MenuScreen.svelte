<script lang="ts">
    import OverlayBackground from "./lib/components/OverlayBackground.svelte";
    import GameView from "./lib/components/GameView.svelte";
    import LocalGameScreen from "./lib/menu/LocalGameScreen.svelte";
    import RemoteGameScreen from "./lib/menu/RemoteGameScreen.svelte";
    import RemoteLobbyScreen from "./lib/menu/RemoteLobbyScreen.svelte";
    import BackArrow from "./lib/menu/BackArrow.svelte";
    import { delayFly } from "./lib/menu/transitions";
    import { Game } from "./lib/game";
    import { gameTitle, appContext } from "./context";
    import { fly } from 'svelte/transition';
    import { audioQueue } from "./lib/components/audio-effect";
    import { Sound } from "./lib/sound";
    import type { Renderer } from "./lib/render";
    import { DataStore } from "./stored-data";

    const myFly = (el: Element) => fly(el, { y: -40, duration: 400 });

    const { urlParams, room, prefs } = appContext();
    $: menu = $urlParams.get('menu');
    $: if (!$urlParams.has('lobby')) $room = null;

    class NullSound extends Sound {
        // do nothing!
        override resume(): void {}
    }
    const noSound = new NullSound();

    let gfx: Renderer;
    function visChange() {
        if (gfx) {
            gfx.paused = document.hidden;
        }
    }

    const createDemoGame = () =>
        DataStore.load()
            .then(data => data.loadMaps())
            .then(maps => new Game(maps[0].map).start());
    $: demoGame = $prefs.showDemoGame ? createDemoGame() : new Promise<Game>(resolve => {});
</script>

<svelte:window on:visibilitychange={visChange} />

{#await demoGame then game}
    <GameView
        disableKeyboardInput
        bind:gfx={gfx}
        {game}
        audio={noSound}
        initialZoom={{ scale: .4, time: 5000, ease: 'easeInOutQuad' }}/>
{/await}

<OverlayBackground blurBackground>
    <div class="menu">
        {#if menu === 'sp' || menu === 'single-player'}
            <div transition:myFly class="menu-page">
                <a transition:delayFly={1} class="back-button" href={"#"} use:audioQueue={'backNavigation'}><BackArrow />{gameTitle}</a>
                <LocalGameScreen />
            </div>
        {:else if !$urlParams.has('lobby') && (menu === 'mp' || menu === 'multi-player')}
            <div transition:myFly class="menu-page">
                <a transition:delayFly={1} class="back-button" href={"#"} use:audioQueue={'backNavigation'}><BackArrow />{gameTitle}</a>
                <RemoteGameScreen />
            </div>
        {:else if $urlParams.has('lobby')}
            <div transition:myFly class="menu-page">
                <div class="hstack">
                    <a transition:delayFly={1} class="back-button" href={"#"} use:audioQueue={'backNavigation'}><BackArrow />{gameTitle}</a>
                    <a transition:delayFly={1} class="back-button" href={"#menu=mp"} use:audioQueue={'backNavigation'}><BackArrow />Multiplayer</a>
                </div>
                <RemoteLobbyScreen />
            </div>
        {:else}
            <div transition:myFly class="menu-page">
                <h1 transition:delayFly={1} class="hstack">
                    <img width={64} height={64} src="./favicon.png" alt="{gameTitle} logo - a coloured moon" />
                    {gameTitle}
                </h1>
                <div class="vstack">
                    <a class="btn large-button" href="#menu=sp" transition:delayFly use:audioQueue={'forwardNavigation'}>Play</a>

                    <!--
                    Disabled until we can sort out the upgrade to colyseus 16 (to fix security issues in 14) and find a place to host
                    <a class="btn large-button" href="#menu=mp" transition:delayFly use:audioQueue={'forwardNavigation'}>Multiplayer</a>
                    -->

                    <!--
                    disable for now until we can actually get a decent user experience
                    <a class="btn large-button" href="#menu=editor" transition:delayFly use:audioQueue={'forwardNavigation'}>Map Editor</a>
                    -->
                </div>
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

    h1 {
        padding: 0rem 2rem;
        gap: .5rem;
    }
    h1 img {
        animation: spin 45s linear infinite,
            color-rotate 12s linear infinite reverse;
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes color-rotate {
        from { filter: hue-rotate(0deg) saturate(120%); }
        to { filter: hue-rotate(360deg) saturate(120%); }
    }

    .menu-page {
        background: var(--theme-background-3);
        padding: 1em 1em 1em;
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

    .back-button {
        display: flex;
        align-items: center;

        color: var(--theme-foreground);
        padding: 0.5em 0em;
        border: none;
        background: none;
    }
    .back-button:hover {
        color: var(--theme-link-hover);
    }

    @media(min-width: 400px) {
        .menu-page {
            padding: .5em 2em 2em;
        }
    }
    @media(min-width: 860px) {
        .menu-page {
            padding: 1em 4em 4em;
        }
    }

    .large-button {
        padding: 1em 4em;
    }
</style>
