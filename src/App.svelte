<script lang="ts">
    import { writable } from 'svelte/store';
    import { setContext } from 'svelte';
    import MenuPage from './lib/menu/MenuPage.svelte';
    import GameView from './lib/components/GameView.svelte';
    import MenuScreen from './lib/menu/MenuScreen.svelte';
    import LevelEditor from './lib/components/LevelEditor.svelte';
    import RemoteLobbyScreen from './lib/menu/RemoteLobbyScreen.svelte';
    import RemoteGameScreen from './lib/menu/RemoteGameScreen.svelte';
    import StartScreen from './lib/menu/StartScreen.svelte';
    import LocalGameScreen from './lib/menu/LocalGameScreen.svelte';
    import type { Player } from './lib/game';
    import type { Game } from './lib/game';
    import { PlayerSchema } from './lib/net-game';
    import { delayFly } from './lib/menu/transitions';
    import { key, type Context, type MenuScreens } from './context';
    import BackArrow from './lib/menu/BackArrow.svelte';

    let game = writable<Game>(undefined);
    let localPlayer = writable(new PlayerSchema(`Guest-${Math.ceil(Math.random() * 100)}`));
    let menu = writable<MenuScreens>('start');
    let context: Context = {
        menu,
        game,
        localPlayer,
        roomName: writable(''),
    }
    setContext(key, context);

    let player: Player;
    $: if ($game && $localPlayer.team) {
        player = $game.players.find(p => p.team === $localPlayer.team);
    }
</script>

{#if $game}
    <GameView game={$game} {player} let:gfx>
        {#if $menu === 'edit'}
            <LevelEditor game={$game} {gfx} />
        {/if}
    </GameView>
{:else}
    <MenuScreen>
        {#if $menu === 'start'}
            <MenuPage>
                <StartScreen />
            </MenuPage>
        {:else if $menu === 'local'}
            <MenuPage>
                <button transition:delayFly={1} class="back-button" on:click={() => $menu = 'start'}><BackArrow /> Auralux - Clone</button>
                <LocalGameScreen />
            </MenuPage>
        {:else if $menu === 'remote'}
            <MenuPage>
                <button transition:delayFly={1} class="back-button" on:click={() => $menu = 'start'}><BackArrow />Auralux - Clone</button>
                <RemoteGameScreen />
            </MenuPage>
        {:else if $menu === 'lobby'}
            <MenuPage>
                <button transition:delayFly={1} class="back-button" on:click={() => $menu = 'start'}><BackArrow /> Auralux - Clone</button>
                <RemoteLobbyScreen />
            </MenuPage>
        {/if}
    </MenuScreen>
{/if}

<style>
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
