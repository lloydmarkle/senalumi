import * as http from 'http';
import { Room, Client } from 'colyseus';
import { GameSchema, PlayerMoveMessage, PlayerSchema } from './src/lib/net-game';

// enable performance.now() on both app and server
import { performance } from 'perf_hooks';
(global as any).performance = performance;

export class AuraluxRoom extends Room<GameSchema> {
  // When room is initialized
  onCreate(options: any) {
    this.setState(new GameSchema());

    this.onMessage('player:info', (client, msg: PlayerSchema) => {
      const player = this.state.players.get(client.sessionId);
      const found = Array.from(this.state.players.values()).find(e => e.color === msg.color);
      if (found && found.sessionId !== client.sessionId) {
        // fail! someone already chose this color?
        console.error(`invalid color for session: session:${player.sessionId}, color:${msg.color}`);
        return;
      }
      player.displayName = msg.displayName;
      player.color = msg.color;
      this.state.players.set(client.sessionId, player);
    });

    this.onMessage('player:move', (client, msg: PlayerMoveMessage) => {
      const playerInfo = this.state.players.get(client.sessionId);
      const player = this.state.game.players.find(e => e.id === playerInfo.color);
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
    this.state.players.set(client.sessionId, new PlayerSchema('_blank', client.sessionId));
  }

  // When a client leaves the room
  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
  }

  // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
  onDispose() {
  }
}
