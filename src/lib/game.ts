import { AIPlayer, AIPlayer1, AIPlayer2, AIPlayer3, type AIConfig } from './ai.js';
import { teamColor } from './data.js';
import { ArrayPool, distSqr, originPoint, point, QuadTree, type Point, GrowOnlyArray } from './math.js';

const quadTreeBoxCapacity = 5;
const moveNoise = () => Math.random() * 1.2 + 0.8;
const targetOffsetNoise = () => point(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10);
export const constants = {
    gameSpeed: 1,
    pulseRate: 1, // stars per pulse
    maxWorld: 4000,  //size
    maxSatelliteVelocity: 0.05,
    maxSatellites: 15000,
    impactStrength: -2.2,
    forceStiffness: 0.000007,
    forceDamping: 0.0008,
    satelliteRadius: 8,
    gameCountDown: 10, // seconds
    // sprite is (currently) 300px
    planetRadius: 150,
};

export type Team = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';

export interface Renderable {
    tick(elapsedMS: number): void;
    destroy(): void;
}

export interface Entity {
    id: string;
    type: string;

    gfx: Renderable;
    // canCollide: boolean;

    position: Point;
    size: number;
    rotation: number;
    alpha?: number;

    tick(elapsedMS: number);
    destroy(): void;
}

export interface GameMap {
    props: {
        name: string,
        img: string,
    },
    setup?: {
        function: 'circle' | 'random'
        initialSatellites: number,
        size: number;
        teams: Team[],
        planetCounts: { level: number, count: number }[];
    },
    planets: {
        ownerTeam?: Team,
        initialSatellies: number,
        level: PlanetLevel,
        maxLevel: PlanetLevel,
        position: Point,
    }[],
}

function generateRandomCircleWorld(game: Game, mapSetup: GameMap['setup']) {
    const minDistance = constants.planetRadius * constants.planetRadius * 4;
    const worldSize = mapSetup.size;
    const worldSize2x = mapSetup.size * 2;
    const tree = new QuadTree<Planet>(1);
    const positionPlanet = () => {
        while (true)  {
            let position = point(Math.random() * worldSize2x - worldSize, Math.random() * worldSize2x - worldSize);
            let use = true;
            tree.query(position, constants.planetRadius,
                p => use = use && distSqr(position, p.position) > minDistance);
            if (use) {
                return position;
            }
        }
    };

    game.players = game.players.filter(p => mapSetup.teams.indexOf(p.team) !== -1);

    const planets: Planet[] = [];
    // position player planets in a circle
    for (let i = 0; i < mapSetup.teams.length; i++) {
        const angle = Math.PI * 2 * (i / mapSetup.teams.length);
        const position = point(Math.cos(angle) * worldSize, Math.sin(angle) * worldSize);
        const planet = new Planet(game, position, 1);
        planet.capture(game.players[i]);

        planets.push(planet);
        tree.insert(planet, constants.planetRadius);
    }
    // position other planets randomly
    for (const { level, count } of mapSetup.planetCounts) {
        for (let j = 0; j < count; j++) {
            const position = positionPlanet();
            planets.push(new Planet(game, position, level as PlanetLevel));
            tree.insert(planets[planets.length - 1], constants.planetRadius);
        }
    }

    // add initial satelliets to each planet
    game.planets = planets;
    for (let i = 0; i < mapSetup.initialSatellites; i++){
        game.pulse();
    }
}

function setupWorld(game: Game) {
    generateRandomCircleWorld(game, {
        function: 'circle',
        initialSatellites: 100,
        size: 1000,
        teams: ['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'pink'],
        planetCounts: [
            { level: 3, count: game.players.length / 4 },
            { level: 2, count: game.players.length / 2 },
            { level: 1, count: game.players.length },
        ],
    });
}

export interface GameEvent {
    type: 'planet-upgrade' | 'planet-capture' | 'planet-lost';
    team: Team;
}
export interface GameStateSnapshot {
    time: number;
    satelliteCounts: Map<Team, number>;
    events: GameEvent[];
}
const createSnapshot = (time: number): GameStateSnapshot => ({
    time,
    satelliteCounts: new Map(),
    events: [],
});

export type WorldInitializer = (game: Game) => void;

export function initializerFromMap(map: GameMap) {
    return (game: Game) => {
        if (map.setup) {
            generateRandomCircleWorld(game, map.setup);
        } else {
            map.planets.forEach(p => {
                const planet = new Planet(game, p.position, p.maxLevel);
                if (p.ownerTeam) {
                    const player = game.players.find(player => player.team === p.ownerTeam);
                    planet.capture(player);
                    planet.level = p.level;
                    for (let i = 0; i < p.initialSatellies; i++) {
                        game.spawnSatellite(planet);
                    }
                }
                game.planets.push(planet);
            });
        }
    };
}

export class Player {
    constructor(
        readonly game: Game,
        readonly team: Team,
        readonly ai: AIPlayer,
        readonly color = teamColor(team),
    ) {}

    tick(ms: number): void {
        this.ai.tick(this, ms);
    }

    selection(planet: Planet) {
        const radius = planet.orbitDistance * 1.6;
        const radiusSqr = radius * radius;
        const sats = [];
        this.game.collisionTree.query(planet.position, radius, sat => {
            if (sat.owner === this && distSqr(sat.position, planet.position) < radiusSqr) {
                sats.push(sat);
            }
        });
        return sats;
    }
}

export class Game {
    private snapshot: GameStateSnapshot;
    private satId = 0;

    planets: Planet[] = [];
    players: Player[] = [];
    readonly log: GameStateSnapshot[] = [];
    readonly config = constants;
    readonly satellites = new ArrayPool(() => new Satellite());
    readonly collisionTree = new QuadTree<Satellite>(quadTreeBoxCapacity);
    readonly state = {
        log: null as GameStateSnapshot,
        // due to pooling and pulse happening after collisions, this removed array may not be accurate
        // in practice, it doesn't seem to matter
        removed: new GrowOnlyArray<Satellite>(),
        elapsedMS: 0,
        gameTimeMS: constants.gameCountDown * -1000,
        lastPulseTime: 0,
        running: false,
    };

    constructor(private initializeWorld: WorldInitializer = setupWorld) {
        const aiStats: AIConfig = {
            minThinkGapMS: 8000,
            maxThinkGapMS: 12000,
            minSatellites: 110,
            healChance: 0.95,
            attackChance: 0.40,
            conquerChance: 0.55,
            transferChance: 0.85,
            upgradeChance: 0.45,
        };
        this.players = [
            new Player(this, 'red', new AIPlayer1(aiStats)),
            new Player(this, 'orange', new AIPlayer1(aiStats)),
            new Player(this, 'yellow', new AIPlayer3(aiStats)),
            new Player(this, 'green', new AIPlayer2(aiStats)),
            new Player(this, 'blue', new AIPlayer1(aiStats)),
            new Player(this, 'violet', new AIPlayer1(aiStats)),
            new Player(this, 'pink', new AIPlayer2(aiStats)),
        ];
    }

    start(delay = constants.gameCountDown) {
        this.snapshot = createSnapshot(0);
        this.initializeWorld(this);
        let pid = 0;
        this.planets.forEach(p => p.id = 'p' + pid++);

        this.state.gameTimeMS = delay * -1000;
        this.state.running = true;
    }

    forEachEntity(fn: (ent: Entity) => void) {
        this.planets.forEach(fn);
        this.satellites.forEach(fn);
    }

    tick(time: number) {
        this.state.elapsedMS = 0;
        this.state.log = null;
        if (!this.state.running) {
            return this.state;
        }

        const elapsedMS = time * this.config.gameSpeed;
        this.state.gameTimeMS += elapsedMS;
        this.state.elapsedMS = elapsedMS;
        if (this.state.gameTimeMS < 0) {
            return this.state;
        }

        // pulse first so that we don't re-use entities
        const seconds = Math.floor(this.state.gameTimeMS / 1000);
        if (seconds > this.state.lastPulseTime) {
            this.state.lastPulseTime = seconds;
            this.pulse();

            const map = this.snapshot.satelliteCounts;
            this.satellites.forEach(sat => map.set(sat.owner.team, (map.get(sat.owner.team) ?? 0) + 1));
            this.state.log = this.snapshot;
            this.log.push(this.snapshot);
            this.snapshot = createSnapshot(seconds);
        }

        this.collisionTree.clean();

        this.planets.forEach(planet => planet.tick(elapsedMS));
        this.satellites.forEach(sat => {
            this.collisionTree.insert(sat, constants.satelliteRadius);
            sat.tick(elapsedMS);
        });
        // needs to be after satellites tick otherwise the quad tree explodes
        this.players.forEach(player => player.tick(elapsedMS));

        this.collisionTree.walk(sats => this.collide(sats, constants.satelliteRadius, elapsedMS));

        return this.state;
    }

    private collide(satellites: Satellite[], radius: number, ms: number) {
        const r2 = radius * radius;
        for (let i = 0; i < satellites.length; ++i) {
            for (let j = i; j < satellites.length; ++j) {
                let sat1 = satellites[i];
                let sat2 = satellites[j];
                if (sat1.owner === sat2.owner) {
                    continue;
                }

                const dist = distSqr(sat1.position, sat2.position);
                if (dist < r2) {
                    this.applyImpact(sat1, sat2, radius * 10, ms);
                    sat1.destroy(sat2);
                    sat2.destroy(sat1);
                }
            }
        }
    }

    private applyImpact(sat1: Satellite, sat2: Satellite, radius: number, ms: number) {
        const dot = sat1.velocity.x * sat2.velocity.x + sat1.velocity.y * sat2.velocity.y;
        const len1 = Math.sqrt(sat1.velocity.x * sat1.velocity.x + sat1.velocity.y * sat1.velocity.y);
        const len2 = Math.sqrt(sat2.velocity.x * sat2.velocity.x + sat2.velocity.y * sat2.velocity.y);
        const angle = Math.acos(dot / (len1 * len2));
        const impact = constants.impactStrength * angle / Math.PI;
        if (isNaN(impact)) {
            return;
        }

        this.collisionTree.query(sat1.position, radius,
            sat => applyImpact(sat, sat1.position, impact, ms));
        this.collisionTree.query(sat2.position, radius,
            sat => applyImpact(sat, sat2.position, impact, ms));
    }

    moveSatellites(player: Player, satellites: Satellite[], point: Point) {
        const playerSatellites = satellites.filter(e => e.owner === player);
        for (const planet of this.planets) {
            if (distSqr(planet.position, point) < 1600) {
                playerSatellites.forEach(s => s.moveToPlanet(planet));
                return;
            }
        }
        playerSatellites.forEach(s => s.moveToPoint(point));
    }

    pulse() {
        this.planets.forEach(planet => {
            if (planet.owner) {
                for (let i = 0; i < planet.level * constants.pulseRate; i++) {
                    this.spawnSatellite(planet);
                }
            }
        });
    }

    spawnSatellite(planet: Planet) {
        if (this.satellites.length >= constants.maxSatellites) {
            return;
        }
        const sat = this.satellites.take().init(`s${this.satId++}`, planet.owner, planet.position);
        sat.mover = new OrbitMover(planet);
    }

    recordEvent(ev: GameEvent) {
        this.snapshot.events.push(ev);
    }
}

type PlanetLevel = 0 | 1 | 2 | 3 | 4;
export class Planet implements Entity {
    private _candidateOwner?: Player;
    private _owner?: Player;
    private _rotation: number = Math.random() * Math.PI * 2;
    private rotationSpeed = Math.PI / 40000;
    private _health: number = 100;
    private _upgrade: number = 0;

    id: string;
    gfx: Renderable;
    readonly type = 'Planet';
    level: PlanetLevel = 0;
    initialSatellites = 100;
    get rotation() { return this._rotation; }
    get owner(): Player | undefined { return this._owner; }
    get candidateOwner(): Player | undefined { return this._candidateOwner; }
    get size() { return (this.level / 5) + .5; }
    get orbitDistance() { return this.size * constants.planetRadius; }
    get health() { return this._health; }
    get upgrade() { return this._upgrade; }

    constructor(readonly game: Game, readonly position: Point, readonly maxLevel: PlanetLevel) {}

    capture(owner: Player) {
        this._health = 100;
        this._upgrade = 0;
        this.level = owner ? 1 : 0;
        this._candidateOwner = null;
        this._owner = owner;
    }

    tick(elapsedMS: number) {
        this._rotation += this.rotationSpeed * elapsedMS;
    }

    absorb(sat: Satellite) {
        // kind of a mess...
        if (!this.owner) {
            if (!this._candidateOwner) {
                this._candidateOwner = sat.owner;
            }
            this._upgrade += (this._candidateOwner === sat.owner) ? 1 : -1;
            sat.destroy(this);

            if (this._upgrade === 0) {
                this._candidateOwner = null;
            }
            if (this._upgrade === 100) {
                this.capture(this._candidateOwner);
                this.game.recordEvent({ type: 'planet-capture', team: this.owner.team });
            }
        } else if (sat.owner === this.owner) {
            if (this.level < this.maxLevel && this._health === 100) {
                this._upgrade += 1;
                sat.destroy(this);
            } else if (this._health < 100) {
                this._health += 1;
                sat.destroy(this);
            }
            if (this._upgrade === 100) {
                this.game.recordEvent({ type: 'planet-upgrade', team: this.owner.team });
                this.level += 1;
                this._upgrade = 0;
            }
        } else {
            this._health -= 1;
            sat.destroy(this);
            if (this._health === 0) {
                this.game.recordEvent({ type: 'planet-lost', team: this.owner.team });
                this.capture(null);
                this.level = 0;
            }
        }
    }

    destroy() {
        this.gfx?.destroy();
    }
}

export interface Moveable {
    velocity: Point;
    position: Point;
}

interface Mover<T extends Moveable = Moveable> {
    arrived(moveable: T): boolean;
    evaluate(moveable: T, elapsedMS: number): Mover<T>;
}

const nullMover: Mover = {
    evaluate: () => nullMover,
    arrived: () => false,
};

type Mission = 'hurt' | 'heal' | 'take' | 'upgrade' | 'none' | 'move';
class PlanetMover implements Mover {
    private mission: Mission;
    private planetLevel: PlanetLevel;
    constructor(readonly satellite: Satellite, readonly planet: Planet) {
        this.planetLevel = planet.level;
        this.mission = this.computeMission();
    }

    arrived = () => true;
    evaluate(moveable: Moveable, elapsedMS: number) {
        const mission = this.computeMission();
        if (mission === this.mission) {
            this.planet.absorb(this.satellite);
        }
        return this;
    }

    private computeMission(): Mission {
        return (
            !this.planet.owner ? 'take'
            : (this.satellite.owner !== this.planet.owner) ? 'hurt'
            : (this.planet.health < 100) ? 'heal'
            : (this.planet.upgrade < 100 && this.planetLevel === this.planet.level) ? 'upgrade'
            : 'none'
        );
    }
}

function applyImpact(moveable: Moveable, point: Point, impact: number, rate: number) {
    let dirX = point.x - moveable.position.x;
    let dirY = point.y - moveable.position.y;
    if (dirX === dirY && dirX === 0) {
        // do nothing because this will give us div/0 below
        return;
    }
    const invLen = 1 / Math.sqrt(dirX * dirX + dirY * dirY);
    dirX *= invLen;
    dirY *= invLen;

    let vx = dirX * impact * invLen * constants.maxSatelliteVelocity;
    let vy = dirY * impact * invLen * constants.maxSatelliteVelocity;

    moveable.velocity.x += (vx + constants.forceDamping * moveable.velocity.x);
    moveable.velocity.y += (vy + constants.forceDamping * moveable.velocity.y);
}

function applySpringForce(moveable: Moveable, x: number, y: number, rate: number) {
    // https://medium.com/unity3danimation/simple-physics-based-motion-68a006d42a18
    let dirX = x - moveable.position.x;
    let dirY = y - moveable.position.y;
    const invLen = 1 / Math.sqrt(dirX * dirX + dirY * dirY);
    dirX *= invLen;
    dirY *= invLen;

    let vx = dirX * constants.maxSatelliteVelocity;
    let vy = dirY * constants.maxSatelliteVelocity;

    moveable.velocity.x += (constants.forceStiffness * dirX + constants.forceDamping * (vx - moveable.velocity.x)) * rate;
    moveable.velocity.y += (constants.forceStiffness * dirY + constants.forceDamping * (vy - moveable.velocity.y)) * rate;
}

class OrbitMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 * 0.00005 + (Math.PI * 2 * 0.00003);
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private positionNoise = targetOffsetNoise();
    private moveNoise = moveNoise();
    constructor(readonly orbit: { orbitDistance: number, position: Point }) {}

    arrived = () => false;
    evaluate(moveable: Moveable, elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed * elapsedMS;
        const radius = this.orbit.orbitDistance * this.orbitDistanceOffset;
        applySpringForce(moveable,
            Math.cos(this.orbitRotationOffset) * radius + this.orbit.position.x + this.positionNoise.x,
            Math.sin(this.orbitRotationOffset) * radius + this.orbit.position.y + this.positionNoise.y,
            elapsedMS * this.moveNoise);
        return this;
    }
}

class PointMover implements Mover {
    private moveNoise = moveNoise();
    private positionNoise = targetOffsetNoise();
    constructor(readonly target: Point) {}

    arrived = (moveable: Moveable) => distSqr(moveable.position, this.target) < 400;
    evaluate(moveable: Moveable, elapsedMS: number) {
        // why compute this every frame? If this.target is a reference to a planet, then
        // the planet could be moving so we have a moving target
        applySpringForce(moveable,
            this.target.x + this.positionNoise.x,
            this.target.y + this.positionNoise.y,
            elapsedMS * this.moveNoise);
        return this;
    }
}

class MoveSequence implements Mover {
    constructor(readonly movers: Mover[]) {}

    arrived = (moveable: Moveable) => this.movers[0].arrived(moveable);
    evaluate(moveable: Moveable, elapsedMS: number) {
        if (this.arrived(moveable)) {
            this.movers.shift();
        }
        this.movers[0].evaluate(moveable, elapsedMS);
        return this;
    }
}

export class Satellite implements Entity, Moveable {
    id: string;
    rotation = 0;
    gfx: Renderable;
    readonly type = 'Satellite';
    readonly size = 1;
    readonly position: Point = originPoint();
    readonly velocity: Point = originPoint();
    readonly owner: Player;
    destroyedBy: string;

    mover: Mover;
    private rotationSpeed: number;

    constructor() {}

    init(id: string, owner: Player, position: Point) {
        this.id = id;
        this.destroyedBy = null;
        this.gfx = null;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = Math.random() * Math.PI * 2 / 2000;

        let self = this as any;
        self.owner = owner;
        self.position.x = position.x;
        self.position.y = position.y;
        this.mover = nullMover;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * constants.maxSatelliteVelocity;
        self.velocity.x = Math.cos(angle) * speed;
        this.velocity.y = Math.sin(angle) * speed;
        return this;
    }

    moveToPlanet(planet: Planet) {
        this.mover = new MoveSequence([
            new PointMover(planet.position),
            new PlanetMover(this, planet),
            new OrbitMover(planet),
        ]);
    }

    moveToPoint(point: Point) {
        this.mover = new OrbitMover({ orbitDistance: Math.random() * 20, position: point });
    }

    tick(elapsedMS: number) {
        const outOfBounds = (this.position.x < -constants.maxWorld || this.position.x > constants.maxWorld || this.position.y < -constants.maxWorld || this.position.y > constants.maxWorld);
        if (outOfBounds) {
            return this.destroy();
        }
        this.mover = this.mover.evaluate(this, elapsedMS);
        this.rotation += this.rotationSpeed * elapsedMS;
        this.position.x += this.velocity.x * elapsedMS;
        this.position.y += this.velocity.y * elapsedMS;
    }

    destroy(causeEntity?: Entity) {
        const game = this.owner.game;
        const released = game.satellites.release(this);
        if (released) {
            this.gfx?.destroy();
            game.state.removed.add(this);
        }
        if (causeEntity) {
            this.destroyedBy = causeEntity.id;
        }
    }
}
