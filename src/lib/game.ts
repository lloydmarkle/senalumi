import { copyPoint, distSqr, normalizeVector, point, scaleVector, vectorLength, type Point } from "./math";

const maxStarVelocity = 0.015;
const maxStars = 10000;
const forceStiffness = 0.0000001;
const forceDamping = 0.001;
const moveNoise = () => Math.random() * 1.2 + 0.8;
const targetOffsetNoise = (): Point => ({
    x: Math.random() * 20 - 10,
    y: Math.random() * 20 - 10,
})
export const constants = { maxStarVelocity, maxStars, forceStiffness, forceDamping };

export type Team = 'red' | 'green' | 'blue';

interface Renderable {
    render: Function;
}

class Player {
    readonly starColor: number;
    constructor(readonly id: Team, readonly color: number) {
        this.starColor  = color | 0x666666;
    }
}

export class Game {
    suns: Sun[];
    stars: Star[];
    players: Player[];
    gameTime = 0.0;
    lastTick = 0.0;
    pulsed = 0;

    constructor() {
        this.stars = [];
        this.suns = [
            new Sun(point(0, 0)),
            new Sun(point(200, 600)),
            new Sun(point(600, 100)),
            new Sun(point(300, 300)),
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

        for (const star of this.stars) {
            star.tick(elapsedMS);
        }
        for (const sun of this.suns) {
            sun.tick(elapsedMS);
        }
    }

    moveStars(player: Player, stars: Star[], point: Point) {
        for (const sun of this.suns) {
            const ds = distSqr(sun.position, point);
            if (ds < 400) {
                stars.forEach(s => s.mover = new MoveSequence(s, [
                    [new PointMover(this, s, sun.position), () => arrived(s, sun.position)],
                    [new OrbitMover(this, s, sun), () => false],
                ]));
                return;
            }
        }
        stars.forEach(s => s.mover = new MoveSequence(s, [
            [new PointMover(this, s, point), () => arrived(s, point)],
            [new OrbitMover(this, s, { orbitDistance: Math.random() * 20, position: point }), () => false],
        ]));
    }

    private pulse() {
        if (this.stars.length >= maxStars) {
            return;
        }
        for (const sun of this.suns) {
            if (sun.owner) {
                const star = new Star(sun.owner, sun.position);
                star.mover = new OrbitMover(this, star, sun);
                this.stars.push(star);
            }
        }
    }
}

class Sun implements Renderable {
    private _owner?: Player;
    private _rotation: number;

    render: Function;
    level: 0 | 1 | 2 | 3;
    get rotation() { return this._rotation; }
    get owner(): Player | undefined { return this._owner; }
    // value between 0 and 1
    get radius() { return (this.level / 6) + .5; }
    // sprite is (currently) 300px
    get orbitDistance() { return this.radius * 150; }

    constructor(readonly position: Point) {
        this.level = 0;
        this._rotation = Math.random() * Math.PI * 2;
    }

    capture(owner: Player) {
        this.level = 1;
        this._owner = owner;
    }

    tick(elapsedMS: number) {
        this._rotation += Math.PI / 30000 * elapsedMS;
    }
}

const arrived = (star: Star, point: Point) => {
    return distSqr(star.position, point) < 400;
}

interface Mover {
    evaluate(elapsedMS: number): Mover;
}

class NullMover implements Mover {
    evaluate(elapsedMS: number) {
        return this;
    }
}

class OrbitMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 / 4000;
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private positionNoise = targetOffsetNoise();
    private moveNoise = moveNoise();
    constructor(readonly game: Game, readonly star: Star, readonly orbit: { orbitDistance: number, position: Point }) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed;
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
    constructor(readonly game: Game, readonly star: Star, readonly target: Point) {}

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
    mover: Mover;
    private velocity: Point;

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
