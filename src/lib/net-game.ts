import { Schema, MapSchema, defineTypes, ArraySchema, type DataChange } from '@colyseus/schema';
import { Game, constants, Planet, Satellite, Player, type GameEvent, type GameStateSnapshot, type Team } from './game';

// something weird going on with vite, decorators, and colyseus.
// Not really sure what but defineTypes() works
// https://github.com/colyseus/colyseus/issues/510
export class PlayerSchema extends Schema {
    constructor(
        public displayName: string,
        // these don't need to be in the constructor but it's short than writing a separate interface and
        // initializing them in the constructor
        public sessionId: string = '',
        public ready = false,
        public admin = false,
        public team: Team = '' as any,
    ) { super() }
}
defineTypes(PlayerSchema, {
    displayName: 'string',
    team: 'string',
    admin: 'boolean',
    ready: 'boolean',
});

export class PlanetSchema extends Schema {
    constructor(readonly ent: Planet) { super() }

    synchronizeFromEntity() {
        this.owner = this.ent.owner?.team;
        this.level = this.ent.level;
        this.maxLevel = this.ent.maxLevel;
        this.health = this.ent.health
        this.upgrade = this.ent.upgrade
        this.candidateOwner = this.ent.candidateOwner?.team
        this.px = this.ent.position.x;
        this.py = this.ent.position.y;
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
    constructor(readonly ent: Satellite) { super() }

    synchronizeFromEntity() {
        this.id = this.ent.id;
        this.owner = this.ent.owner.team;
        this.vx = this.ent.velocity.x;
        this.vy = this.ent.velocity.y;
        this.px = this.ent.position.x;
        this.py = this.ent.position.y;
    }

    static synchronizeTo(sat: Satellite, changes: DataChange<any>[]) {
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
});
export interface SatelliteSchema extends Schema {
    id: string;
    owner: string;
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
        public warmupSeconds = constants.gameCountDown,
        public gameSpeed = constants.gameSpeed,
        public pulseRate = constants.pulseRate,
        public maxWorld = constants.maxWorld,
        public allowCoop = true,
        public maxPlayers = 16,
        public colours = ['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'pink'],
        public startGame = false, // signal to start game
    ) { super() }
}
defineTypes(GameConfigSchema, {
    warmupSeconds: 'number',
    gameSpeed: 'number',
    pulseRate: 'number',
    maxWorld: 'number',
    maxPlayers: 'number',
    colours: ['string'],
    allowCoop: 'boolean',
    startGame: 'boolean',
});

export class GameSchema extends Schema {
    constructor(
        readonly game: Game,
        readonly label: string,
        readonly config = new GameConfigSchema(),
        readonly satellites = new MapSchema<SatelliteSchema>(),
        readonly planets = new MapSchema<PlanetSchema>(),
        readonly players = new MapSchema<PlayerSchema>(),
        readonly log = new ArraySchema<GameLogSchema>(),
        public running = false,
        public gameTimeMS = 0,
    ) { super() }

    update(elapsedMS: number) {
        const tick = this.game.tick(elapsedMS * this.game.config.gameSpeed);
        this.running = tick.running;
        this.gameTimeMS = tick.gameTimeMS;
        if (tick.log) {
            this.log.push(new GameLogSchema(tick.log));
        }
        this.game.forEachEntity(ent => {
            if (ent.type === 'Planet') {
                const e = this.planets.get(ent.id) ?? new PlanetSchema(ent as Planet);
                e.synchronizeFromEntity();
                this.planets.set(ent.id, e);
            } else if (ent.type === 'Satellite') {
                const e = this.satellites.get(ent.id) ?? new SatelliteSchema(ent as Satellite);
                e.synchronizeFromEntity();
                this.satellites.set(ent.id, e);
            }
        });
        tick.removed.forEach(sat => this.satellites.delete(sat.id));
    }
}
defineTypes(GameSchema, {
    planets: { map: PlanetSchema },
    satellites: { map: SatelliteSchema },
    players: { map: PlayerSchema },
    log: [GameLogSchema],
    config: GameConfigSchema,
    running: 'boolean',
    gameTimeMS: 'number',
    label: 'string',
});

// client-side code
import * as Colyseus from 'colyseus.js';
import { point, type Point } from './math';

//  hack the game into a client-only mode
export async function joinRemoteGame(playerName: string, gameName: string) {
    const client = new Colyseus.Client(`ws://${location.hostname}:2567`);
    // client.getAvailableRooms('auralux');
    try {
        const room: Colyseus.Room<GameSchema> = await client.joinOrCreate('auralux', { playerName, label: gameName });
        room.onError((code, msg) => {
            console.error('error', code, msg);
        });
        room.onLeave((code) => {
            console.log('leave', code);
        });
        room.onMessage('message', m => console.log(m));
        return room;
    } catch(e) {
        console.log("JOIN ERROR", e);
    }
}

export function convertToRemoteGame(game: Game, room: Colyseus.Room<GameSchema>) {
    game.satellites.forEach(sat => sat.destroy());
    (game as any).planets = [];
    game.tick = (time) => {
        game.state.elapsedMS = time;
        game.state.running = room.state.running;
        // interpolate and returna result that is derived from the game log and removed satellies
        // see below for state synchornization from colyseus callback
        game.forEachEntity(ent => ent.tick(time));
        return game.state;
    };

    const state = room.state;
    // state.players.onAdd = (player, key) => console.log('player-a', player, key)
    // state.players.onRemove = (player, key) => console.log('player-r', player, key)
    // state.players.onChange = (player, key) => console.log('player-c', player, key)

    game.moveSatellites = (player, satellites, point) =>
        room.send('player:move', new PlayerMoveMessage(player, satellites, point));

    state.planets.onAdd = (ent, key) => {
        const planet = new Planet(game, point(ent.px, ent.py), 3);
        ent.onChange = changes => PlanetSchema.synchronizeTo(planet, game, changes);
        game.planets.push(planet);
    };

    state.satellites.onAdd = (ent, key) => {
        const owner = game.players.find(e => e.team === ent.owner);
        const sat = game.satellites.take().init(owner, point(ent.px, ent.py));
        ent.onChange = changes => SatelliteSchema.synchronizeTo(sat, changes);
        ent.onRemove = () => {
            sat.destroy();
            game.state.removed.add(sat);
        };
    };

    state.log.onAdd = (log, key) => {
        game.state.log = log as GameStateSnapshot;
        game.log.push(game.state.log);
    };
}