<script lang="ts">
    import { appContext } from '../../context';
    import { audioQueue } from '../components/audio-effect';
    import { delayFly } from './transitions';

    let { menu } = appContext();
</script>

<h1 transition:delayFly={1}>Auralux - Clone</h1>
<div class="vstack">
    <button class="large-button" transition:delayFly use:audioQueue={'forwardNavigation'} on:click={() => $menu = 'local'}>Single Player</button>
    <button class="large-button" transition:delayFly use:audioQueue={'forwardNavigation'} on:click={() => $menu = 'remote'}>Multiplayer</button>
    <button class="large-button" transition:delayFly use:audioQueue={'forwardNavigation'} on:click={() => $menu = 'edit'}>Map Editor</button>
</div>

<style>
.large-button {
    padding: 1em 4em;
}
</style>