<script lang="ts">
    import OverlayBackground from "../components/OverlayBackground.svelte";
    import GameView from "../components/GameView.svelte";
    import { Game } from "../game";

    const demoGame = new Game();
    demoGame.start(0);
</script>

<GameView game={demoGame} />
<OverlayBackground blurBackground>
    <div class="menu">
        <slot/>
    </div>
</OverlayBackground>

<style>
    .menu {
        display: grid;
        align-items: center;
        min-height: 40vh;
        min-width: 40vw;
    }
</style>