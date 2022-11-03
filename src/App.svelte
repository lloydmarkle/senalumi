<script lang="ts">
  import DebugInfo from "./lib/DebugInfo.svelte";
  import { Game } from './lib/game';
  import { Renderer } from './lib/render';
  import Scoreboard from "./lib/Scoreboard.svelte";

  const game = new Game();
  (window as any)._game = game;
  (window as any)._gfx = new Renderer(game);

  let showScore = false;
  let showDebug = false;
  function keypress(ev: KeyboardEvent) {
    if (ev.key === '`' || ev.key === '~') {
      showDebug = !showDebug;
    }
    if (ev.key === ' ') {
      showScore = !showScore;
    }
    game.paused = showScore || showDebug;
  }
</script>

<svelte:body on:keypress={keypress} />

<main>
  {#if showDebug}
    <DebugInfo />
  {/if}
  {#if showScore}
    <Scoreboard data={game.log} />
  {/if}
</main>

<style>

</style>