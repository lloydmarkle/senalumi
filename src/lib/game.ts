import { hex, hsl } from 'color-convert';
import { ArrayPool, distSqr, originPoint, point, copyPoint, QuadTree, type Point } from './math';

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
    // sprite is (currently) 300px
    planetRadius: 150,
};

const flashPool = new ArrayPool(() => new Flash());

export type Team = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';

type CollisionStages = 'distance' | 'filter' | 'remove';
type TeamStats = { [key in Team]?: number };
class Stats {
    public collisionStages: { [key in CollisionStages]?: number } = {};
    public playerTime: TeamStats = {};
    public moveTime: number;
    public collideTime: number;
    public pulseTime: number;
    public thinkTime: number;
    public gameTime: number;

    now() {
        return performance.now();
    }

    recordCollide(start: number, stage: CollisionStages) {
        this.collisionStages[stage] = (this.collisionStages[stage] ?? 0) + (performance.now() - start);
    }

    recordPlayerStat(start: number, team: Team, field: TeamStats) {
        field[team] = (field[team] ?? 0) + (performance.now() - start);
    }

    elapsed(start: number) {
        return performance.now() - start;
    }

    clear() {
        this.collisionStages = {};
        this.playerTime = {};
        this.thinkTime = this.moveTime = this.gameTime = this.collideTime = this.pulseTime = 0;
    }
}

interface Renderable {
    render: Function;
    destroy: Function;
}

export const setLightness = (color: number, lightness: number) => {
    const c = hex.hsl(color.toString(16));
    c[2] = lightness;
    return parseInt(hsl.hex(c), 16);
}

export abstract class Player {
    readonly satelliteColor: number;
    constructor(readonly game: Game, readonly id: Team, readonly color: number) {
        this.color = setLightness(color, 50);
        this.satelliteColor = setLightness(color, 75);
    }

    abstract tick(ms: number): void;

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

class HumanPlayer extends Player {
    tick(ms: number) {
    }
}

interface AIConfig {
    // time between evaluating the map
    thinkTimeMS: number;
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
class AIPlayer extends Player {
    private elapsedFromLastThink: number;
    constructor(game: Game, id: Team, color: number, readonly config: AIConfig) {
        super(game, id, color);
    }

    tick(ms: number) {
        this.elapsedFromLastThink += ms;
        if (this.elapsedFromLastThink < this.config.thinkTimeMS) {
            return;
        }
        this.elapsedFromLastThink = 0;

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

    private moveToPlanet(satellites: Satellite[], planet: Planet) {
        satellites.forEach(s => s.mover = new MoveSequence([
            [new PointMover(s, planet.position), () => arrived(s.position, planet.position)],
            [new PlanetMover(s, planet), () => arrived(s.position, planet.position)],
            [new OrbitMover(s, planet), () => false],
        ]));
    }
}

class AIPlayer2 extends Player {
    private elapsedFromLastThink: number;
    constructor(game: Game, id: Team, color: number, readonly config: AIConfig) {
        super(game, id, color);
    }

    tick(ms: number) {
        this.elapsedFromLastThink += ms;
        if (this.elapsedFromLastThink < this.config.thinkTimeMS) {
            return;
        }
        this.elapsedFromLastThink = 0;

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

    private moveToPlanet(satellites: Satellite[], planet: Planet) {
        satellites.forEach(s => s.mover = new MoveSequence([
            [new PointMover(s, planet.position), () => arrived(s.position, planet.position)],
            [new PlanetMover(s, planet), () => arrived(s.position, planet.position)],
            [new OrbitMover(s, planet), () => false],
        ]));
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
                distance: Math.sqrt(distSqr(p2.position, p1.position)),
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

class AIPlayer3 extends Player {
    private elapsedFromLastThink: number;
    constructor(game: Game, id: Team, color: number, readonly config: AIConfig) {
        super(game, id, color);
    }

    tick(ms: number) {
        this.elapsedFromLastThink += ms;
        if (this.elapsedFromLastThink < this.config.thinkTimeMS) {
            return;
        }
        this.elapsedFromLastThink = 0;

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
                    (1 * (planet.owner === this && planet.health < 100 ? maxGap(100 - planet.health, mySats.length) : -1)) +
                    (4 * (planet.owner === this && planet.level < planet.maxLevel ? maxGap(planet.upgrade, mySats.length) : -1)) +
                    (6 * (planet.candidateOwner === this ? maxGap(planet.upgrade, mySats.length) : -1)) +
                    (2 * (planet.candidateOwner !== this ? -planet.upgrade : 0)) +
                    (.25 * (!planet.owner ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (1 * (!planet.owner ? planet.maxLevel : 0)) +
                    (4 * (planet.owner !== this ? (mySats.length - gameBoard.get(planet).satellites.length) : 0)) +
                    0
                );
            const nn = Array.from(info.neighbours).sort((a, b) => score(b) - score(a));
            this.moveToPlanet(someSatellites(mySats), nn[0].planet);
        }
    }

    private moveToPlanet(satellites: Satellite[], planet: Planet) {
        satellites.forEach(s => s.mover = new MoveSequence([
            [new PointMover(s, planet.position), () => arrived(s.position, planet.position)],
            [new PlanetMover(s, planet), () => arrived(s.position, planet.position)],
            [new OrbitMover(s, planet), () => false],
        ]));
    }
}

const generateWorld = (game: Game, colours: number, worldSize: number) => {
    const planets = [];
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

    for (let i = 0; i < colours; i++) {
        const angle = Math.PI * 2 * (i / colours);
        const position = point(Math.cos(angle) * worldSize, Math.sin(angle) * worldSize);
        planets.push(new Planet(game, position, 3));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    // for (let i = 0; i < (colours * 0.5); i++) {
    for (let i = 0; i < 10; i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 2));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    // for (let i = 0; i < colours; i++) {
    for (let i = 0; i < 10; i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 1));
        tree.insert(planets[planets.length - 1], constants.planetRadius);
    }
    return  planets;
}

interface GameEvent {
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

export class Game {
    private state = {
        completed: false,
        pulsed: false,
    };
    stats = new Stats();
    private snapshot: GameStateSnapshot;
    readonly log: GameStateSnapshot[] = [];
    readonly constants = constants;
    flashes: Flash[];
    planets: Planet[];
    satellites = new ArrayPool(() => new Satellite());
    players: Player[];
    gameTime = 0.0;
    lastTick = 0.0;
    pulsed = 0;
    paused = false;
    collisionTree = new QuadTree<Satellite>(quadTreeBoxCapacity);

    constructor() {
        this.flashes = [];
        this.snapshot = createSnapshot(0);

        const aiStats: AIConfig = {
            thinkTimeMS: 10000,
            minSatellites: 110,
            healChance: 0.95,
            attackChance: 0.40,
            conquerChance: 0.55,
            transferChance: 0.85,
            upgradeChance: 0.45,
        };
        this.players = [
            new AIPlayer(this, 'red', 0xD2042D, aiStats),
            new AIPlayer3(this, 'yellow', 0xFFF44F, aiStats),
            new AIPlayer(this, 'orange', 0xCC5500, aiStats),
            new AIPlayer2(this, 'green', 0x7CFC00, aiStats),
            // new AIPlayer(this, 'blue', 0x1111DD, aiStats),
            new HumanPlayer(this, 'blue', 0x1111DD),
            new AIPlayer(this, 'violet', 0x7F00FF, aiStats),
            new AIPlayer2(this, 'pink', 0xFF10F0, aiStats),
        ]

        this.planets = generateWorld(this, this.players.length, 1000);
        this.players.forEach((player, i) => this.planets[i].capture(player));

        const initialSatellites = 100;
        // const initialSatellites = maxSatellites;
        for (let i = 0; i < initialSatellites; i++){
            this.pulse();
        }
    }

    tick(ms: number) {
        this.state.pulsed = false;

        if (this.paused) {
            return this.state;
        }
        const elapsedMS = ms * constants.gameSpeed;
        this.gameTime = this.gameTime + elapsedMS;
        this.stats.clear();
        const gameTime = this.stats.now();

        const seconds = Math.floor(this.gameTime / 1000);
        if (seconds > this.lastTick) {
            this.lastTick = seconds;
            this.pulse();
            this.state.pulsed = true;

            const map = this.snapshot.satelliteCounts;
            this.satellites.forEach(sat => map.set(sat.owner.id, (map.get(sat.owner.id) ?? 0) + 1));
            this.log.push(this.snapshot);
            this.snapshot = createSnapshot(seconds);
        }

        this.collisionTree.clean();

        const moveTimer = this.stats.now();
        this.planets.forEach(planet => planet.tick(elapsedMS));
        this.flashes.forEach(flash => flash.tick(elapsedMS));
        this.satellites.forEach(sat => {
            if (sat.position.x < -constants.maxWorld || sat.position.x > constants.maxWorld || sat.position.y < -constants.maxWorld || sat.position.y > constants.maxWorld) {
                this.destroy(sat);
            }
            const collideTime = this.stats.now();
            this.collisionTree.insert(sat, constants.satelliteRadius);
            this.stats.collideTime += this.stats.elapsed(collideTime);
            sat.tick(elapsedMS);
        });
        this.stats.moveTime = this.stats.elapsed(moveTimer) - this.stats.collideTime;

        // needs to be after satellites otherwise the quad trees explode
        // TODO: don't throw away trees every frame? (high gc load?)
        const thinkTime = this.stats.now();
        this.players.forEach(player => {
            let timer = this.stats.now();
            player.tick(elapsedMS);
            this.stats.recordPlayerStat(timer, player.id, this.stats.playerTime);
        });
        this.stats.thinkTime += this.stats.elapsed(thinkTime);

        const collideTime = this.stats.now();
        this.collisionTree.walk(sats => this.collide(sats, constants.satelliteRadius));
        this.stats.collideTime += this.stats.elapsed(collideTime);

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
                    this.destroy(sat1);
                    this.destroy(sat2);
                }
            }
        }
    }

    moveSatellites(player: Player, satellites: Satellite[], point: Point) {
        const playerSatellites = satellites.filter(e => e.owner === player);
        for (const planet of this.planets) {
            if (arrived(planet.position, point)) {
                playerSatellites.forEach(s => s.mover = new MoveSequence([
                    [new PointMover(s, planet.position), () => arrived(s.position, planet.position)],
                    [new PlanetMover(s, planet), () => arrived(s.position, planet.position)],
                    [new OrbitMover(s, planet), () => false],
                ]));
                return;
            }
        }
        playerSatellites.forEach(s => s.mover = new MoveSequence([
            [new PointMover(s, point), () => arrived(s.position, point)],
            [new OrbitMover(s, { orbitDistance: Math.random() * 20, position: point }), () => false],
        ]));
    }

    private pulse() {
        const pulseTime = this.stats.now();
        this.planets.forEach(planet => {
            if (planet.owner) {
                for (let i = 0; i < planet.level * constants.pulseRate; i++) {
                    this.spawnSatellite(planet);
                }
            }
        });
        this.stats.pulseTime = this.stats.elapsed(pulseTime);
    }

    private spawnSatellite(planet: Planet) {
        if (this.satellites.length >= constants.maxSatellites) {
            return;
        }
        const sat = this.satellites.take().init(planet.owner, planet.position);
        sat.mover = new OrbitMover(sat, planet);
    }

    recordEvent(ev: GameEvent) {
        this.snapshot.events.push(ev);
    }

    destroy(satellite: Satellite) {
        const filter = this.stats.now();
        const released = this.satellites.release(satellite);
        if (released) {
            satellite.destroy?.();
        }
        this.stats.recordCollide(filter, 'filter');

        const remove = this.stats.now();
        this.flashes.push(flashPool.take().init(this, satellite.position, satellite.velocity));
        this.stats.recordCollide(remove, 'remove');
    }
}

type PlanetLevel = 0 | 1 | 2 | 3 | 4;
class Planet implements Renderable {
    private _candidateOwner?: Player;
    private _owner?: Player;
    private _rotation: number = Math.random() * Math.PI * 2;
    private rotationSpeed = Math.PI / 10000;
    private _health: number = 100;
    private _upgrade: number = 0;

    render: Function;
    destroy: Function;
    level: PlanetLevel = 0;
    get rotation() { return this._rotation; }
    get owner(): Player | undefined { return this._owner; }
    get candidateOwner(): Player | undefined { return this._candidateOwner; }
    // value between 0 and 1
    get radius() { return (this.level / 8) + .5; }
    get orbitDistance() { return this.radius * constants.planetRadius; }
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
            this.game.destroy(sat);

            if (this._upgrade === 0) {
                this._candidateOwner = null;
            }
            if (this._upgrade === 100) {
                this.capture(this._candidateOwner);
                this.game.recordEvent({ type: 'planet-capture', team: this.owner.id });
            }
        } else if (sat.owner === this.owner) {
            if (this.level < this.maxLevel && this._health === 100) {
                this._upgrade += 1;
                this.game.destroy(sat);
            } else if (this._health < 100) {
                this._health += 1;
                this.game.destroy(sat);
            }
            if (this._upgrade === 100) {
                this.game.recordEvent({ type: 'planet-upgrade', team: this.owner.id });
                this.level += 1;
                this._upgrade = 0;
            }
        } else {
            this._health -= 1;
            this.game.destroy(sat);
            if (this._health === 0) {
                this.game.recordEvent({ type: 'planet-lost', team: this.owner.id });
                this.capture(null);
                this.level = 0;
            }
        }
    }
}

const arrived = (a: Point, b: Point) => {
    return distSqr(a, b) < 400;
}

interface Mover {
    evaluate(elapsedMS: number): Mover;
}

type Mission = 'hurt' | 'heal' | 'take' | 'upgrade' | 'none' | 'move';
class PlanetMover implements Mover {
    private mission: Mission;
    private planetLevel: PlanetLevel;
    constructor(readonly satellite: Satellite, readonly planet: Planet) {
        this.planetLevel = planet.level;
        this.mission = this.computeMission();
    }

    evaluate(elapsedMS: number) {
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

class NullMover implements Mover {
    evaluate(elapsedMS: number) {
        return this;
    }
}
const nullMover = new NullMover();

class OrbitMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 * 0.00005 + (Math.PI * 2 * 0.00003);
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private positionNoise = targetOffsetNoise();
    private moveNoise = moveNoise();
    constructor(readonly satellite: Satellite, readonly orbit: { orbitDistance: number, position: Point }) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed * elapsedMS;
        this.satellite.updateVelocity(
            Math.cos(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.x + this.positionNoise.x,
            Math.sin(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.y + this.positionNoise.x,
            elapsedMS * this.moveNoise);
        return this;
    }
}

class PointMover implements Mover {
    private moveNoise = moveNoise();
    private positionNoise = targetOffsetNoise();
    constructor(readonly satellite: Satellite, readonly target: Point) {}

    evaluate(elapsedMS: number) {
        // why compute this every frame? If this.target is a reference to a planet, then
        // the planet could be moving so we have a moving target
        this.satellite.updateVelocity(
            this.target.x + this.positionNoise.x,
            this.target.y + this.positionNoise.y,
            elapsedMS * this.moveNoise);
        return this;
    }
}

type MovePair = [Mover, () => boolean];
class MoveSequence implements Mover {
    constructor(readonly movers: MovePair[]) {}
    evaluate(elapsedMS: number) {
        if (this.movers[0][1]()) {
            this.movers.shift();
        }
        this.movers[0][0].evaluate(elapsedMS);
        return this;
    }
}

class Satellite implements Renderable {
    render: Function;
    destroy: Function;
    mover: Mover;
    readonly position: Point = originPoint();
    readonly velocity: Point = originPoint();
    readonly owner: Player;

    constructor() {}

    init(owner: Player, position: Point) {
        this.render = null;
        this.destroy = null;
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
        this.mover = this.mover.evaluate(elapsedMS);
        this.position.x += this.velocity.x * elapsedMS;
        this.position.y += this.velocity.y * elapsedMS;
    }

    updateVelocity(x: number, y: number, rate: number) {
        // https://medium.com/unity3danimation/simple-physics-based-motion-68a006d42a18
        let dirX = x - this.position.x;
        let dirY = y - this.position.y;
        const normalizer = 1 / Math.sqrt(dirX * dirX + dirY * dirY);
        dirX *= normalizer;
        dirY *= normalizer;

        let vx = dirX * constants.maxSatelliteVelocity;
        let vy = dirY * constants.maxSatelliteVelocity;

        this.velocity.x += (constants.forceStiffness * dirX + constants.forceDamping * (vx - this.velocity.x)) * rate;
        this.velocity.y += (constants.forceStiffness * dirY + constants.forceDamping * (vy - this.velocity.y)) * rate;
    }
}

class Flash implements Renderable {
    private rotationSpeed = Math.random() * Math.PI / 200;
    private timeleftMS: number;
    size: number;
    alpha: number;
    rotation: number = Math.random() * Math.PI * 2;
    render: Function;
    destroy: Function;

    readonly game: Game;
    readonly position = originPoint();
    readonly velocity = originPoint();
    constructor() {}

    init(game: Game, position: Point, velocity: Point) {
        this.render = null;
        this.destroy = null;
        this.size = 1;
        this.alpha = 1;
        this.timeleftMS = (Math.random() * 300 + 200) * 1;

        (this as any).game = game;
        copyPoint(position, this.position);
        copyPoint(velocity, this.velocity);
        return this;
    }

    tick(elapsedMS: number) {
        this.timeleftMS -= elapsedMS;
        if (this.timeleftMS < 0) {
            flashPool.release(this);
            this.destroy();
            this.game.flashes = this.game.flashes.filter(e => e !== this);
        }

        this.alpha -= 0.001 * elapsedMS;
        this.size += 0.005 * elapsedMS;
        this.rotation += this.rotationSpeed * elapsedMS;
        this.position.x += this.velocity.x * elapsedMS;
        this.position.y += this.velocity.y * elapsedMS;
    }
}