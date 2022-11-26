import * as http from 'http';
import { Room, Client } from 'colyseus';
import { GameSchema, PlayerMoveMessage, PlayerSchema } from './src/lib/net-game';
import { Game } from './src/lib/game';

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
      if (found && msg.team && found.sessionId !== client.sessionId) {
        // fail! someone already chose this color?
        console.error(`invalid color for session: session:${player.sessionId}, color:${msg.team}`);
        return;
      }
      player.displayName = msg.displayName;
      player.ready = msg.ready;
      player.team = msg.team;
      this.state.players.set(client.sessionId, player);

      if (Array.from(this.state.players.values()).every(p => p.ready)) {
        this.state.game.start();
      }
    });

    this.onMessage('player:move', (client, msg: PlayerMoveMessage) => {
      const playerInfo = this.state.players.get(client.sessionId);
      const player = this.state.game.players.find(e => e.team === playerInfo.team);
      const sats = [];
      const ids = new Set(msg.satelliteIds);
      this.state.game.forEachEntity(ent => {
        if (ids.has(ent.id)) {
          sats.push(ent);
        }
      });
      this.state.game.moveSatellites(player, sats, { x: msg.px, y: msg.py });
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
    const player = new PlayerSchema('_blank', client.sessionId);
    if (this.state.players.size === 0) {
      player.admin = true;
    }
    this.state.players.set(client.sessionId, player);
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
