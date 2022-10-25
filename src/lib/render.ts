import { type Point, distSqr } from './math';
import { Game, constants } from './game';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport'
import { Simple } from "pixi-cull"

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
    const isPlayerSatellite = (sat: any) => selector.contains(sat.position);
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
    let greyTeamMatrix = new PIXI.filters.ColorMatrixFilter();
    greyTeamMatrix.tint(0x222222, true);

    let teamColours = {
        'red': redTeamMatrix,
        'blue': blueTeamMatrix,
        'green': greenTeamMatrix,
    }

    // Create the sprite and add it to the stage
    let satelliteTexture = PIXI.Texture.from('star.png');
    let planetTexture = PIXI.Texture.from('sun.png');

    let bgContainer = new PIXI.Container();
    let planetContainer = new PIXI.Container();
    let satellieContainer = new PIXI.ParticleContainer(constants.maxSatellites, { rotation: true, tint: true });
    let flashContainer = new PIXI.ParticleContainer(constants.maxSatellites, { scale: true, rotation: true, alpha: true });
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
            const selection = game.satellites.filter(isPlayerSatellite);
            game.moveSatellites(player, selection, point);
        }
        selector.pointerup();
    });
    // app.ticker.maxFPS = 10;

    viewport.addChild(bgContainer);
    viewport.addChild(planetContainer);
    viewport.addChild(satellieContainer);
    viewport.addChild(flashContainer);
    viewport.addChild(interactionContainer);

    // const cull = new Simple();
    // cull.addList(viewport.children);
    // cull.cull(viewport.getVisibleBounds());
    // app.ticker.add(() => {
    //     if (viewport.dirty) {
    //         cull.cull(viewport.getVisibleBounds());
    //         viewport.dirty = false;
    //     }
    // });

    for (const planet of game.planets) {
        const sprite = PIXI.Sprite.from(planetTexture);
        planetContainer.addChild(sprite);

        const text = new PIXI.Text('');
        text.style.fill = 0xffffff;
        text.position.x = planet.position.x;
        text.position.y = planet.position.y;
        planetContainer.addChild(text)
        planet.destroy = () => planetContainer.removeChild(sprite);
        planet.render = () => {
            text.text = planet.health + ':' + planet.upgrade + (planet.candidateOwner?.id[0] ?? '') + ':' + planet.level;
            sprite.rotation = planet.rotation;
            sprite.scale.set(planet.radius);
            sprite.x = planet.position.x;
            sprite.y = planet.position.y;
            sprite.filters = planet.owner ? [teamColours[planet.owner.id]] : [greyTeamMatrix];
        };
        sprite.anchor.set(0.5, 0.5);
        planet.render();
    }

    const basicText = new PIXI.Text('');
    basicText.x = 50;
    basicText.y = 100;
    basicText.style.fill = 0xffffff;
    app.stage.addChild(basicText)

    let last = new Date();
    app.ticker.add((delta) => {
        basicText.text = app.ticker.FPS.toFixed(2) + ' fps\n'
            + app.ticker.elapsedMS.toFixed(2) + 'ms';
        // game.tick(app.ticker.elapsedMS * 8);
        game.tick(app.ticker.elapsedMS);

        for (const planet of game.planets) {
            planet.render();
        }

        for (const flash of game.flashes) {
            if (flash.render) {
                flash.render();
                continue;
            }

            const sprite = PIXI.Sprite.from(satelliteTexture);
            flashContainer.addChild(sprite);
            flash.destroy = () => flashContainer.removeChild(sprite);
            flash.render = () => {
                sprite.rotation = flash.rotation;
                sprite.scale.set(flash.size);
                sprite.alpha = flash.alpha;
                sprite.x = flash.position.x;
                sprite.y = flash.position.y;
            };
            sprite.anchor.set(0.5, 0.5);
            flash.render();
        }

        for (const satellite of game.satellites) {
            if (satellite.render) {
                satellite.render();
                continue;
            }

            let rotation = Math.random() * Math.PI * 2;
            let rotationSpeed = Math.random() * Math.PI * 2 / 4000;
            const sprite = PIXI.Sprite.from(satelliteTexture);
            satellieContainer.addChild(sprite);
            satellite.destroy = () => satellieContainer.removeChild(sprite);
            satellite.render = () => {
                rotation += rotationSpeed * app.ticker.elapsedMS;
                sprite.rotation = rotation;
                sprite.x = satellite.position.x;
                sprite.y = satellite.position.y;

                sprite.tint = isPlayerSatellite(satellite) ? 0xaaaaaa : satellite.owner.satelliteColor;
            };
            sprite.anchor.set(0.5, 0.5);
            satellite.render();
        }
    });
}

// const xstars = stars.reduce((m, s) => {
//     let l = m[s.owner.id] ?? 0;
//     m[s.owner.id] = l + 1;
//     return m;
// }, {})