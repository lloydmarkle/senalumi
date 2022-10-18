import type { Game, Point } from './game';
import { constants } from './game';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport'

class Selector {
    p: Point;
    mid: Point = { x:0, y:0 };
    radius: number = 0;
    radiusSqr: number = 0;
    downStart: number = 0;
    private gfx: PIXI.Graphics;

    constructor(container: PIXI.Container, readonly game: Game, readonly viewport: Viewport) {
        this.gfx = new PIXI.Graphics();
        container.addChild(this.gfx);
    }

    contains(point: Point) {
        const distSqr = (point.x - this.mid.x) * (point.x - this.mid.x) + (point.y - this.mid.y) * (point.y - this.mid.y);
        return distSqr < this.radiusSqr;
    }

    private clear() {
        this.radius = 0;
        this.radiusSqr = 0;
        this.p = null;
        this.gfx.clear();
    }

    private update(point: Point) {
        this.radius = Math.max(Math.abs(this.p.x - point.x), Math.abs(this.p.y - point.y));
        this.radiusSqr = this.radius * this.radius;
        this.gfx.clear();
        this.gfx.lineStyle(2, 0xff0000);
        this.mid.x = (point.x > this.p.x ? this.p.x : point.x) + Math.abs(this.p.x - point.x) / 2;
        this.mid.y = (point.y > this.p.y ? this.p.y : point.y) + Math.abs(this.p.y - point.y) / 2;
        this.gfx.drawCircle(this.mid.x, this.mid.y, this.radius);
        // this.gfx.drawRect(
        //     point.x > this.p.x ? this.p.x : point.x,
        //     point.y > this.p.y ? this.p.y : point.y,
        //     Math.abs(this.p.x - point.x),
        //     Math.abs(this.p.y - point.y)
        // )
    }

    pointerdown(point: Point) {
        if (this.p) {
            this.game.stars.forEach(star => {
                if (this.contains(star.position)) {
                    star.goto(point);
                }
            });
            this.clear();
        } else {
            this.downStart = new Date().getTime();
            this.p = point;
        }
    }

    pointermove(point: Point) {
        const now = new Date().getTime();
        if (!this.downStart || now - this.downStart < 300) {
            this.viewport.plugins.resume('drag');
            return;
        }

        this.update(point);
    }

    pointerup() {
        if (this.downStart) {
            this.viewport.plugins.pause('drag');
        }
        this.downStart = 0;
    }
}

export function run(game: Game) {
    let app: PIXI.Application;
    if (import.meta.hot && app) {
        app.destroy(true, { baseTexture: true, children: true, texture: true });
    }

    app = new PIXI.Application({
        view: document.querySelector("#game") as HTMLCanvasElement,
        autoDensity: true,
        resizeTo: window,
    });

    // create viewport
    const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 100000,
        worldHeight: 100000,
        // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        interaction: app.renderer.plugins.interaction,
    });
    // let viewport = new PIXI.Container();
    app.stage.addChild(viewport);
    // activate plugins
    viewport.moveCenter(300,300)
    viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate();
    viewport.plugins.pause('drag');

    let greenTeamMatrix = new PIXI.filters.ColorMatrixFilter();
    greenTeamMatrix.tint(0x00aa00, true);
    let blueTeamMatrix = new PIXI.filters.ColorMatrixFilter();
    blueTeamMatrix.tint(0x0000ff, true);
    let redTeamMatrix = new PIXI.filters.ColorMatrixFilter();
    redTeamMatrix.tint(0xaa0000, true);

    let teamColours = {
        'red': redTeamMatrix,
        'blue': blueTeamMatrix,
        'green': greenTeamMatrix,
    }

    // Create the sprite and add it to the stage
    let starTexture = PIXI.Texture.from('star.png');
    let sunTexture = PIXI.Texture.from('sun.png');

    let bgContainer = new PIXI.Container();
    let sunsContainer = new PIXI.Container();
    let starsContainer = new PIXI.ParticleContainer(constants.maxStars, { rotation: true, tint: true });
    let interactionContainer = new PIXI.Container();

    let selector = new Selector(interactionContainer, game, viewport);
    viewport.on('pointerdown', ev => {
        const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        selector.pointerdown(point);
    });
    viewport.on('pointermove', ev => {
        const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        selector.pointermove(point);
    });
    viewport.on('pointerup', ev => {
        selector.pointerup();
    });
    // app.ticker.maxFPS = 10;

    viewport.addChild(bgContainer);
    viewport.addChild(sunsContainer);
    viewport.addChild(starsContainer);
    viewport.addChild(interactionContainer);

    for (const sun of game.suns) {
        const sprite = PIXI.Sprite.from(sunTexture);
        sunsContainer.addChild(sprite);
        sun.render = () => {
            sprite.rotation = sun.rotation;
            sprite.scale.set(sun.radius);
            sprite.x = sun.position.x;
            sprite.y = sun.position.y;
        };

        sprite.anchor.set(0.5, 0.5);
        sprite.interactive = true;
        sprite.on('pointerdown', () => sun.level = (sun.level + 1) % 4 as any)
        if (sun.owner) {
            sprite.filters = [teamColours[sun.owner.id]];
        }
    }

    const basicText = new PIXI.Text('');
    basicText.x = 50;
    basicText.y = 100;
    basicText.style.fill = 0xffffff;
    app.stage.addChild(basicText)

    app.ticker.add((delta) => {
        basicText.text = app.ticker.FPS.toFixed(2) + ' fps\n'
            + app.ticker.elapsedMS.toFixed(2) + 'ms';
        game.tick(app.ticker.elapsedMS);

        for (const sun of game.suns) {
            sun.render();
        }

        for (const star of game.stars) {
            if (star.render) {
                star.render();
                continue;
            }

            let rotation = Math.random() * Math.PI * 2;
            let rotationSpeed = Math.random() * Math.PI * 2 / 4000;
            const sprite = PIXI.Sprite.from(starTexture);
            starsContainer.addChild(sprite);
            star.render = () => {
                rotation += rotationSpeed * app.ticker.elapsedMS;
                sprite.rotation = rotation;
                sprite.x = star.position.x;
                sprite.y = star.position.y;

                sprite.tint = selector.contains(star.position) ? 0xaaaaaa : star.owner.color;
            };
            sprite.anchor.set(0.5, 0.5);
        }
    });
}