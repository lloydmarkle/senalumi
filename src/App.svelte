<script lang="ts">
  import DebugOptions from "./lib/DebugOptions.svelte";
  import LobbyScreen from "./lib/LobbyScreen.svelte";
  import Scoreboard from "./lib/Scoreboard.svelte";
  import type { Room } from "colyseus.js";
  import { Game } from './lib/game';
  import { convertToRemoteGame, GameSchema, joinRemoteGame, PlayerSchema } from './lib/net-game';
  import { Renderer } from './lib/render';
  import { writable } from "svelte/store";

  const demoGame = new Game();
  demoGame.start(0);
  let demoGfx = new Renderer(demoGame, null);

  let playerName = `Guest-${Math.ceil(Math.random() * 100)}`;
  let players: PlayerSchema[] = [];

  let gameState = writable(new GameSchema(null, ''));
  $: if ($gameState.running && demoGfx) {
    const currentPlayer = players.find(p => p.sessionId);
    const player = game.players.find(p => p.team === currentPlayer.team);
    gfx = new Renderer(game, player);
    demoGfx = null;
  }

  let game: Game;
  let gfx: Renderer;
  let room: Room<GameSchema>;
  (async () => {
    room = await joinRemoteGame(playerName, 'test-room');
    game = new Game();
    convertToRemoteGame(game, room);

    const resetPlayers = () =>
      players = Array.from(room.state.players.entries(), ([key, player]) =>
          (key === room.sessionId)
          // add sessionid so other parts of the ui cam find the local player
          ? player.assign({ ...player, sessionId: 'local' })
          : player);
    room.state.players.onAdd = player => {
      player.onChange = resetPlayers;
      player.onRemove = resetPlayers;
      resetPlayers();
    };
    room.state.onChange = () => gameState.set(room.state);
  })();

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
  {#if showScore}
    <Scoreboard data={game.log} />
  {/if}
  {#if $gameState.gameTimeMS < 0}
    <LobbyScreen {players} {room} gameState={$gameState} />
  {/if}
</main>
