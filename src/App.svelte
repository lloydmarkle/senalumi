<script lang="ts">
    import { setContext } from 'svelte';
    import MenuScreen from './MenuScreen.svelte';
    import GameScreen from './GameScreen.svelte';
    import { Context, key } from './context';

    let context = new Context();
    setContext(key, context);

    const { game } = context;

    import { Game, Planet } from './lib/game';
    import { point } from './lib/math';
    const { localPlayer } = context;
    let p2Game = g => {
        $localPlayer.team = g.players[0].team;
        g.planets = [
            new Planet(g, point(-200, 0), 3),
            new Planet(g, point(200, 0), 3),
        ];
        g.planets[0].capture(g.players[0])
        g.planets[1].capture(g.players[1])
        for (let i = 0; i < 1000; i++) {
            g.spawnSatellite(g.planets[0]);
            g.spawnSatellite(g.planets[1]);
        }
    }
    $game = new Game();
    $game.start(0);
</script>

{#if $game}
    <GameScreen />
{:else}
    <MenuScreen />
{/if}
