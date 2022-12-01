<script lang="ts">
  import DebugOptions from "./lib/DebugOptions.svelte";
  import MenuScreen from "./lib/MenuScreen.svelte";
  import Scoreboard from "./lib/Scoreboard.svelte";
  import OverlayBackground from "./lib/components/OverlayBackground.svelte";
  import { Game } from './lib/game';
  import { GameSchema, PlayerSchema } from './lib/net-game';
  import { Renderer } from './lib/render';

  const demoGame = new Game();
  demoGame.start(0);
  let demoGfx = new Renderer(demoGame, null);

  let players: PlayerSchema[] = [];

  let game: Game;
  let gfx: Renderer;
  let gameState = new GameSchema(null, '');
  $: if (gameState.running && demoGfx) {
    const currentPlayer = players.find(p => p.sessionId);
    const player = game.players.find(p => p.team === currentPlayer.team);
    gfx = new Renderer(game, player);
    demoGfx = null;
  }

  let showScore = false;
  let showDebugOptions = false;
  function keypress(ev: KeyboardEvent) {
    if (ev.key === '`' || ev.key === '~') {
      showDebugOptions = !showDebugOptions;
    }
    if (ev.key === ' ') {
      showScore = !showScore;
    }
    game.state.running = !(showScore || showDebugOptions);
  }
</script>

<svelte:body on:keypress={keypress} />

<main>
  {#if showDebugOptions}
    <DebugOptions {game} {gfx} />
  {/if}

  {#if gameState.gameTimeMS > 0 && showScore}
    <OverlayBackground>
      <Scoreboard data={game.log} />
    </OverlayBackground>
  {/if}
  {#if gameState.gameTimeMS < 0}
    <OverlayBackground>
      <MenuScreen
        bind:game={game}
        bind:players={players}
        bind:gameState={gameState} />
    </OverlayBackground>
  {/if}
</main>
