import { Schema, MapSchema, defineTypes, ArraySchema, type DataChange } from '@colyseus/schema';
import { Game, constants, Planet, Satellite, Player, type GameEvent, type GameStateSnapshot, type Team } from './game';
import { gameMaps, playerTeams } from './data';

// something weird going on with vite, decorators, and colyseus.
// Not really sure what but using defineTypes() instead of decorators works
// https://github.com/colyseus/colyseus/issues/510
export class PlayerSchema extends Schema {
    constructor(
        public displayName: string,
        public team: Team = '' as any,
        // these don't need to be in the constructor but it's shorter than writing
        // a separate interface and initializing them in the constructor
        public sessionId: string = '',
        public ready = false,
        public admin = false,
        public connected = true,
        public ping = 0,
    ) { super() }
}
defineTypes(PlayerSchema, {
    displayName: 'string',
    team: 'string',
    connected: 'boolean',
    admin: 'boolean',
    ready: 'boolean',
    ping: 'number',
});

export class PlanetSchema extends Schema {
    synchronizeFromEntity(ent: Planet) {
        this.owner = ent.owner?.team;
        this.level = ent.level;
        this.maxLevel = ent.maxLevel;
        this.health = ent.health
        this.upgrade = ent.upgrade
        this.candidateOwner = ent.candidateOwner?.team
        this.px = ent.position.x;
        this.py = ent.position.y;
    }

    static synchronizeTo(planet: Planet, game: Game, changes: DataChange<any>[]) {
        changes.forEach(c => {
            if (c.field === 'px') {
                planet.position.x = c.value;
            } else if (c.field === 'py') {
                planet.position.y = c.value;
            } else if (c.field === 'level') {
                planet.level = c.value;
            } else if (c.field === 'maxLevel') {
                (planet as any).maxLevel = c.value;
            } else if (c.field === 'health') {
                (planet as any)._health = c.value;
            } else if (c.field === 'upgrade') {
                (planet as any)._upgrade = c.value;
            } else if (c.field === 'candidateOwner') {
                (planet as any)._candidateOwner = game.players.find(p => p.team === c.value);
            } else if (c.field === 'owner') {
                (planet as any)._owner = game.players.find(p => p.team === c.value);
            }
        });
    }
}
defineTypes(PlanetSchema, {
    owner: 'string',
    level: 'number',
    maxLevel: 'number',
    health: 'number',
    upgrade: 'number',
    candidateOwner: 'string',
    px: 'number',
    py: 'number',
});
export interface PlanetSchema extends Schema {
    owner: string;
    level: number;
    maxLevel: number;
    health: number;
    upgrade: number;
    candidateOwner: string;
    px: number;
    py: number;
}

export class SatelliteSchema extends Schema {
    synchronizeFromEntity(ent: Satellite) {
        this.id = ent.id;
        this.owner = ent.owner.team;
        this.vx = ent.velocity.x;
        this.vy = ent.velocity.y;
        this.px = ent.position.x;
        this.py = ent.position.y;
        this.destroyedBy = ent.destroyedBy;
    }

    static synchronizeTo(sat: Satellite, game: Game, changes: DataChange<any>[]) {
        changes.forEach(c => {
            if (c.field === 'px') {
                sat.position.x = c.value;
            } else if (c.field === 'py') {
                sat.position.y = c.value;
            } else if (c.field === 'vx') {
                sat.velocity.x = c.value;
            } else if (c.field === 'vy') {
                sat.velocity.y = c.value;
            } else if (c.field === 'id') {
                (sat as any).id = c.value;
            } else if (c.field === 'destroyedBy') {
                sat.destroy();
                sat.destroyedBy = c.value;
            }
        });
    }
}
defineTypes(SatelliteSchema, {
    id: 'string',
    owner: 'string',
    vx: 'number',
    vy: 'number',
    px: 'number',
    py: 'number',
    destroyedBy: 'string',
});
export interface SatelliteSchema extends Schema {
    id: string;
    owner: string;
    destroyedBy: string;
    // velocity
    vx: number;
    vy: number;
    // position/size
    px: number;
    py: number;
}

export class PlayerMoveMessage extends Schema {
    constructor(player: Player, sats: Satellite[], point: Point) {
        super();
        this.owner = player.team;
        this.satelliteIds = sats.map(e => e.id);
        this.px = point.x;
        this.py = point.y;
    }
}
defineTypes(PlayerMoveMessage, {
    owner: 'string',
    satelliteIds: ['string'],
    px: 'number',
    py: 'number',
});
export interface PlayerMoveMessage extends Schema {
    owner: string;
    satelliteIds: string[];
    px: number;
    py: number;
}

export class GameEventSchema extends Schema {
    constructor(readonly ev: GameEvent) {
        super();
        this.type = ev.type;
        this.team = ev.team;
    }
}
defineTypes(GameEventSchema, {
    type: 'string',
    team: 'string',
});
export interface GameEventSchema extends Schema {
    type: string;
    team: string;
}

export class GameLogSchema extends Schema {
    constructor(readonly ev: GameStateSnapshot) {
        super();
        this.time = ev.time;
        this.satelliteCounts = ev.satelliteCounts;
        this.events = ev.events.map(e => new GameEventSchema(e));
    }
}
defineTypes(GameLogSchema, {
    time: 'number',
    satelliteCounts: { map: 'number' },
    events: [GameEventSchema],
});
export interface GameLogSchema extends Schema {
    time: number;
    satelliteCounts: Map<string, number>;
    events: GameEventSchema[];
}

export class GameConfigSchema extends Schema {
    constructor(
        public gameSpeed = constants.gameSpeed,
        public pulseRate = constants.pulseRate,
        public maxWorld = constants.maxWorld,
        public allowCoop = true,
        public maxPlayers = 16,
        public colours = playerTeams.map(p => p.value),
        public startGame = false, // signal to start game
        public gameMap = JSON.stringify(gameMaps[0]),
    ) { super() }
}
defineTypes(GameConfigSchema, {
    gameSpeed: 'number',
    pulseRate: 'number',
    maxWorld: 'number',
    maxPlayers: 'number',
    colours: ['string'],
    allowCoop: 'boolean',
    startGame: 'boolean',
    gameMap: 'string',
});

export class GameSchema extends Schema {
    private toRemove = new Map<string, number>();

    constructor(
        readonly label: string,
        readonly config = new GameConfigSchema(),
        readonly satellites = new MapSchema<SatelliteSchema>(),
        readonly planets = new MapSchema<PlanetSchema>(),
        readonly players = new MapSchema<PlayerSchema>(),
        readonly log = new ArraySchema<GameLogSchema>(),
        public phase: 'waiting' | 'running' | 'finished' = 'waiting',
        public gameTimeMS = -1,
    ) { super() }

    update(game: Game, elapsedMS: number) {
        if (this.phase !== 'running') {
            return;
        }

        const tick = game.tick(elapsedMS * game.config.gameSpeed);
        this.gameTimeMS = game.gameTimeMS;
        if (tick.log) {
            this.log.push(new GameLogSchema(tick.log));
        }

        // TODO: there has got to be a better way to do this. How else can we track the reason an entity was removed?
        for (const [entityId, removeTime] of this.toRemove) {
            if (this.gameTimeMS > removeTime) {
                this.toRemove.delete(entityId);
                this.satellites.delete(entityId);
            }
        }

        // keep removed entites around a few seconds after delete to make sure they sync final state to client
        tick.removed.forEach(sat => {
            this.toRemove.set(sat.id, this.gameTimeMS + 30_000);
            this.syncSatellite(sat)
        });
        tick.removed.clear();

        game.forEachEntity(ent => {
            if (ent.type === 'Planet') {
                const e = this.planets.get(ent.id) ?? new PlanetSchema();
                e.synchronizeFromEntity(ent as Planet);
                this.planets.set(ent.id, e);
            } else if (ent.type === 'Satellite') {
                this.syncSatellite(ent as Satellite);
            }
        });
    }

    private syncSatellite(sat: Satellite) {
        const e = this.satellites.get(sat.id) ?? new SatelliteSchema();
        e.synchronizeFromEntity(sat);
        this.satellites.set(sat.id, e);
    }
}
defineTypes(GameSchema, {
    planets: { map: PlanetSchema },
    satellites: { map: SatelliteSchema },
    removeReason: { map: 'string' },
    players: { map: PlayerSchema },
    log: [GameLogSchema],
    config: GameConfigSchema,
    phase: 'string',
    gameTimeMS: 'number',
    label: 'string',
});

// client-side code
import * as Colyseus from 'colyseus.js';
import { point, type Point } from './math';

const roomName = 'senalumi';
const gameClient = () => new Colyseus.Client(`ws://${location.hostname}:2567`);

export async function listGameRooms() {
    try {
        const client = gameClient();
        const rooms = await client.getAvailableRooms(roomName);
        return rooms;
    } catch (e) {
        console.error('Unable to list game rooms', e);
        return [];
    }
}

export async function joinRemoteGame(playerName: string, gameName: string) {
    const room = await gameClient().joinOrCreate<GameSchema>(roomName, { playerName, label: gameName });
    return await setupRoom(room);
}

export async function rejoinRoom(roomId: string, sessionId: string) {
    const room = await gameClient().reconnect<GameSchema>(roomId, sessionId);
    return await setupRoom(room);
}

async function setupRoom(room: Colyseus.Room<GameSchema>) {
    room.onError((code, msg) => {
        console.error('error', code, msg);
    });

    room.onMessage('ping', () => room.send('pong'));

    room.onLeave((code) => {
        console.log('leave-code', code);
    });

    // wait until we get gamestate
    await new Promise(resolve => room.state.onChange = resolve)
    room.state.onChange = null;

    return room;
}

//  hack the game into a client-only mode
export function convertToRemoteGame(game: Game, room: Colyseus.Room<GameSchema>) {
    game.tick = time => {
        game.frameState.elapsedMS = time;
        game.gameTimeMS = room.state.gameTimeMS;
        if (room.state.gameTimeMS >= 0) {
            // interpolate and return a result that is derived from the game log and removed satellies
            // see below for state synchornization from colyseus callback
            game.forEachEntity(ent => ent.tick(time));
        }
        return game.frameState;
    };

    const state = room.state;

    game.moveSatellites = (player, satellites, point) =>
        room.send('player:move', new PlayerMoveMessage(player, satellites, point));

    // We add event listeners in onStateChange.once() because it is called _after_ the first
    // full sync so we don't need to worry about onAdd() being called twice for the same entity
    // See https://docs.colyseus.io/colyseus/state/overview/
    room.onStateChange.once(() => {
        state.planets.onAdd = (ent: PlanetSchema) => {
            const planet = new Planet(game, point(ent.px, ent.py), 3);
            game.planets.push(planet);
            ent.onChange = changes => PlanetSchema.synchronizeTo(planet, game, changes);
            ent.onRemove = () => {
                game.planets = game.planets.filter(p => p !== planet);
                planet.destroy();
            }
        };

        state.satellites.onAdd = (ent: SatelliteSchema) => {
            const owner = game.players.find(e => e.team === ent.owner);
            const sat = game.satellites.take().init(ent.id, owner, point(ent.px, ent.py));
            ent.onChange = changes => SatelliteSchema.synchronizeTo(sat, game, changes);
            ent.onRemove = () => {
                // CAUTION! Because satellites are a pool, we may be re-using them so double check the id before
                // destroying the satellite otherwise we may remove the wrong one
                if (ent.id === sat.id) {
                    sat.destroy();
                }
            };
        };

        state.log.onAdd = (log: GameStateSnapshot) => {
            game.frameState.log = log;
            game.log.push(game.frameState.log);
        };

        // callbacks are setup so synchronize state
        state.triggerAll();
    });

    return game;
}