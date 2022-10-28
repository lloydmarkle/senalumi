import { copyPoint, distSqr, normalizeVector, originPoint, point, scaleVector, QuadTree, type Point } from "./math";
import { hex, hsl } from 'color-convert';

const pulseRate = 1; // stars per pulse
const minWorld = -10000;
const maxWorld = 10000;
const gameSpeed = 12;
const maxSatelliteVelocity = 0.015;
const maxSatellites = 10000;
const forceStiffness = 0.0000005;
const forceDamping = 0.0004;
// sprite is (currently) 300px
const planetRadius = 150;
const satelliteRadius = 8;
const quadTreeBoxCapacity = 10;
const moveNoise = () => Math.random() * 1.2 + 0.8;
const targetOffsetNoise = () => point(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10);
export const constants = { maxSatelliteVelocity, maxSatellites, forceStiffness, forceDamping, gameSpeed, satelliteRadius, planetRadius, pulseRate };

export type Team = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';

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
    readonly satelliteTree = new QuadTree<Satellite>(quadTreeBoxCapacity);
    readonly satelliteColor: number;
    constructor(readonly game: Game, readonly id: Team, readonly color: number) {
        this.color = setLightness(color, 50);
        this.satelliteColor = setLightness(color, 75);
    }

    abstract tick(ms: number): void;

    selection(planet: Planet) {
        const radiusSqr = planetRadius * planetRadius;
        const sats = this.satelliteTree.query(planet.position, planetRadius * 1.3)
            .filter(sat => distSqr(sat.position, planet.position) < radiusSqr);
        return sats;
    }

    updateSatelitteTree(radius: number) {
        this.satelliteTree.clean();
        this.game.satellites.forEach(sat => {
            if (sat.owner === this) {
                this.satelliteTree.insert(sat, radius);
            }
        });
    };
}

class HumanPlayer extends Player {
    tick(ms: number) {
        this.updateSatelitteTree(satelliteRadius);
    }
}

interface AIConfig {
    // time between evaluating the map
    thinkTimeMS: number;
    // min satellites before moving
    minSatellies: number;
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
        this.updateSatelitteTree(satelliteRadius);

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
            if (sats.length > this.config.minSatellies) {
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

const generateWorld = (game: Game, colours: number, worldSize: number) => {
    const planets = [];
    const minDistance = planetRadius * planetRadius * 4;
    const worldSize2x = worldSize * 2;
    const tree = new QuadTree<Planet>(1);
    const positionPlanet = () => {
        while (true)  {
            let position = point(Math.random() * worldSize2x - worldSize, Math.random() * worldSize2x - worldSize);
            const dists = tree.query(position, planetRadius).map(e => distSqr(position, e.position));
            if (dists.every(d => d > minDistance)) {
                return position;
            }
        }
    };

    for (let i = 0; i < colours; i++) {
        const angle = Math.PI * 2 * (i / colours);
        const position = point(Math.cos(angle) * worldSize, Math.sin(angle) * worldSize);
        planets.push(new Planet(game, position, 3));
        tree.insert(planets[planets.length - 1], planetRadius);
    }
    for (let i = 0; i < (colours * 0.5); i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 2));
        tree.insert(planets[planets.length - 1], planetRadius);
    }
    for (let i = 0; i < colours; i++) {
        const position = positionPlanet();
        planets.push(new Planet(game, position, 1));
        tree.insert(planets[planets.length - 1], planetRadius);
    }
    return  planets;
}

export class Game {
    flashes: Flash[];
    planets: Planet[];
    satellites: Satellite[];
    players: Player[];
    gameTime = 0.0;
    lastTick = 0.0;
    pulsed = 0;
    paused = false;
    readonly constants = constants;

    constructor() {
        this.flashes = [];
        this.satellites = [];

        const aiStats: AIConfig = {
            thinkTimeMS: 10000,
            minSatellies: 120,
            healChance: 0.95,
            attackChance: 0.40,
            conquerChance: 0.45,
            transferChance: 0.85,
            upgradeChance: 0.65,
        };
        this.players = [
            // new HumanPlayer('blue', 0xDE3163),
            new AIPlayer(this, 'red', 0xD2042D, aiStats),
            new AIPlayer(this, 'orange', 0xCC5500, aiStats),
            new AIPlayer(this, 'yellow', 0xFFF44F, aiStats),
            new AIPlayer(this, 'green', 0x7CFC00, aiStats),
            new AIPlayer(this, 'blue', 0x1111DD, aiStats),
            new AIPlayer(this, 'violet', 0x7F00FF, aiStats),
            new AIPlayer(this, 'pink', 0xFF10F0, aiStats),
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
        if (this.paused) {
            return;
        }
        const elapsedMS = ms * gameSpeed;
        this.gameTime = this.gameTime + elapsedMS;

        const seconds = Math.floor(this.gameTime / 1000);
        if (seconds > this.lastTick) {
            this.lastTick = seconds;
            this.pulse();
        }

        for (const flash of this.flashes) {
            flash.tick(elapsedMS);
        }
        for (const sat of this.satellites) {
            if (sat.position.x < minWorld || sat.position.x > maxWorld || sat.position.y < minWorld || sat.position.y > maxWorld) {
                console.warn('sat oob', sat);
                this.destroy(sat);
                continue;
            }
            sat.tick(elapsedMS);
        }
        for (const planet of this.planets) {
            planet.tick(elapsedMS);
        }

        // needs to be after satellites otherwise the quad trees explode
        // TODO: don't throw away trees every frame? (high gc load?)
        for (const player of this.players) {
            player.tick(elapsedMS);
        }

        for (const sat of this.satellites) {
            for (const player of this.players) {
                if (player === sat.owner) {
                    continue;
                }
                this.collideSatellites(sat, satelliteRadius, player.satelliteTree);
            }
        }
    }

    private collideSatellites(satellite: Satellite, radius: number, qt: QuadTree<Satellite>) {
        const r2 = radius * radius;
        const nearbySatellites = qt.query(satellite.position, radius);
        for (const sat of nearbySatellites) {
            if (distSqr(sat.position, satellite.position) < r2) {
                this.destroy(sat);
                this.destroy(satellite)
                return;
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
        if (this.satellites.length >= maxSatellites) {
            return;
        }
        for (const planet of this.planets) {
            if (planet.owner) {
                for (let i = 0; i < planet.level * pulseRate; i++) {
                    this.spawnSatellite(planet);
                }
            }
        }
    }

    private spawnSatellite(planet: Planet) {
        const sat = new Satellite(planet.owner, planet.position);
        sat.mover = new OrbitMover(sat, planet);
        this.satellites.push(sat);
    }

    destroy(satellite: Satellite) {
        this.satellites = this.satellites.filter(s => s !== satellite);
        this.flashes.push(new Flash(this, satellite.position, satellite.velocity));
        satellite.destroy?.();
    }
}

type PlanetLevel = 0 | 1 | 2 | 3 | 4;
class Planet implements Renderable {
    private _candidateOwner?: Player;
    private _owner?: Player;
    private _rotation: number = Math.random() * Math.PI * 2;
    private rotationSpeed = Math.PI / 80000;
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
    get orbitDistance() { return this.radius * planetRadius; }
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
                this.level += 1;
                this._upgrade = 0;
            }
        } else {
            this._health -= 1;
            this.game.destroy(sat);
            if (this._health === 0) {
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

type Missions = 'hurt' | 'heal' | 'take' | 'upgrade' | 'none';
class PlanetMover implements Mover {
    private mission: Missions;
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

    private computeMission(): Missions {
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

class OrbitMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 * 0.000025 + (Math.PI * 2 * 0.00001);
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private positionNoise = targetOffsetNoise();
    private moveNoise = moveNoise();
    constructor(readonly satellite: Satellite, readonly orbit: { orbitDistance: number, position: Point }) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed * elapsedMS;
        const target = point(
            Math.cos(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.x + this.positionNoise.x,
            Math.sin(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.y + this.positionNoise.x);
        this.satellite.updateVelocity(target, elapsedMS * this.moveNoise);
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
        const target = point(this.target.x + this.positionNoise.x, this.target.y + this.positionNoise.y);
        this.satellite.updateVelocity(target, elapsedMS * this.moveNoise);
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
    readonly position: Point;
    readonly velocity: Point;

    constructor(readonly owner: Player, position: Point) {
        this.owner = owner;
        this.position = copyPoint(position);
        const angle = Math.random() * Math.PI * 2;
        this.mover = new NullMover();
        const speed = Math.random() * maxSatelliteVelocity;
        this.velocity = point(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    tick(elapsedMS: number) {
        this.mover = this.mover.evaluate(elapsedMS);
        this.position.x += this.velocity.x * elapsedMS;
        this.position.y += this.velocity.y * elapsedMS;
    }

    updateVelocity(target: Point, rate: number) {
        // https://medium.com/unity3danimation/simple-physics-based-motion-68a006d42a18
        const direction = point(target.x - this.position.x, target.y - this.position.y);
        normalizeVector(direction);

        const targetVelocity = copyPoint(direction);
        scaleVector(targetVelocity, maxSatelliteVelocity);

        this.velocity.x += (forceStiffness * direction.x + forceDamping * (targetVelocity.x - this.velocity.x)) * rate;
        this.velocity.y += (forceStiffness * direction.y + forceDamping * (targetVelocity.y - this.velocity.y)) * rate;
    }
}

class Flash implements Renderable {
    private rotationSpeed = Math.random() * Math.PI / 200;
    private timeleftMS = (Math.random() * 300 + 200) * 1;
    size: number = 1;
    alpha: number = 1;
    rotation: number = Math.random() * Math.PI * 2;
    render: Function;
    destroy: Function;
    constructor(readonly game: Game, readonly position: Point, readonly velocity: Point) {}

    tick(elapsedMS: number) {
        this.timeleftMS -= elapsedMS;
        if (this.timeleftMS < 0) {
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