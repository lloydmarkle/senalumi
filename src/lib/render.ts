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
    const isPlayerStar = (star: any) =>  selector.contains(star.position);
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
    let starTexture = PIXI.Texture.from('star.png');
    let sunTexture = PIXI.Texture.from('sun.png');

    let bgContainer = new PIXI.Container();
    let sunsContainer = new PIXI.Container();
    let starsContainer = new PIXI.ParticleContainer(constants.maxStars, { rotation: true, tint: true });
    let flashContainer = new PIXI.ParticleContainer(constants.maxStars, { scale: true, rotation: true, alpha: true });
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
            const selectedStars = game.stars.filter(isPlayerStar);
            game.moveStars(player, selectedStars, point);
        }
        selector.pointerup();
    });
    // app.ticker.maxFPS = 10;

    viewport.addChild(bgContainer);
    viewport.addChild(sunsContainer);
    viewport.addChild(starsContainer);
    viewport.addChild(flashContainer);
    viewport.addChild(interactionContainer);

    let qTree = new PIXI.Graphics();
    let b = new PIXI.Container();
    b.addChild(qTree);
    viewport.addChild(b);

    // const cull = new Simple();
    // cull.addList(viewport.children);
    // cull.cull(viewport.getVisibleBounds());
    // app.ticker.add(() => {
    //     if (viewport.dirty) {
    //         cull.cull(viewport.getVisibleBounds());
    //         viewport.dirty = false;
    //     }
    // });

    for (const sun of game.suns) {
        const sprite = PIXI.Sprite.from(sunTexture);
        sunsContainer.addChild(sprite);

        const text = new PIXI.Text('');
        text.style.fill = 0xffffff;
        text.position.x = sun.position.x;
        text.position.y = sun.position.y;
        sunsContainer.addChild(text)
        sun.destroy = () => sunsContainer.removeChild(sprite);
        sun.render = () => {
            text.text = sun.health + ':' + sun.upgrade + (sun.candidateOwner?.id[0] ?? '') + ':' + sun.level;
            sprite.rotation = sun.rotation;
            sprite.scale.set(sun.radius);
            sprite.x = sun.position.x;
            sprite.y = sun.position.y;
            sprite.filters = sun.owner ? [teamColours[sun.owner.id]] : [greyTeamMatrix];
        };

        sprite.anchor.set(0.5, 0.5);
        sprite.interactive = true;
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

        const now = new Date();
        if (game.qTree && now.getTime() - last.getTime() > 500) {
            last = now;
            qTree.removeChildren();
            qTree.clear();
            qTree.lineStyle(3, 0x00ffaa);

            let q: any[] = [];
            q.push(game.qTree);
            while (q.length){
                const qt = q.shift();
                qt.chidlren?.forEach(c => q.push(c));
                const t = new PIXI.Text(qt.data.length);
                t.x = (qt.topLeft.x + qt.bottomRight.x) / 2;
                t.y = (qt.topLeft.y + qt.bottomRight.y) / 2;
                t.style.fill = 0x00dddd;
                qTree.addChild(t);
                qTree.drawRect(qt.topLeft.x, qt.topLeft.y, qt.bottomRight.x - qt.topLeft.x, qt.bottomRight.y - qt.topLeft.y);
            }
        }

        for (const sun of game.suns) {
            sun.render();
        }

        for (const flash of game.flashes) {
            if (flash.render) {
                flash.render();
                continue;
            }

            const sprite = PIXI.Sprite.from(starTexture);
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
            star.destroy = () => {
                starsContainer.removeChild(sprite);
            }
            star.render = () => {
                rotation += rotationSpeed * app.ticker.elapsedMS;
                sprite.rotation = rotation;
                sprite.x = star.position.x;
                sprite.y = star.position.y;

                sprite.tint = isPlayerStar(star) ? 0xaaaaaa : star.owner.starColor;
            };
            sprite.anchor.set(0.5, 0.5);
        }
    });
}

// const xstars = stars.reduce((m, s) => {
//     let l = m[s.owner.id] ?? 0;
//     m[s.owner.id] = l + 1;
//     return m;
// }, {})