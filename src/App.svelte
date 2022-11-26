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

  let playerInfo = new PlayerSchema(`my-name-${Math.random().toFixed(2)}`, 'local');
  let players: PlayerSchema[] = [];
  $: ready = players.length && players.every(p => p.ready);
  $: if (ready && demoGfx) {
    const player = game.players.find(p => p.team === playerInfo.team);
    gfx = new Renderer(game, player);
    demoGfx = null;
  }

  let gameState = writable(new GameSchema(null, ''));

  let game: Game;
  let gfx: Renderer;
  let room: Room<GameSchema>;
  (async () => {
    room = await joinRemoteGame(playerInfo, 'test-room');
    game = new Game();
    convertToRemoteGame(game, room);

    const resetPlayers = () =>
      players = Array.from(room.state.players.entries(), ([key, player]) =>
          (key === room.sessionId)
          // create a copy of the local player to synchronize client state properly
          ? (playerInfo = new PlayerSchema(player.displayName, 'local', player.ready, player.admin, player.team))
          : player);
    resetPlayers();
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
