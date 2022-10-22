import { copyPoint, distSqr, normalizeVector, originPoint, point, scaleVector, vectorLength, type Point } from "./math";

const maxStarVelocity = 0.015;
const maxStars = 1000;
const forceStiffness = 0.0000005;
const forceDamping = 0.0004;
const moveNoise = () => Math.random() * 1.2 + 0.8;
const targetOffsetNoise = (): Point => ({
    x: Math.random() * 20 - 10,
    y: Math.random() * 20 - 10,
})
export const constants = { maxStarVelocity, maxStars, forceStiffness, forceDamping };

export type Team = 'red' | 'green' | 'blue';

interface Renderable {
    render: Function;
    destroy: Function;
}

class Player {
    readonly starColor: number;
    constructor(readonly id: Team, readonly color: number) {
        this.starColor  = color | 0x777777;
    }
}

// Mostly based on https://en.wikipedia.org/wiki/Quadtree
// but adapted for circles (xy + radius) based on some suggestions
// from https://gamedev.stackexchange.com/questions/175799
class QuadTree<T extends { position: Point }> {
    chidlren: QuadTree<T>[];
    data: T[] = [];
    constructor(readonly topLeft: Point, readonly bottomRight: Point, readonly capacity = 10) {
        if (topLeft.x > bottomRight.x || topLeft.y > bottomRight.y)  {
            throw ['invalid tree',topLeft,bottomRight]
        }
    }

    private contains(t: T, radius: number) {
        return (t.position.x - radius) > this.topLeft.x && (t.position.x + radius) < this.bottomRight.x
            && (t.position.y - radius) > this.topLeft.y && (t.position.y + radius) < this.bottomRight.y;
    }

    insert(t: T, radius: number) {
        if (!this.contains(t, radius)) {
            return false;
        }

        if (this.data.length < this.capacity) {
            this.data.push(t);
            return true;
        }

        this.subdivide(radius);
        return this.insertData(t, radius);
    }

    private insertData(t: T, radius: number) {
        let inserted = this.chidlren
            .reduce((acc, child) => acc = acc || child.insert(t, radius), false);
        if (!inserted) {
            // point stradles a boundary(?) so allow it to overfill this tree
            this.data.push(t);
        }
        return inserted;
    }

    private subdivide(radius: number) {
        if (this.chidlren) {
            return;
        }
        const { x: left, y: top } = this.topLeft;
        const { x: right, y: bottom } = this.bottomRight;
        const halfx = (left + right) / 2;
        const halfy = (top + bottom) / 2;
        this.chidlren = [
            new QuadTree({ x: left, y: top }, { x: halfx, y: halfy }),
            new QuadTree({ x: halfx, y: top }, { x: right, y: halfy }),
            new QuadTree({ x: halfx, y: halfy }, { x: right, y: bottom }),
            new QuadTree({ x: left, y: halfy }, { x: halfx, y: bottom }),
        ];

        // push points to children
        let data = this.data;
        this.data = [];
        for (const d of data) {
            this.insertData(d, radius);
        }
    }

    query(t: T, radius: number): T[] {
        const result: T[] = [];
        if (!this.contains(t, radius)) {
            return result;
        }

        this.appendPoints(result, t, radius);
        this.chidlren?.forEach(child => child.appendPoints(result, t, radius));
        return result;
    }

    private appendPoints(results: T[], t: T, radius: number) {
        if (!this.contains(t, radius)) {
            return;
        }
        const r2 = radius * radius;
        for (const d of this.data) {
            if (distSqr(d.position, t.position) < r2) {
                results.push(d);
            }
        }
    }
}

export class Game {
    flashes: Flash[];
    suns: Sun[];
    stars: Star[];
    players: Player[];
    gameTime = 0.0;
    lastTick = 0.0;
    pulsed = 0;
    qTree: QuadTree<Star>;

    constructor() {
        this.flashes = [];
        this.stars = [];
        this.suns = [
            new Sun(this, point(0, 0), 3),
            new Sun(this, point(200, 600), 3),
            new Sun(this, point(600, 100), 3),
            new Sun(this, point(300, 300), 3),
        ];
        this.players = [
            new Player('blue', 0x0000aa),
            new Player('green', 0x00aa00),
            new Player('red', 0xaa0000),
        ];

        this.suns[0].capture(this.players[0]);
        this.suns[1].capture(this.players[1]);
        this.suns[2].capture(this.players[2]);

        for (let i = 0; i < 100; i++){
            this.pulse();
        }
    }

    tick(elapsedMS: number) {
        this.gameTime = this.gameTime + elapsedMS;

        const seconds = Math.floor(this.gameTime / 1000);
        if (seconds > this.lastTick) {
            this.lastTick = seconds;
            this.pulse();
        }

        const radius = 5;
        const starSpaceTL = originPoint();
        const starSpaceBR = originPoint();
        for (const flash of this.flashes) {
            flash.tick(elapsedMS);
        }
        for (const star of this.stars) {
            star.tick(elapsedMS);
            starSpaceTL.x = Math.min(starSpaceTL.x, star.position.x - radius - 1);
            starSpaceTL.y = Math.min(starSpaceTL.y, star.position.y - radius - 1);
            starSpaceBR.x = Math.max(starSpaceBR.x, star.position.x + radius + 1);
            starSpaceBR.y = Math.max(starSpaceBR.y, star.position.y + radius + 1);
        }
        for (const sun of this.suns) {
            sun.tick(elapsedMS);
        }

        const qt = new QuadTree<Star>(starSpaceTL, starSpaceBR);
        this.qTree = qt;
        for (const star of this.stars) {
            qt.insert(star, radius);
        }

        for (const star of this.stars) {
            const nearbyStarts = qt.query(star, radius);
            for (const s of nearbyStarts) {
                if (s.owner !== star.owner) {
                    this.destroy(s);
                    this.destroy(star)
                    break;
                }
            }
        }
    }

    moveStars(player: Player, stars: Star[], point: Point) {
        for (const sun of this.suns) {
            const ds = distSqr(sun.position, point);
            if (ds < 400) {
                stars.forEach(s => s.mover = new MoveSequence(s, [
                    [new PointMover(s, sun.position), () => arrived(s, sun.position)],
                    [new SunMover(s, sun), () => arrived(s, sun.position)],
                    [new OrbitMover(s, sun), () => false],
                ]));
                return;
            }
        }
        stars.forEach(s => s.mover = new MoveSequence(s, [
            [new PointMover(s, point), () => arrived(s, point)],
            [new OrbitMover(s, { orbitDistance: Math.random() * 20, position: point }), () => false],
        ]));
    }

    private pulse() {
        if (this.stars.length >= maxStars) {
            return;
        }
        for (const sun of this.suns) {
            if (sun.owner) {
                for (let i = 0; i < sun.level; i++) {
                    this.spawnStar(sun);
                }
            }
        }
    }

    private spawnStar(sun: Sun) {
        const star = new Star(sun.owner, sun.position);
        star.mover = new OrbitMover(star, sun);
        this.stars.push(star);
    }

    destroy(star: Star) {
        this.stars = this.stars.filter(s => s !== star);
        this.flashes.push(new Flash(this, star.position, star.velocity));
        star.destroy();
    }
}

type SunLevel = 0 | 1 | 2 | 3;
class Sun implements Renderable {
    private _candidateOwner?: Player;
    private _owner?: Player;
    private _rotation: number = Math.random() * Math.PI * 2;
    private rotationSpeed = Math.PI / 80000;
    private _health: number = 100;
    private _upgrade: number = 0;

    render: Function;
    destroy: Function;
    level: SunLevel = 0;
    get rotation() { return this._rotation; }
    get owner(): Player | undefined { return this._owner; }
    get candidateOwner(): Player | undefined { return this._candidateOwner; }
    // value between 0 and 1
    get radius() { return (this.level / 6) + .5; }
    // sprite is (currently) 300px
    get orbitDistance() { return this.radius * 150; }
    get health() { return this._health; }
    get upgrade() { return this._upgrade; }

    constructor(readonly game: Game, readonly position: Point, readonly maxLevel: SunLevel) {}

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

    hit(star: Star) {
        if (!this.owner) {
            if (!this._candidateOwner) {
                this._candidateOwner = star.owner;
            }
            this._upgrade += (this._candidateOwner === star.owner) ? 1 : -1;
            star.destroy();

            if (this._upgrade === 0) {
                this._candidateOwner = null;
            }
            if (this._upgrade === 100) {
                this.capture(this._candidateOwner);
            }
        } else if (star.owner === this.owner) {
            if (this.level < this.maxLevel && this._health === 100) {
                this._upgrade += 1;
                this.game.destroy(star);
            } else if (this._health < 100) {
                this._health += 1;
                this.game.destroy(star);
            }
            if (this._upgrade === 100) {
                this.level += 1;
                this._upgrade = 0;
            }
        } else {
            this._health -= 1;
            this.game.destroy(star);
            if (this._health === 0) {
                this.capture(null);
                this.level = 0;
            }
        }
    }
}

const arrived = (star: Star, point: Point) => {
    return distSqr(star.position, point) < 400;
}

interface Mover {
    evaluate(elapsedMS: number): Mover;
}

type Missions = 'hurt' | 'heal' | 'take' | 'upgrade' | 'none';
class SunMover implements Mover {
    private mission: Missions;
    private sunLevel: SunLevel;
    constructor(readonly star: Star, readonly sun: Sun) {
        this.sunLevel = sun.level;
        this.mission = this.computeMission();
    }

    evaluate(elapsedMS: number) {
        const mission = this.computeMission();
        if (mission === this.mission) {
            this.sun.hit(this.star);
        }
        return this;
    }

    private computeMission(): Missions {
        return (
            !this.sun.owner ? 'take'
            : (this.star.owner !== this.sun.owner) ? 'hurt'
            : (this.sun.health < 100) ? 'heal'
            : (this.sun.upgrade < 100 && this.sunLevel === this.sun.level) ? 'upgrade'
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
    private orbitSpeed = Math.random() * Math.PI * 2 / 40000;
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private positionNoise = targetOffsetNoise();
    private moveNoise = moveNoise();
    constructor(readonly star: Star, readonly orbit: { orbitDistance: number, position: Point }) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed * elapsedMS;
        const target = {
            x: Math.cos(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.x + this.positionNoise.x,
            y: Math.sin(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.y + this.positionNoise.x,
        };
        this.star.updateVelocity(target, elapsedMS * this.moveNoise);
        return this;
    }
}

class PointMover implements Mover {
    private moveNoise = moveNoise();
    private positionNoise = targetOffsetNoise();
    constructor(readonly star: Star, readonly target: Point) {}

    evaluate(elapsedMS: number) {
        // why compute this every frame? If this.target is a reference to a sun, then
        // the sun could be moving so we have a moving target
        const target = {
            x: this.target.x + this.positionNoise.x,
            y: this.target.y + this.positionNoise.y,
        }
        this.star.updateVelocity(target, elapsedMS * this.moveNoise);
        return this;
    }
}

type MovePair = [Mover, () => boolean];
class MoveSequence implements Mover {
    constructor(readonly star: Star, readonly movers: MovePair[]) {}
    evaluate(elapsedMS: number) {
        if (this.movers[0][1]()) {
            this.movers.shift();
        }
        this.movers[0][0].evaluate(elapsedMS);
        return this;
    }
}

class Star implements Renderable {
    readonly position: Point;
    render: Function;
    destroy: Function;
    mover: Mover;
    readonly velocity: Point;

    constructor(readonly owner: Player, position: Point) {
        this.owner = owner;
        this.position = copyPoint(position);
        const angle = Math.random() * Math.PI * 2;
        this.mover = new NullMover();
        const speed = Math.random() * maxStarVelocity;
        this.velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
        };
    }

    tick(elapsedMS: number) {
        this.mover = this.mover.evaluate(elapsedMS);
        this.position.x += this.velocity.x * elapsedMS;
        this.position.y += this.velocity.y * elapsedMS;
    }

    updateVelocity(target: Point, rate: number) {
        // https://medium.com/unity3danimation/simple-physics-based-motion-68a006d42a18
        const direction = {
            x: target.x - this.position.x,
            y: target.y - this.position.y,
        }
        normalizeVector(direction);

        const targetVelocity = copyPoint(direction);
        scaleVector(targetVelocity, maxStarVelocity);

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