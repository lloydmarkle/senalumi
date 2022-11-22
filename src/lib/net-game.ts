import { Schema, MapSchema, defineTypes, ArraySchema, type DataChange } from '@colyseus/schema';
import { Game, Planet, Satellite, Player, type GameEvent, type GameStateSnapshot, type Team } from './game';

// something weird going on with vite, decorators, and colyseus.
// Not really sure what but defineTypes() works
// https://github.com/colyseus/colyseus/issues/510
export class PlayerSchema extends Schema {
    constructor(
        public displayName: string,
        public sessionId: string = '',
    ) {
        super();
        this.color = '' as any;
    }
}
defineTypes(PlayerSchema, {
    displayName: 'string',
    color: 'string',
});
export interface PlayerSchema extends Schema {
    color: Team;
}

export class PlanetSchema extends Schema {
    constructor(readonly ent: Planet) { super() }

    synchronizeFromEntity() {
        this.owner = this.ent.owner?.id;
        this.level = this.ent.level;
        this.maxLevel = this.ent.maxLevel;
        this.health = this.ent.health
        this.upgrade = this.ent.upgrade
        this.candidateOwner = this.ent.candidateOwner?.id
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
                (planet as any)._candidateOwner = game.players.find(p => p.id === c.value);
            } else if (c.field === 'owner') {
                (planet as any)._owner = game.players.find(p => p.id === c.value);
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
        this.owner = this.ent.owner.id;
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
        this.owner = player.id;
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

export class GameSchema extends Schema {
    constructor(
        readonly satellites = new MapSchema<SatelliteSchema>(),
        readonly planets = new MapSchema<PlanetSchema>(),
        readonly players = new MapSchema<PlayerSchema>(),
        readonly log = new ArraySchema<GameLogSchema>(),
        readonly game = new Game(),
    ) { super() }

    update(elapsedMS: number) {
        const tick = this.game.tick(elapsedMS * this.game.constants.gameSpeed);
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
});

// client-side code
import * as Colyseus from 'colyseus.js';
import { GrowOnlyArray, point, type Point } from './math';

//  hack the game into a client-only mode
export function convertToRemoteGame(game: Game, playerInfo: PlayerSchema) {
    game.satellites.forEach(sat => sat.destroy());
    game.planets = [];
    const tickResult = { lastPulseTime: 0, elapsedMS: 0, gameTimeMS: 0, removed: new GrowOnlyArray<Satellite>(), log: null };
    game.tick = (time) => {
        tickResult.elapsedMS = time;
        // interpolate and returna result that is derived from the game log and removed satellies
        // see synchronizeState() below
        game.forEachEntity(ent => ent.tick(time));
        return tickResult;
    };

    const client = new Colyseus.Client(`ws://${location.hostname}:2567`);
    (async () => {
        // client.getAvailableRooms('auralux');
        try {
            const room: Colyseus.Room<GameSchema> = await client.joinOrCreate('auralux', { label: 'test' });
            room.send('player:info', playerInfo);

            room.onError((code, msg) => {
                console.error('error', code, msg);
            });
            room.onLeave((code) => {
                console.log('leave', code);
            });
            room.onMessage('message', m => console.log(m));
            synchronizeState(room);
        } catch(e) {
            console.log("JOIN ERROR", e);
        }
    })();

    function synchronizeState(room: Colyseus.Room<GameSchema>) {
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
            const owner = game.players.find(e => e.id === ent.owner);
            const sat = game.satellites.take().init(owner, point(ent.px, ent.py));
            ent.onChange = changes => SatelliteSchema.synchronizeTo(sat, changes);
            ent.onRemove = () => {
                sat.destroy();
                tickResult.removed.add(sat);
            };
        };

        state.log.onAdd = (log, key) => {
            game.log.push(log as GameStateSnapshot);
            tickResult.log = log;
        };
    }
}