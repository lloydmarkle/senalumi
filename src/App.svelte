<script lang="ts">
  import DebugInfo from "./lib/DebugInfo.svelte";
  import { Game } from './lib/game';
  import { run } from './lib/render';

  const game = new Game();
  run(game);
</script>

<main>
  <!-- <DebugInfo {game} /> -->
</main>

<style>

</style>