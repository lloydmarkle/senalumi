<script lang="ts">
    import { setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import { Context, key } from './context';

    let context = new Context();
    setContext(key, context);

    const { game } = context;
</script>

{#if $game}
    <GameScreen />
{:else}
    <MenuScreen />
{/if}
