<script lang="ts">
  import DebugInfo from "./lib/DebugInfo.svelte";
  import { Game } from './lib/game';
  import { Renderer } from './lib/render';

  const game = new Game();
  (window as any)._game = game;
  (window as any)._gfx = new Renderer(game);

  let showDebug = false;
  function keypress(ev: KeyboardEvent) {
    if (ev.key === '`' || ev.key === '~') {
      showDebug = !showDebug;
      game.paused = showDebug;
    }
  }
</script>

<svelte:body on:keypress={keypress} />

<main>
  {#if showDebug}
    <DebugInfo />
  {/if}
</main>

<style>

</style>