import * as http from 'http';
import { Room, Client } from 'colyseus';
import { GameConfigSchema, GameSchema, PlayerMoveMessage, PlayerSchema } from './src/lib/net-game';
import { Game, Team } from './src/lib/game';

// enable performance.now() on both app and server
import { performance } from 'perf_hooks';
(global as any).performance = performance;

export class AuraluxRoom extends Room<GameSchema> {
  // When room is initialized
  onCreate(options: any) {
    const game = new Game();
    this.setState(new GameSchema(game, options.label));

    this.onMessage('player:info', (client, msg: PlayerSchema) => {
      const player = this.state.players.get(client.sessionId);
      const found = Array.from(this.state.players.values()).find(e => e.team === msg.team);
      if (found && msg.team && !this.state.config.allowCoop && found.sessionId !== client.sessionId) {
        // fail! someone already chose this color?
        console.error(`invalid color for session: session:${player.sessionId}, color:${msg.team}`);
        return;
      }
      delete msg.admin; // cannot re-assign admin!
      player.assign(msg);
      this.state.players.set(client.sessionId, player);
    });

    this.onMessage('player:move', (client, msg: PlayerMoveMessage) => {
      const playerInfo = this.state.players.get(client.sessionId);
      const player = game.players.find(e => e.team === playerInfo.team);
      const sats = [];
      const ids = new Set(msg.satelliteIds);
      game.forEachEntity(ent => {
        if (ids.has(ent.id)) {
          sats.push(ent);
        }
      });
      game.moveSatellites(player, sats, { x: msg.px, y: msg.py });
    });

    this.onMessage('game:config', (client, msg: GameConfigSchema) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.admin) {
        console.error(`non-admin player: session:${player.sessionId}`);
        return;
      }

      // only set some properties after game start
      if (game.state.running) {
        game.config.gameSpeed = msg.gameSpeed;
        game.config.pulseRate = msg.pulseRate;
        return;
      }

      // set everything
      this.maxClients = msg.maxPlayers;
      this.state.config.assign(msg);
      // TODO: choose map or world layout??
      // if everyone is ready, start the game!
      if (msg.startGame) {
        game.config.gameSpeed = msg.gameSpeed;
        game.config.pulseRate = msg.pulseRate;
        game.config.gameCountDown = msg.warmupSeconds;
        game.start();
      }
    });

    const tickRate = 1000 / 60;
    this.setPatchRate(100);
    this.setSimulationInterval(deltaTime => this.state.update(deltaTime), tickRate);
  }

  // Authorize client based on provided options before WebSocket handshake is complete
  onAuth(client: Client, options: any, request: http.IncomingMessage) {
    if (!options.label) {
      return false;
    }
    return true;
  }

  // When client successfully joins the room
  onJoin(client: Client, options: any, auth: any) {
    const player = new PlayerSchema(options.playerName || 'Guest' + Math.ceil(Math.random() * 100), client.sessionId);
    if (this.state.players.size === 0) {
      player.admin = true;
    }
    player.team = this.findTeam();
    this.state.players.set(client.sessionId, player);
  }

  private findTeam(): Team {
    const options = Array.from(this.state.game.players, p => p.team);
    const usedTeams = Array.from(this.state.players.values(), p => p.team);
    for (const option of options) {
      if (usedTeams.indexOf(option) !== -1) {
        return option;
      }
    }
    // choose a random team
    return options[Math.floor(Math.random() * options.length)];
  }

  // When a client leaves the room
  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    // TODO: reset admin
  }

  // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
  onDispose() {
  }
}
