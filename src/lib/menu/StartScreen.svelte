<script lang="ts">
    import { Game } from '../game';
    import { appContext } from '../../context';
    import { delayFly } from './transitions';

    let { menu, game } = appContext();
    function chooseEditor() {
        $menu = 'edit';
        $game = new Game();
        $game.start(0);
    }
</script>

<h1 transition:delayFly={1}>Auralux - Clone</h1>
<div class="vstack">
    <button class="large-button" transition:delayFly on:click={() => $menu = 'local'}>Single Player</button>
    <button class="large-button" transition:delayFly on:click={() => $menu = 'remote'}>Multiplayer</button>
    <button class="large-button" transition:delayFly on:click={chooseEditor}>Map Editor</button>
</div>

<style>
.large-button {
    padding: 1rem 4rem;
}
</style>