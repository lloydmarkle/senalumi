import * as http from 'http';
import { Room, Client } from 'colyseus';
import { GameConfigSchema, GameSchema, PlayerMoveMessage, PlayerSchema } from './src/lib/net-game';
import { Game, GameMap, initializerFromMap, Team } from './src/lib/game';

// enable performance.now() on both app and server
import { performance } from 'perf_hooks';
import { availableTeamsFromMap, playerTeams } from './src/lib/data';
(global as any).performance = performance;

const seconds = 1000;
const rejoinTimeLimit = 30 * seconds;

export class AuraluxRoom extends Room<GameSchema> {
    private game: Game;
    // When room is initialized
    onCreate(options: any) {
        this.game = new Game();
        this.setState(new GameSchema(options.label));
        this.setMetadata({ label: options.label, state: 'Waiting' });

        // track client ping times
        let pingTime: Date;
        this.clock.setInterval(() => {
            pingTime = new Date();
            this.broadcast('ping');
        }, 3000);
        this.onMessage('pong', client => {
            const elapsed = new Date().getTime() - pingTime.getTime();
            const player = this.state.players.get(client.sessionId);
            player.ping = elapsed;
        })

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
            console.log('player', JSON.stringify(player.toJSON()))
            this.state.players.set(client.sessionId, player);
        });

        this.onMessage('player:move', (client, msg: PlayerMoveMessage) => {
            const playerInfo = this.state.players.get(client.sessionId);
            const player = this.game.players.find(e => e.team === playerInfo.team);
            const sats = [];
            const ids = new Set(msg.satelliteIds);
            this.game.forEachEntity(ent => {
                if (ids.has(ent.id)) {
                    sats.push(ent);
                }
            });
            this.game.moveSatellites(player, sats, { x: msg.px, y: msg.py });
        });

        this.onMessage('game:config', (client, msg: GameConfigSchema) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.admin) {
                console.error(`non-admin player: session:${player.sessionId}`);
                return;
            }

            // only set some properties after game start
            if (this.game.state.running) {
                this.game.config.gameSpeed = msg.gameSpeed;
                this.game.config.pulseRate = msg.pulseRate;
                return;
            }

            // set everything
            this.maxClients = msg.maxPlayers;
            this.state.config.assign(msg);

            const map: GameMap = JSON.parse(msg.gameMap);
            this.game = new Game(initializerFromMap(map));
            // set available colors based on map
            this.state.config.colours = [
                playerTeams[0].value,
                ...availableTeamsFromMap(map).map(e => e.value),
            ];
            // re-assign players who now have an invalid colour
            this.state.players.forEach(player => {
                if (this.state.config.colours.indexOf(player.team) === -1) {
                    player.team = this.findTeam();
                }
            });

            // if everyone is ready, start the game!
            if (msg.startGame) {
                this.disableAiPlayers();
                this.game.config.gameSpeed = msg.gameSpeed;
                this.game.config.pulseRate = msg.pulseRate;
                this.game.config.gameCountDown = msg.warmupSeconds;
                this.game.start();
                this.metadata.state = 'Started';
            }
        });

        const tickRate = 1000 / 60;
        this.setPatchRate(100);
        this.setSimulationInterval(deltaTime => this.state.update(this.game, deltaTime), tickRate);
    }

    private disableAiPlayers() {
        const usedTeams = new Set(Array.from(this.state.players.values()).map(p => p.team));
        for (const player of this.game.players) {
            if (usedTeams.has(player.team)) {
                player.ai.enabled = false;
            }
        }
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
        this.state.players.set(client.sessionId, player);
        if (!this.state.running) {
            // not started so assign player to a team
            player.team = this.findTeam();
        }
    }

    private findTeam(): Team {
        const options = this.state.config.colours.slice(1) as Team[];
        const usedTeams = Array.from(this.state.players.values(), p => p.team);
        for (const option of options) {
            if (usedTeams.indexOf(option) === -1) {
                return option;
            }
        }
        // choose a random team
        return options[Math.floor(Math.random() * options.length)];
    }

    // When a client leaves the room
    async onLeave(client: Client, consented: boolean) {
        const team = this.state.players.get(client.sessionId).team;
        this.state.players.delete(client.sessionId);

        // if (!consented) {
        //   // give player time to reconnect
        //   await this.allowReconnection(client, 30);
        // }

        // reset admin
        if (this.state.players.size) {
            this.state.players.values().next().value.admin = true;
        }
        // reactivate AI if noplayer does not re-join
        const reactivateAi = () => {
            let teams = [];
            this.state.players.forEach(e => teams.push(e.team))
            if (!teams.includes(team)) {
                console.log('re-enabling ai', team);
                const player = this.game.players.find(e => e.team === team)
                if (player) {
                    player.ai.enabled = true;
                }
            }
        }
        this.clock.setTimeout(reactivateAi, rejoinTimeLimit);
    }

    // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    onDispose() {
    }
}
