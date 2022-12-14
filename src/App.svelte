<script lang="ts">
  import MenuScreen from "./lib/MenuScreen.svelte";
  import GameView from "./lib/GameView.svelte";
  import type { Game, Player } from './lib/game';
  import type { PlayerSchema } from './lib/net-game';

  let players: PlayerSchema[] = [];
  let player: Player;
  let game: Game;
  $: localPlayer = players.find(p => p.sessionId);
  $: if (game && localPlayer) {
    player = game.players.find(p => p.team === localPlayer.team);
  }
</script>

{#if game}
  <GameView {game} {player}
    on:resetGame={ev => game = ev.detail} />
{:else}
  <MenuScreen
    bind:game={game}
    bind:players={players} />
{/if}
