import { copyPoint, distSqr, normalizeVector, originPoint, point, scaleVector, QuadTree, type Point } from "./math";

const gameSpeed = 1;
const maxSatelliteVelocity = 0.015;
const maxSatellites = 3000;
const forceStiffness = 0.0000005;
const forceDamping = 0.0004;
const moveNoise = () => Math.random() * 1.2 + 0.8;
const targetOffsetNoise = () => point(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10);
export const constants = { maxSatelliteVelocity, maxSatellites, forceStiffness, forceDamping, gameSpeed };

export type Team = 'red' | 'green' | 'blue';

interface Renderable {
    render: Function;
    destroy: Function;
}

class Player {
    readonly satelliteColor: number;
    constructor(readonly id: Team, readonly color: number) {
        this.satelliteColor  = color | 0x777777;
    }
}

interface AIConfig {
    // time between evaluating the map
    thinkTime: number;
    // move satellites between planets
    transferChance: number;
    // upgrade a planet
    upgradeChance: number;
    // attack the closest, weakest, enemy
    attackChance: number;
    // conquer a vacant planet
    conquerChance: number;
}
class AI {
    private elapsedFromLastThink: number
    constructor(readonly player: Player, readonly game: Game, readonly config: AIConfig) {}

    tick(ms: number) {
        this.elapsedFromLastThink += ms;
        if (this.elapsedFromLastThink < this.config.thinkTime) {
            return;
        }
        this.elapsedFromLastThink = 0;

        const satellites = this.game.satellites.filter(e => e.owner === this.player);
        const planets = this.game.planets.filter(e => e.owner === this.player);

        // Do I have enough satellites to conquer a planet?
        // Can I upgrade? Should I?
        // Do I have enough satellites to attack someone else?
        // Am I under attack and need to setup defense?
    }
}

export class Game {
    flashes: Flash[];
    planets: Planet[];
    satellites: Satellite[];
    players: Player[];
    gameTime = 0.0;
    lastTick = 0.0;
    pulsed = 0;

    constructor() {
        this.flashes = [];
        this.satellites = [];
        this.planets = [
            new Planet(this, point(0, 0), 3),
            new Planet(this, point(200, 600), 3),
            new Planet(this, point(600, 100), 3),
            new Planet(this, point(300, 300), 3),
        ];
        this.players = [
            new Player('blue', 0x0000aa),
            new Player('green', 0x00aa00),
            new Player('red', 0xaa0000),
        ];

        this.planets[0].capture(this.players[0]);
        this.planets[1].capture(this.players[1]);
        this.planets[2].capture(this.players[2]);

        const initialSatellites = 100;
        // const initialSatellites = maxSatellites;
        for (let i = 0; i < initialSatellites; i++){
            this.pulse();
        }
    }

    tick(ms: number) {
        const elapsedMS = ms * gameSpeed;
        this.gameTime = this.gameTime + elapsedMS;

        const seconds = Math.floor(this.gameTime / 1000);
        if (seconds > this.lastTick) {
            this.lastTick = seconds;
            this.pulse();
        }

        const radius = 8;
        const spaceTL = originPoint();
        const spaceBR = originPoint();
        for (const flash of this.flashes) {
            flash.tick(elapsedMS);
        }
        for (const sat of this.satellites) {
            sat.tick(elapsedMS);
            spaceTL.x = Math.min(spaceTL.x, sat.position.x - radius - 1);
            spaceTL.y = Math.min(spaceTL.y, sat.position.y - radius - 1);
            spaceBR.x = Math.max(spaceBR.x, sat.position.x + radius + 1);
            spaceBR.y = Math.max(spaceBR.y, sat.position.y + radius + 1);
        }
        for (const planet of this.planets) {
            planet.tick(elapsedMS);
        }

        // _way_ more efficient to use a separate tree per team
        // TODO: don't throw away trees every frame? (high gc load?)
        const treeSize = 10;
        const quadTrees = {
            'red': new QuadTree<Satellite>(spaceTL, spaceBR, treeSize),
            'green': new QuadTree<Satellite>(spaceTL, spaceBR, treeSize),
            'blue': new QuadTree<Satellite>(spaceTL, spaceBR, treeSize),
        }
        for (const sat of this.satellites) {
            quadTrees[sat.owner.id].insert(sat, radius);
        }

        for (const sat of this.satellites) {
            for (const [team, tree] of Object.entries(quadTrees)) {
                if (team === sat.owner.id) {
                    continue;
                }
                this.collideSatellites(sat, radius, tree);
            }
        }
    }

    private collideSatellites(satellite: Satellite, radius: number, qt: QuadTree<Satellite>) {
        const r2 = radius * radius;
        const nearbySatellites = qt.query(satellite, radius);
        for (const sat of nearbySatellites) {
            if (distSqr(sat.position, satellite.position) < r2) {
                this.destroy(sat);
                this.destroy(satellite)
                return;
            }
        }
    }

    moveSatellites(player: Player, satellites: Satellite[], point: Point) {
        for (const planet of this.planets) {
            const ds = distSqr(planet.position, point);
            if (ds < 400) {
                satellites.forEach(s => s.mover = new MoveSequence([
                    [new PointMover(s, planet.position), () => arrived(s, planet.position)],
                    [new PlanetMover(s, planet), () => arrived(s, planet.position)],
                    [new OrbitMover(s, planet), () => false],
                ]));
                return;
            }
        }
        satellites.forEach(s => s.mover = new MoveSequence([
            [new PointMover(s, point), () => arrived(s, point)],
            [new OrbitMover(s, { orbitDistance: Math.random() * 20, position: point }), () => false],
        ]));
    }

    private pulse() {
        if (this.satellites.length >= maxSatellites) {
            return;
        }
        for (const planet of this.planets) {
            if (planet.owner) {
                for (let i = 0; i < planet.level; i++) {
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

type PlanetLevel = 0 | 1 | 2 | 3;
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
    get radius() { return (this.level / 6) + .5; }
    // sprite is (currently) 300px
    get orbitDistance() { return this.radius * 150; }
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

const arrived = (sat: Satellite, point: Point) => {
    return distSqr(sat.position, point) < 400;
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