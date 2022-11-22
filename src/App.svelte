<script lang="ts">
  import DebugOptions from "./lib/DebugOptions.svelte";
  import { Game } from './lib/game';
  import { convertToRemoteGame, PlayerSchema } from './lib/net-game';
  import { Renderer } from './lib/render';
  import Scoreboard from "./lib/Scoreboard.svelte";

  const playerInfo = new PlayerSchema(`my-name-${Math.random().toFixed(2)}`);
  playerInfo.color = 'red';

  const game = new Game();
  convertToRemoteGame(game, playerInfo);
  const gfx = new Renderer(game, game.players.find(e => e.id === playerInfo.color));

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