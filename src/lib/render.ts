import { type Point, distSqr } from './math';
import { Game, constants } from './game';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport'


class Selector {
    mid: Point = { x:0, y:0 };
    radius: number = 0;
    radiusSqr: number = 0;
    downStart: number = 0;
    downPoint: Point;
    readonly gfx: PIXI.Graphics;
    private _mode: 'none' | 'select' | 'drag' = 'none';
    get mode() { return this._mode; }

    constructor(readonly viewport: Viewport) {
        this.gfx = new PIXI.Graphics();
    }

    contains(point: Point) {
        return distSqr(point, this.mid) < this.radiusSqr;
    }

    private clearGfx() {
        this.radius = 0;
        this.radiusSqr = 0;
        this.gfx.clear();
    }

    private update(point: Point) {
        this.gfx.clear();
        this.gfx.lineStyle(2, 0xff0000);

        const top = Math.min(point.y, this.downPoint.y);
        const bottom = Math.max(point.y, this.downPoint.y);
        const left = Math.min(point.x, this.downPoint.x);
        const right = Math.max(point.x, this.downPoint.x);
        // this.gfx.drawRect(
        //     left,
        //     top,
        //     right - left,
        //     bottom - top,
        // );

        this.radius = Math.max(Math.abs(this.downPoint.x - point.x), Math.abs(this.downPoint.y - point.y)) / 2;
        this.radiusSqr = this.radius * this.radius;
        this.mid.x = left + (right - left) / 2;
        this.mid.y = top + (bottom - top) / 2;
        this.gfx.drawCircle(this.mid.x, this.mid.y, this.radius);
    }

    pointerdown(point: Point) {
        this.downStart = new Date().getTime();
        this.downPoint = point;
    }

    pointermove(point: Point) {
        if (!this.downStart) {
            return;
        }

        const moveDistSqr = distSqr(this.downPoint, point);
        if (moveDistSqr > 50) {
            if (this._mode === 'none') {
                const now = new Date().getTime();
                if (now - this.downStart > 200) {
                    this._mode = 'drag';
                    this.clearGfx();
                    // this.viewport.plugins.resume('drag');
                } else {
                    // this.viewport.plugins.pause('drag');
                    this._mode = 'select';
                }
                console.log('set',this._mode)
            }

            if (this._mode !== 'drag') {
                this.update(point);
            }
        }
    }

    pointerup() {
        if (this._mode === 'none') {
            this.clearGfx();
        }
        this._mode = 'none';
        // this.viewport.plugins.resume('drag');
        this.downStart = 0;
    }
}

export function run(game: Game) {
    let app: PIXI.Application;
    if (import.meta.hot && app) {
        app.destroy(true, { baseTexture: true, children: true, texture: true });
    }

    const player = game.players[0];
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
    app.stage.addChild(viewport);
    // activate plugins
    viewport.moveCenter(300,300)
    viewport
        .drag()
        .pinch()
        .wheel()
        .decelerate();

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

    viewport.plugins.pause('drag');
    let selector = new Selector(viewport);
    interactionContainer.addChild(selector.gfx);
    viewport.on('pointerdown', ev => {
        const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        selector.pointerdown(point);
    });
    viewport.on('pointermove', ev => {
        const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        selector.pointermove(point);
    });
    viewport.on('pointerup', ev => {
        if (selector.mode === 'none') {
            const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
            const selectedStars = game.stars.filter(star => star.owner === player && selector.contains(star.position));
            game.moveStars(player, selectedStars, point);
        }
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
        // sprite.on('pointerdown', () => sun.level = (sun.level + 1) % 4 as any)
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

                sprite.tint = star.owner === player && selector.contains(star.position) ? 0xaaaaaa : star.owner.starColor;
                // sprite.tint =  0xaaaaaa;
            };
            sprite.anchor.set(0.5, 0.5);
        }
    });
}