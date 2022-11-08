<script lang="ts">
  import DebugOptions from "./lib/DebugOptions.svelte";
  import { Game } from './lib/game';
  import { Renderer } from './lib/render';
  import Scoreboard from "./lib/Scoreboard.svelte";

  const game = new Game();
  const gfx = new Renderer(game);

  let showScore = false;
  let showDebugOptions = false;
  function keypress(ev: KeyboardEvent) {
    if (ev.key === '`' || ev.key === '~') {
      showDebugOptions = !showDebugOptions;
    }
    if (ev.key === ' ') {
      showScore = !showScore;
    }
    game.paused = showScore || showDebugOptions;
  }
</script>

<svelte:body on:keypress={keypress} />

<main>
  {#if showDebugOptions}
    <DebugOptions {game} {gfx} />
  {/if}
  {#if showScore}
    <Scoreboard data={game.log} />
  {/if}
</main>

<style>

</style>