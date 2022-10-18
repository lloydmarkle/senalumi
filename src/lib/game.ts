const maxStarVelocity = 0.02;
const starTurnSpeed = 0.01;
const maxStars = 1000;
export const constants = { maxStarelocity: maxStarVelocity, starTurnSpeed, maxStars };

export type Team = 'red' | 'green' | 'blue';

interface Renderable {
    render: Function;
}

export interface Point {
    x: number;
    y: number;
}
const originPoint = () => ({ x: 0, y: 0 });
const copyPoint = (p: Point) => ({ x: p.x, y: p.y });
const point = (x: number, y: number) => ({ x, y });

// Vector math
const normalizeVector = (p: Point) => {
    const len = Math.sqrt(p.x * p.x + p.y * p.y);
    p.x /= len;
    p.y /= len;
};
const scaleVector = (p: Point, scalar: number) => {
    p.x *= scalar;
    p.y *= scalar;
};

class Player {
    constructor(readonly id: Team, readonly color: number) {
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
            new Player('green', 0x00aa00),
            new Player('red', 0xaa0000),
            new Player('blue', 0x0000aa),
        ];

        this.suns[0].capture(this.players[0]);
        this.suns[1].capture(this.players[1]);
        this.suns[2].capture(this.players[2]);

        for (let i = 0; i < maxStars; i++){
            this.pulse();
        }
    }

    tick(elapsedMS: number) {
        this.gameTime = this.gameTime + elapsedMS;

        const seconds = Math.floor(this.gameTime / 1000);
        if (seconds > this.lastTick) {
            this.lastTick = seconds;
            // this.pulse();
        }

        for (const star of this.stars) {
            star.tick(elapsedMS);
        }
        for (const sun of this.suns) {
            sun.tick(elapsedMS);
        }
    }

    private pulse() {
        for (const sun of this.suns) {
            if (this.stars.length >= maxStars) {
                return;
            }
            if (sun.owner) {
                const star = new Star(sun.owner, sun);
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

interface Mover {
    evaluate(elapsedMS: number);
}

class OrbitMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 / 40000;
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = (Math.random() * 0.3) + 0.9;
    private turnSpeed = Math.random() * starTurnSpeed + starTurnSpeed;
    constructor(readonly star: Star, readonly sun: Sun) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed;
        const rotation = this.sun.rotation + this.orbitRotationOffset;
        const targetX = Math.cos(rotation) * this.sun.orbitDistance * this.orbitDistanceOffset + this.sun.position.x;
        const targetY = Math.sin(rotation) * this.sun.orbitDistance * this.orbitDistanceOffset + this.sun.position.y;
        const distance = {
            x: targetX - this.star.position.x,
            y: targetY - this.star.position.y,
        };
        normalizeVector(distance);
        scaleVector(distance, this.turnSpeed * elapsedMS);

        this.star.direction.x = distance.x + this.star.direction.x;
        this.star.direction.y = distance.y + this.star.direction.y;
        normalizeVector(this.star.direction);
        scaleVector(this.star.direction, maxStarVelocity);
    }
}

class PointMover implements Mover {
    private orbitSpeed = Math.random() * Math.PI * 2 / 2000;
    private orbitRotationOffset = Math.random() * Math.PI * 2;
    private orbitDistanceOffset = Math.random() * 50;
    private turnSpeed = Math.random() * starTurnSpeed + starTurnSpeed;
    private _target: Point;
    constructor(readonly star: Star, target: Point) {
        this._target = copyPoint(target);
    }

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed;
        const targetX = Math.cos(this.orbitRotationOffset) * this.orbitDistanceOffset + this._target.x;
        const targetY = Math.sin(this.orbitRotationOffset) * this.orbitDistanceOffset + this._target.y;
        const distance = {
            x: targetX - this.star.position.x,
            y: targetY - this.star.position.y,
        };
        normalizeVector(distance);

        const turnSpeed = this.turnSpeed * elapsedMS;
        this.star.direction.x = distance.x * turnSpeed + this.star.direction.x;
        this.star.direction.y = distance.y * turnSpeed + this.star.direction.y;
        normalizeVector(this.star.direction);
        scaleVector(this.star.direction, maxStarVelocity);
    }
}

class Star implements Renderable {
    private mover: Mover;

    direction: Point;
    render: Function;
    readonly position: Point;

    constructor(readonly owner: Player, sun: Sun) {
        this.owner = owner;
        this.position = copyPoint(sun.position);
        const velocity = Math.random() * maxStarVelocity;
        const angle = Math.random() * Math.PI * 2;
        this.direction = {
            x: Math.cos(angle) * velocity,
            y: Math.sin(angle) * velocity,
        };
        this.goto(sun);
    }

    goto(target: Sun | Point) {
        if ('x' in target) {
            this.mover = new PointMover(this, target);
        } else {
            this.mover = new OrbitMover(this, target);
        }
    }

    tick(elapsedMS: number) {
        if (this.mover) {
            this.mover.evaluate(elapsedMS);
            this.position.x += this.direction.x * elapsedMS;
            this.position.y += this.direction.y * elapsedMS;
        }
    }
}
