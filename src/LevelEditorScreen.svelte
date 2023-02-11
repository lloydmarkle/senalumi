<script lang="ts">
    import GameView from "./lib/components/GameView.svelte";
    import LevelEditor from "./lib/components/LevelEditor.svelte";
    import { Game, type GameMap } from "./lib/game";

    // some defaults
    let game = new Game();
    let mapProps: GameMap['props'] = {
        name: 'Map name',
        img: '',
    };
</script>

{#if game}
<GameView {game} let:gfx>
    <LevelEditor {gfx}
        bind:mapProps={mapProps}
        bind:game={game} />
</GameView>
{/if}