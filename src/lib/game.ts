import colorConvert from 'color-convert'
const { hex, hsl } = colorConvert;
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
    forceStiffness: 0.000007,
    forceDamping: 0.0008,
    satelliteRadius: 8,
    gameCountDown: 5, // seconds
    // sprite is (currently) 300px
    planetRadius: 150,
};

export type Team = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';
let colorMap = {
    'red': 0xD2042D,
    'yellow': 0xFFF44F,
    'orange': 0xCC5500,
    'green': 0x7CFC00,
    'blue': 0x1111DD,
    'violet': 0x7F00FF,
    'pink': 0xFF10F0,
};
export const teamColor = (team: Team) => colorMap[team] ?? 0;

type CollisionStages = 'distance' | 'filter' | 'remove';
type TeamStats = { [key in Team]?: number };
class Stats {
    public collisionStages: { [key in CollisionStages]?: number } = {};
    public playerTime: TeamStats = {};
    public moveTime: number = 0;
    public collideTime: number = 0;
    public pulseTime: number = 0;
    public thinkTime: number = 0;
    public gameTime: number = 0;

    now() {
        return performance.now();
    }

    recordCollide(start: number, stage: CollisionStages) {
        this.collisionStages[stage] = (this.collisionStages[stage] ?? 0) + (this.now() - start);
    }

    recordPlayerStat(start: number, team: Team, field: TeamStats) {
        field[team] = (field[team] ?? 0) + (this.now() - start);
    }

    elapsed(start: number) {
        return this.now() - start;
    }

    clear() {
        this.collisionStages = {};
        this.playerTime = {};
        this.thinkTime = this.moveTime = this.gameTime = this.collideTime = this.pulseTime = 0;
    }
}

export interface Renderable {
    update(elapsedMS: number): void;
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

export const setLightness = (color: number, lightness: number) => {
    const c = hex.hsl(color.toString(16));
    c[2] = lightness;
    return parseInt(hsl.hex(c), 16);
}

export class Player {
    readonly color: number;
    readonly satelliteColor: number;
    constructor(readonly game: Game, readonly team: Team) {
        this.color = setLightness(teamColor(team), 50);
        this.satelliteColor = setLightness(teamColor(team), 75);
    }

    tick(ms: number): void {}

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

interface AIConfig {
    // max and min time between evaluating the map
    maxThinkGapMS: number;
    minThinkGapMS: number;
    // min satellites before moving
    minSatellites: number;
    // chance to heal
    healChance: number;
    // move satellites between planets
    transferChance: number;
    // upgrade a planet
    upgradeChance: number;
    // attack the closest, weakest, enemy
    attackChance: number;
    // conquer a vacant planet
    conquerChance: number;
}
abstract class AIPlayerBase extends Player {
    ready = true;
    private nextThink: number;
    constructor(game: Game, team: Team, readonly config: AIConfig) {
        super(game, team);
    }

    abstract tick(ms: number): void;

    protected shouldTick(ms: number) {
        this.nextThink -= ms;
        if (this.nextThink > 0) {
            return false;
        }
        this.nextThink = Math.random() * (this.config.maxThinkGapMS - this.config.minThinkGapMS) + this.config.minThinkGapMS;
        return true;
    }

    protected moveToPlanet(satellites: Satellite[], planet: Planet) {
        satellites.forEach(s => s.mover = new MoveSequence([
            new PointMover(planet.position),
            new PlanetMover(s, planet),
            new OrbitMover(planet),
        ]));
    }
}

class AIPlayer extends AIPlayerBase {
    tick(ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        // take action based on the satellites around each planet
        const planets = this.game.planets.filter(e => e.owner === this);
        // const unownedPlanets = this.game.planets.filter(e => !e.owner);
        // for (const planet of unownedPlanets) {
        //     const sats = this.satelliteTree.query(planet.position, planetRadius * 1.3);
        //     if (sats.length < this.config.minSatellies && Math.random() > this.config.conquerChance) {
        //         // planets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
        //         this.moveToPlanet(satellites, planet);
        //     }
        // }

        // TODO do I have stars near an open planet?
        for (const planet of planets) {
            const sats = this.selection(planet);
            // we have 100 so we can do something...
            if (sats.length > this.config.minSatellites) {
                this.takeAction(planets, planet, sats);
            }
        }
    }

    takeAction(planets: Planet[], planet: Planet, satellites: Satellite[]) {
        // We could definitely do better but for now, we use random numbers to evaluate these decisions:
        // Can I upgrade? Should I?
        // TODO Should I heal?
        // Do I have enough satellites to conquer a planet?
        // Do I have enough satellites to attack someone else?
        // TODO Am I under attack and need to setup defense?
        const canUpgrade = planet.level < planet.maxLevel;
        const openPlanets = this.game.planets.filter(p => !p.owner);
        const enemyPlanets = this.game.planets.filter(p => p.owner && p.owner !== this);
        const someSatellites = () => satellites.slice(0,
            Math.max(Math.random() * satellites.length, 100))

        if (canUpgrade && Math.random() < this.config.upgradeChance) {
            this.moveToPlanet(satellites, planet);
        } else if(planet.health < 100 && Math.random() < this.config.healChance) {
            this.moveToPlanet(someSatellites(), planet);
        } else if(openPlanets.length && Math.random() < this.config.conquerChance) {
            openPlanets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), openPlanets[0]);
        } else if (enemyPlanets.length && Math.random() < this.config.attackChance) {
            enemyPlanets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), enemyPlanets[0]);
        } else if (planets.length && Math.random() < this.config.transferChance) {
            planets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), planets[0]);
        }
    }
}

class AIPlayer2 extends AIPlayerBase {
    tick(ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        // TODO: better to use collision tree or graph search?
        const tree = new QuadTree<Planet>(3);
        this.game.planets.forEach(p => tree.insert(p, constants.planetRadius));

        const someSatellites = (sats: Satellite[]) =>
            sats.slice(0, Math.max(Math.random() * sats.length, this.config.minSatellites));

        const myPlanets = this.game.planets.filter(e => e.owner === this);
        if (myPlanets.length === this.game.planets.length) {
            return;
        }
        for (const planet of myPlanets) {
            const sats = this.selection(planet);
            if (sats.length < this.config.minSatellites) {
                continue;
            }

            let targets: Planet[] = [];
            let searchRadius = constants.planetRadius;
            while (targets.length < 1) {
                tree.query(planet.position, searchRadius, p => {
                    if (p.owner !== planet.owner) {
                        targets.push(p);
                    }
                });
                searchRadius *= 1.5;
            }

            const openPlanets = targets.filter(p => !p.owner);
            const enemyPlanets = targets.filter(p => p.owner && p.owner !== this);
            const planetScore = (a: Planet, b: Planet) => (
                (distSqr(a.position, planet.position) - distSqr(b.position, planet.position))
            );

            if (planet.level < planet.maxLevel && Math.random() < this.config.upgradeChance) {
                this.moveToPlanet(someSatellites(sats), planet);
            } else if(planet.health < 100 && Math.random() < this.config.healChance) {
                this.moveToPlanet(someSatellites(sats), planet);
            } else if(openPlanets.length && Math.random() < this.config.conquerChance) {
                openPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), openPlanets[0]);
            } else if (enemyPlanets.length && Math.random() < this.config.attackChance) {
                enemyPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), enemyPlanets[0]);
            } else if (myPlanets.length && Math.random() < this.config.transferChance) {
                myPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), myPlanets[0]);
            }
        }

        // should I upgrade?
        // should I expand into nearby open planets?
        // can I transfer units to the edge of my territory?
        // do I have enough satellites to attack a neighbour?
    }
}

interface NeighbourInfo {
    planet: Planet;
    distance: number;
}
interface PlanetInfo {
    planet: Planet,
    satellites: Satellite[];
    neighbours: NeighbourInfo[];
}
const buildGameBoard = (game: Game) => {
    const map = new Map<Planet, PlanetInfo>();
    for (const p1 of game.planets) {
        const neighbours: NeighbourInfo[] = [];
        for (const p2 of game.planets) {
            neighbours.push({
                planet: p2,
                distance: distSqr(p2.position, p1.position),
            });
        }
        neighbours.sort((a, b) => distSqr(p1.position, a.planet.position) - distSqr(p1.position, b.planet.position));

        const radius = p1.orbitDistance * 1.6;
        const radiusSqr = radius * radius;
        const satellites = [];
        game.collisionTree.query(p1.position, radius, sat => {
            if (distSqr(sat.position, p1.position) < radiusSqr) {
                satellites.push(sat);
            }
        })
        map.set(p1, { planet: p1, neighbours, satellites });
    }
    return map;
};

class AIPlayer3 extends AIPlayerBase {
    tick(ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        // TODO: better to use collision tree or graph search?
        const tree = new QuadTree<Planet>(3);
        this.game.planets.forEach(p => tree.insert(p, constants.planetRadius));

        const someSatellites = (sats: Satellite[]) =>
            sats.slice(0, Math.max(Math.random() * sats.length, this.config.minSatellites));

        const myPlanets = this.game.planets.filter(e => e.owner === this);
        if (myPlanets.length === this.game.planets.length) {
            return;
        }

        const gameBoard = buildGameBoard(this.game);
        for (const info of gameBoard.values()) {
            if (info.planet.owner && info.planet.owner !== this) {
                // not my planet
                continue;
            }

            // as we get closer to minSatellites, we get closer to making a move
            const mySats = info.satellites.filter(sat => sat.owner === this);
            if (Math.random() > (mySats.length / this.config.minSatellites)) {
                continue;
            }

            const maxGap = (a: number, b: number) => Math.max(a, b - a);
            const score = ({ distance, planet }: NeighbourInfo) =>
                (distance === 0 ? 1 : (1 / distance)) * (
                    (1 * (planet.owner === this && planet.health < 100 ? maxGap(100 - planet.health, mySats.length) : 0)) +
                    (4 * (planet.owner === this && planet.level < planet.maxLevel ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (6 * (planet.candidateOwner === this ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (2 * (planet.candidateOwner !== this ? -planet.upgrade : 0)) +
                    (.25 * (!planet.owner ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (2 * (!planet.owner ? planet.maxLevel : 0)) +
                    (4 * (planet.owner !== this ? (mySats.length - gameBoard.get(planet).satellites.length) : 0)) +
                    0
                );
            const nn = Array.from(info.neighbours).sort((a, b) => score(b) - score(a));
            this.moveToPlanet(someSatellites(mySats), nn[0].planet);
        }
    }
}

export function generateAiPlayers(game: Game) {
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
    return [
        new AIPlayer(game, 'red', aiStats),
        new AIPlayer(game, 'orange', aiStats),
        new AIPlayer3(game, 'yellow', aiStats),
        new AIPlayer2(game, 'green', aiStats),
        new AIPlayer(game, 'blue', aiStats),
        new AIPlayer(game, 'violet', aiStats),
        new AIPlayer2(game, 'pink', aiStats),
    ];
}

interface WorldConfig {
    worldSize: number;
    level3Planets: number;
    level2Planets: number;
    level1Planets: number;
}
function generateRandomCircleWorld(game: Game, { worldSize, level3Planets, level2Planets, level1Planets }: WorldConfig) {
    const planets: Planet[] = [];
    const minDistance = constants.planetRadius * constants.planetRadius * 4;
    const worldSize2x = worldSize * 2;
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

    for (let i = 0; i < level3Planets; i++) {
        const angle = Math.PI * 2 * (i / level3Planets);
        const position = point(Math.cos(angle) * worldSize, Math.sin(angle) * worldSize);
        planets.push(new Planet(game, position, 3));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    for (let i = 0; i < level2Planets; i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 2));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    for (let i = 0; i < level1Planets; i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 1));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    return planets;
}

function setupWorld(game: Game) {
    game.planets = generateRandomCircleWorld(game, {
        worldSize: 1000,
        level3Planets: game.players.length,
        level2Planets: game.players.length / 2,
        level1Planets: game.players.length,
    });
    game.players.forEach((player, i) => game.planets[i].capture(player));

    // add 100 satelliets to each planet
    const initialSatellites = 100;
    for (let i = 0; i < initialSatellites; i++){
        game.pulse();
    }
}

export interface GameMap {
    props: {
        name: string,
    },
    planets: {
        ownerTeam?: Team,
        initialSatellies: number,
        level: PlanetLevel,
        maxLevel: PlanetLevel,
        position: Point,
    }[],
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

export interface World {
    planets: Planet[];
    players: Player[];
}
export class Game {
    private snapshot: GameStateSnapshot;
    private satId = 0;

    planets: Planet[] = [];
    players: Player[] = [];
    readonly stats = new Stats();
    readonly log: GameStateSnapshot[] = [];
    readonly config = constants;
    readonly satellites = new ArrayPool(() => new Satellite(`s${this.satId++}`));
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
    private resetGamestate() {
        this.state.elapsedMS = 0;
        this.state.log = null;
        this.state.removed.clear();
    }

    constructor(private initializeWorld: (game: Game) => void = setupWorld) {
        this.players = generateAiPlayers(this);
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
        this.resetGamestate();
        if (!this.state.running) {
            return this.state;
        }
        this.stats.clear();

        const gameTime = this.stats.now();
        const elapsedMS = time * this.config.gameSpeed;
        this.state.gameTimeMS += elapsedMS;
        this.state.elapsedMS = elapsedMS;
        if (this.state.gameTimeMS < 0) {
            return this.state;
        }

        this.collisionTree.clean();

        const moveTimer = this.stats.now();
        this.planets.forEach(planet => planet.tick(elapsedMS));
        this.satellites.forEach(sat => {
            const collideTime = this.stats.now();
            this.collisionTree.insert(sat, constants.satelliteRadius);
            this.stats.collideTime += this.stats.elapsed(collideTime);
            sat.tick(elapsedMS);
        });
        this.stats.moveTime = this.stats.elapsed(moveTimer) - this.stats.collideTime;

        // needs to be after satellites tick otherwise the quad tree explodes
        const thinkTime = this.stats.now();
        this.players.forEach(player => {
            let timer = this.stats.now();
            player.tick(elapsedMS);
            this.stats.recordPlayerStat(timer, player.team, this.stats.playerTime);
        });
        this.stats.thinkTime += this.stats.elapsed(thinkTime);

        const collideTime = this.stats.now();
        this.collisionTree.walk(sats => this.collide(sats, constants.satelliteRadius));
        this.stats.collideTime += this.stats.elapsed(collideTime);

        // pulse is the last thing we do because planets could have changed ownership during collision detection
        const seconds = Math.floor(this.state.gameTimeMS / 1000);
        if (seconds > this.state.lastPulseTime) {
            this.state.lastPulseTime = seconds;
            const pulseTime = this.stats.now();
            this.pulse();

            const map = this.snapshot.satelliteCounts;
            this.satellites.forEach(sat => map.set(sat.owner.team, (map.get(sat.owner.team) ?? 0) + 1));
            this.state.log = this.snapshot;
            this.log.push(this.snapshot);
            this.snapshot = createSnapshot(seconds);
            this.stats.pulseTime = this.stats.elapsed(pulseTime);
        }

        this.stats.gameTime = this.stats.elapsed(gameTime);
        return this.state;
    }

    private collide(satellites: Satellite[], radius: number) {
        const r2 = radius * radius;
        for (let i = 0; i < satellites.length; i++) {
            for (let j = i; j < satellites.length; j++) {
                let sat1 = satellites[i];
                let sat2 = satellites[j];
                if (sat1.owner === sat2.owner) {
                    continue;
                }

                const distTimer = this.stats.now();
                const dist = distSqr(sat1.position, sat2.position);
                this.stats.recordCollide(distTimer, 'distance');

                if (dist < r2) {
                    sat1.destroy();
                    sat2.destroy();
                }
            }
        }
    }

    moveSatellites(player: Player, satellites: Satellite[], point: Point) {
        const playerSatellites = satellites.filter(e => e.owner === player);
        for (const planet of this.planets) {
            if (distSqr(planet.position, point) < 1600) {
                playerSatellites.forEach(s => s.mover = new MoveSequence([
                    new PointMover(planet.position),
                    new PlanetMover(s, planet),
                    new OrbitMover(planet),
                ]));
                return;
            }
        }
        playerSatellites.forEach(s => s.mover = new MoveSequence([
            new PointMover(point),
            new OrbitMover({ orbitDistance: Math.random() * 20, position: point }),
        ]));
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
        const sat = this.satellites.take().init(planet.owner, planet.position);
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
        this.level = 1;
        this._candidateOwner = null;
        this._owner = owner;
    }

    tick(elapsedMS: number) {
        this._rotation += this.rotationSpeed * elapsedMS;
    }

    hit(sat: Satellite) {
        // kind of a mess...
        if (!this.owner) {
            if (!this._candidateOwner) {
                this._candidateOwner = sat.owner;
            }
            this._upgrade += (this._candidateOwner === sat.owner) ? 1 : -1;
            sat.destroy();

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
                sat.destroy();
            } else if (this._health < 100) {
                this._health += 1;
                sat.destroy();
            }
            if (this._upgrade === 100) {
                this.game.recordEvent({ type: 'planet-upgrade', team: this.owner.team });
                this.level += 1;
                this._upgrade = 0;
            }
        } else {
            this._health -= 1;
            sat.destroy();
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
            this.planet.hit(this.satellite);
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

function applySpringForce(moveable: Moveable, x: number, y: number, rate: number) {
    // https://medium.com/unity3danimation/simple-physics-based-motion-68a006d42a18
    let dirX = x - moveable.position.x;
    let dirY = y - moveable.position.y;
    const normalizer = 1 / Math.sqrt(dirX * dirX + dirY * dirY);
    dirX *= normalizer;
    dirY *= normalizer;

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
        applySpringForce(moveable,
            Math.cos(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.x + this.positionNoise.x,
            Math.sin(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.y + this.positionNoise.x,
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
    mover: Mover;
    rotation = 0;
    gfx: Renderable;
    readonly type = 'Satellite';
    readonly size = 1;
    readonly position: Point = originPoint();
    readonly velocity: Point = originPoint();
    readonly owner: Player;

    private rotationSpeed: number;

    constructor(readonly id: string) {}

    init(owner: Player, position: Point) {
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
        self.velocity = point(Math.cos(angle) * speed, Math.sin(angle) * speed);
        return this;
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

    destroy() {
        const game = this.owner.game;
        const filter = game.stats.now();
        const released = game.satellites.release(this);
        game.stats.recordCollide(filter, 'filter');
        if (released) {
            this.gfx?.destroy();
            game.state.removed.add(this);
        }
    }
}
