import { copyPoint, distSqr, normalizeVector, point, scaleVector, vectorLength, type Point } from "./math";

const maxStarVelocity = 0.02;
const starTurnSpeed = 0.01;
const maxStars = 1000;
export const constants = { maxStarelocity: maxStarVelocity, starTurnSpeed, maxStars };

export type Team = 'red' | 'green' | 'blue';

interface Renderable {
    render: Function;
}

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
            new Player('blue', 0x0000aa),
            new Player('green', 0x00aa00),
            new Player('red', 0xaa0000),
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

    moveStars(player: Player, stars: Star[], point: Point) {
        for (const sun of this.suns) {
            const ds = distSqr(sun.position, point);
            if (ds < 400) {
                stars.forEach(s => s.mover = new OrbitMover(this, s, sun))
                return;
            }
        }
        stars.forEach(s => s.mover = new PointMover(this, s, point))
    }

    private pulse() {
        for (const sun of this.suns) {
            if (this.stars.length >= maxStars) {
                return;
            }
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
    private turnSpeed = Math.random() * starTurnSpeed + starTurnSpeed;
    constructor(readonly game: Game, readonly star: Star, readonly orbit: { orbitDistance: number, position: Point }) {}

    evaluate(elapsedMS: number) {
        this.orbitRotationOffset += this.orbitSpeed;
        const targetX = Math.cos(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.x;
        const targetY = Math.sin(this.orbitRotationOffset) * this.orbit.orbitDistance * this.orbitDistanceOffset + this.orbit.position.y;
        const distance = {
            x: targetX - this.star.position.x,
            y: targetY - this.star.position.y,
        };
        normalizeVector(distance);
        scaleVector(distance, this.turnSpeed * elapsedMS);

        this.star.velocity.x = distance.x + this.star.velocity.x;
        this.star.velocity.y = distance.y + this.star.velocity.y;
        normalizeVector(this.star.velocity);
        scaleVector(this.star.velocity, maxStarVelocity);
        return this;
    }
}

class PointMover implements Mover {
    private turnSpeed = (Math.random() * starTurnSpeed + starTurnSpeed) * 0.01;
    readonly target: Point;
    constructor(readonly game: Game, readonly star: Star, target: Point) {
        this.target = copyPoint(target);
    }

    evaluate(elapsedMS: number) {
        if (arrived(this.star, this.target)) {
            return new OrbitMover(this.game, this.star, {
                orbitDistance: Math.random() * 20,
                position: this.target,
            });
        }

        const distance = {
            x: this.target.x - this.star.position.x,
            y: this.target.y - this.star.position.y,
        };
        normalizeVector(distance);
        scaleVector(distance, this.turnSpeed * elapsedMS);

        this.star.velocity.x = distance.x + this.star.velocity.x;
        this.star.velocity.y = distance.y + this.star.velocity.y;
        normalizeVector(this.star.velocity);
        scaleVector(this.star.velocity, maxStarVelocity);

        // console.log(
        //     vectorLength(distance),
        //     vectorLength(this.star.direction),
        // )
        return this;
    }
}

class Star implements Renderable {
    mover: Mover;
    velocity: Point;
    render: Function;
    readonly position: Point;

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
}
