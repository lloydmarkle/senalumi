import { backInOut, backOut, cubicIn, cubicOut } from 'svelte/easing';
import { writable, type Readable, type Writable } from 'svelte/store';
import { type Point, distSqr, QuadTree, ArrayPool, Interpolator, ComboInterpolator, point } from './math';
import { Game, constants, type Player, setLightness, Planet, type Renderable, Satellite, type Entity } from './game';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport'
import { Simple } from "pixi-cull"
import type { ListenerFn } from 'eventemitter3';
import { PlanetAudio, Sound } from './sound';
// lots of other fun filters https://filters.pixijs.download/main/demo/index.html
import { ShockwaveFilter } from '@pixi/filter-shockwave';

class Selector {
    private dragMove: ListenerFn;
    private mid: Point = { x:0, y:0 };
    private radius: number = 0;
    private radiusSqr: number = 0;
    private downStart: number = 0;
    private selectStartCenter: Point;
    private worldPoint: Point;
    private screenPoint: Point;

    onMoveSatellites: (point: Point) => void;
    readonly gfx: PIXI.Graphics;
    private _mode: 'none' | 'select' | 'drag' = 'none';
    get mode() { return this._mode; }

    constructor(readonly viewport: Viewport, readonly game: Game, readonly player: Player) {
        this.gfx = new PIXI.Graphics();
        this.dragMove = (ev: PIXI.InteractionEvent) => this.pointermove(ev);
    }

    contains = (point: Point) => distSqr(point, this.mid) < this.radiusSqr;

    pointerdown(ev: PIXI.InteractionEvent) {
        this.downStart = new Date().getTime();
        this.selectStartCenter = this.viewport.center;
        this.screenPoint = ev.data.global.clone();
        this.worldPoint = this.viewport.toWorld(ev.data.global.x, ev.data.global.y);
        this.viewport.on('pointermove', this.dragMove);
    }

    pointerup(ev: PIXI.InteractionEvent) {
        if (!this.game.state.running) {
            this.clear();
            this.clearGfx();
            return;
        }
        if (this._mode === 'none') {
            if (this.radius === 0 && this.pointerDownTime() < 200) {
                const planet = this.game.planets.find(p => distSqr(p.position, this.worldPoint) < 1600);
                if (planet) {
                    this.updateGfx(planet.position, this.game.config.planetRadius * 1.3);
                }
            } else {
                const point = this.viewport.toWorld(ev.data.global.x, ev.data.global.y);
                this.onMoveSatellites?.(point);
                this.clearGfx();
            }
        }
        this.clear();
    }

    pointermove(ev: PIXI.InteractionEvent) {
        const moveDistSqr = distSqr(ev.data.global, this.screenPoint);
        if (moveDistSqr > 160) {
            if (this._mode === 'none') {
                if (this.pointerDownTime() > 200) {
                    this._mode = 'drag';
                    this.clearGfx();
                } else {
                    this._mode = 'select';
                    // disable drag and reset view to where drag started
                    this.viewport.plugins.pause('drag');
                    this.viewport.moveCenter(this.selectStartCenter);
                }
            }

            if (this._mode !== 'drag') {
                const point = this.viewport.toWorld(ev.data.global.x, ev.data.global.y);
                const top = Math.min(point.y, this.worldPoint.y);
                const bottom = Math.max(point.y, this.worldPoint.y);
                const left = Math.min(point.x, this.worldPoint.x);
                const right = Math.max(point.x, this.worldPoint.x);
                const radius = Math.max(Math.abs(this.worldPoint.x - point.x), Math.abs(this.worldPoint.y - point.y)) / 2;
                this.updateGfx({
                        x: left + (right - left) / 2,
                        y: top + (bottom - top) / 2,
                    }, radius);
            }
        }
    }

    private pointerDownTime() {
        const now = new Date().getTime();
        return now - this.downStart;
    }

    private clear() {
        this._mode = 'none';
        this.downStart = 0;
        this.viewport.off('pointermove', this.dragMove);
        this.viewport.plugins.resume('drag');
    }

    private clearGfx() {
        this.radius = 0;
        this.radiusSqr = 0;
        this.gfx.clear();
    }

    private updateGfx(mid: Point, radius: number) {
        this.mid = mid;
        this.radius = radius;
        this.radiusSqr = this.radius * this.radius;

        this.gfx.clear();
        this.gfx.lineStyle(5, this.player.color);
        this.gfx.drawCircle(this.mid.x, this.mid.y, this.radius);
    }
}

class DebugRender {
    private overlayInfo = {
        lastTime: new Date(),
        fps: 0,
        frames: 0,
    };
    private dbg: PIXI.Container;
    private updateFns: Function[] = [];

    readonly config = {
        enablePulseAnimation: true,
        updateFrequencyMS: 500,
        showStats: false,
        showQuadTree: false,
        showPlanetStats: false,
        showPlayerSelection: {},
    };

    constructor(private game: Game, app: PIXI.Application, gameview: PIXI.Container, cull: Simple) {
        this.dbg = new PIXI.Container();
        gameview.addChild(this.dbg);

        this.setupStatsDisplay(app, cull);
        this.setupQuadTreeDisplay();
        game.players.forEach(p => this.setupPlayerSelectionHighlight(p));
        game.planets.forEach(p => this.setupPlanetStats(p));
    }

    tick(app: PIXI.Application) {
        const now = new Date();
        this.overlayInfo.frames += 1;
        this.overlayInfo.fps += app.ticker.FPS;
        if (now.getTime() - this.overlayInfo.lastTime.getTime() > this.config.updateFrequencyMS) {
            this.overlayInfo.lastTime = now;
            this.updateFns.forEach(fn => fn());
        }
    }

    private setupStatsDisplay(app: PIXI.Application, cull: Simple) {
        const text = new PIXI.Text('');
        app.stage.addChild(text);
        text.x = app.renderer.screen.width - 200;
        text.y = 100;
        text.style.fill = 0xffffff;
        text.scale.set(0.5);

        this.updateFns.push(() => {
            text.visible = this.config.showStats;
            if (!text.visible) {
                return;
            }

            const planets = this.game.planets.reduce((map, p) => {
                if (p.owner) {
                    map[p.owner.team] = (map[p.owner.team] ?? 0) + p.level;
                }
                return map;
            }, {});
            const stats = Array.from(this.game.log.at(-1)?.satelliteCounts?.entries() ?? [])
                .sort((a, b) => b[1] - a[1])
                .map(([team, count]) => `${team}: ${count} satellites, ${planets[team] ?? 0}/s`);

            const cullStats = [];
            Object.entries(cull.stats()).forEach(stat => cullStats.push(`${stat[0]}: ${stat[1]}`));

            const perfStats = [];
            Object.keys(this.game.stats.collisionStages).forEach(stage => {
                perfStats.push(`collision-${stage}: ${this.game.stats.collisionStages[stage].toFixed(2)}`);
            });
            perfStats.push(`moveTime: ${this.game.stats.moveTime.toFixed(2)}ms`);
            perfStats.push(`collideTime: ${this.game.stats.collideTime.toFixed(2)}ms`);
            perfStats.push(`pulseTime: ${this.game.stats.pulseTime.toFixed(2)}ms`);
            perfStats.push(`thinkTime: ${this.game.stats.thinkTime.toFixed(2)}ms`);
            perfStats.push(`gameTime: ${this.game.stats.gameTime.toFixed(2)}ms`);

            text.text = [
                (this.overlayInfo.fps / this.overlayInfo.frames).toFixed(2) + 'fps',
                this.game.satellites.length + ' satellites',
                'stats: [', '  ' + stats.join('\n  '), ']',
                'perf: [', '  ' + perfStats.join('\n  '), ']',
                'cull: [', '  ' + cullStats.join('\n  '), ']',
            ].join('\n');
            this.overlayInfo.fps = 0;
            this.overlayInfo.frames = 0;
        });
        return text;
    }

    private setupQuadTreeDisplay() {
        let gfx = new PIXI.Graphics();
        this.dbg.addChild(gfx);

        this.updateFns.push(() => {
            this.destroyChildren(gfx);
            gfx.visible = this.config.showQuadTree;
            if (!gfx.visible) {
                return;
            }

            let colors = [0xD2042D, 0xCC5500, 0xFFF44F, 0x7CFC00, 0x1111DD, 0x7F00FF, 0xFF10F0];

            let q: Array<[number, QuadTree<any>]> = [];
            q.push([0, this.game.collisionTree]);
            while (q.length){
                const [ci, item] = q.shift();
                let color = colors[ci % colors.length];
                item.children.forEach(e => q.push([ci + 1, e]));
                const box = new PIXI.Graphics();
                box.lineStyle(8 / (ci + 1), color);
                box.drawRect(item.topLeft.x, item.topLeft.y, item.bottomRight.x - item.topLeft.x, item.bottomRight.y - item.topLeft.y);
                gfx.addChild(box);

                const itemCount = new PIXI.Text(item.data.length);
                itemCount.scale.set(0.25);
                itemCount.x = (item.topLeft.x + item.bottomRight.x) / 2;
                itemCount.y = (item.topLeft.y + item.bottomRight.y) / 2;
                itemCount.style.fill = color;
                gfx.addChild(itemCount);
            }
        });
    }

    private setupPlayerSelectionHighlight(player: Player) {
        let gfx = new PIXI.Graphics();
        this.dbg.addChild(gfx);

        this.updateFns.push(() => {
            gfx.clear();
            this.destroyChildren(gfx);
            gfx.visible = this.config.showPlayerSelection[player.team] ?? false;
            if (!gfx.visible) {
                return;
            }

            gfx.lineStyle(0.5, setLightness(player.color, 90));

            const planets = this.game.planets.filter(e => e.owner === player);
            for (const planet of planets) {
                gfx.drawCircle(planet.position.x, planet.position.y, planet.orbitDistance * 1.6);
                const sats = player.selection(planet);
                sats.forEach(sat => gfx.drawCircle(sat.position.x, sat.position.y, this.game.config.satelliteRadius));

                const itemCount = new PIXI.Text(sats.length);
                itemCount.x = planet.position.x;
                itemCount.y = planet.position.y - 30;
                itemCount.style.fill = setLightness(player.satelliteColor, 100);
                gfx.addChild(itemCount);
            }
        });
    }

    private setupPlanetStats(planet: Planet) {
        const text = new PIXI.Text('');
        text.style.fill = 0xffffff;
        this.dbg.addChild(text);

        this.updateFns.push(() => {
            text.visible = this.config.showPlanetStats;
            if (!text.visible) {
                return;
            }

            text.anchor.set(0.5, 0.5);
            text.position.x = planet.position.x;
            text.position.y = planet.position.y;
            text.text = planet.health + ':' + planet.upgrade + (planet.candidateOwner?.team[0] ?? '') + ':' + planet.level;
        });
    }

    private destroyChildren(container: PIXI.Container) {
        while(container.children[0]) {
            container.children[0].destroy();
        }
    }
}

export interface ViewTransform {
    tx: number;
    ty: number;
    scale: number;
}

export class Renderer {
    private app: PIXI.Application;
    private viewstate: Writable<ViewTransform> = writable({ tx: 0, ty: 0, scale: 0 });
    get transform(): Readable<ViewTransform> { return this.viewstate; };
    readonly viewport: Viewport;
    readonly dbg: DebugRender;

    constructor(element: HTMLCanvasElement, private game: Game, audio: Sound, player?: Player) {
        const app = new PIXI.Application({
            view: element,
            // forceCanvas: true,
            // resolution: 0.5,
            autoDensity: true,
            resizeTo: window,
        });
        this.app = app;

        // create viewport
        const viewport = this.viewport = new Viewport({
            worldWidth: game.config.maxWorld * 4,
            worldHeight: game.config.maxWorld * 4,
            // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
            interaction: app.renderer.plugins.interaction,
        });
        app.stage.addChild(viewport);
        app.renderer.on('resize', () => viewport.resize());
        app.stage.filters = [];
        viewport.filters = [];
        viewport
            .drag()
            .pinch()
            .wheel()
            .decelerate();

        viewport.clampZoom({
            maxScale: 3.5,
            minScale: 0.2,
        });
        viewport.clamp({
            top: -game.config.maxWorld * 2,
            bottom: game.config.maxWorld * 2,
            left: -game.config.maxWorld * 2,
            right: game.config.maxWorld * 2,
        });

        // start screen animation
        this.setScreenshotPosition();
        viewport.moveCenter(0, 0);
        const startPosition = (player && game.planets.find(e => e.owner === player))?.position ?? point(0, 0);
        viewport.animate({
            position: startPosition,
            removeOnInterrupt: true,
            ease: 'easeInOutQuad',
            time: 3000,
            scale: 1.5,
        });

        let strongBlur = new PIXI.filters.BlurFilter(50, 16);

        // Create the sprite and add it to the stage
        let satelliteTexture = PIXI.Texture.from('star.png');
        let planetTexture = PIXI.Texture.from('sun.png');

        let bgContainer = new PIXI.Container();
        viewport.addChild(bgContainer);
        let ringContainer = new PIXI.Container();
        ringContainer.filters = [strongBlur];
        viewport.addChild(ringContainer);
        let pulseContainer = new PIXI.Container();
        pulseContainer.filters = [strongBlur];
        viewport.addChild(pulseContainer);
        let planetContainer = new PIXI.Container();
        viewport.addChild(planetContainer);
        let satelliteContainer = new PIXI.ParticleContainer(constants.maxSatellites, { rotation: true, tint: true });
        viewport.addChild(satelliteContainer);
        let flashContainer = new PIXI.ParticleContainer(constants.maxSatellites, { tint: true, scale: true, rotation: true, alpha: true });
        viewport.addChild(flashContainer);

        const satelliteTracesPool: ArrayPool<TraceSFX> = new ArrayPool(() => new TraceSFX(satelliteTracesPool, createGraphics(satelliteTexture)));
        const targetFlashPool: ArrayPool<TargetSFX> = new ArrayPool(() => new TargetSFX(targetFlashPool, createGraphics(satelliteTexture)));

        let interactionContainer = new PIXI.Container();
        viewport.addChild(interactionContainer);
        const isPlayerSatellite = (sat: Satellite) => sat.owner === player && selector.contains(sat.position);
        let selector = new Selector(viewport, game, player);
        interactionContainer.addChild(selector.gfx);
        if (player) {
            viewport.on('pointerdown', ev => selector.pointerdown(ev));
            viewport.on('pointerup', ev => selector.pointerup(ev));
            selector.onMoveSatellites = (point: Point) => {
                const selection: Satellite[] = []
                game.satellites.forEach(sat => {
                    if (isPlayerSatellite(sat)) {
                        satelliteTracesPool.take().init(point, sat, flashContainer);
                        selection.push(sat);
                    }
                });
                targetFlashPool.take().init(point, pulseContainer);
                game.moveSatellites(player, selection, point);
            }
        }

        const cull = new Simple();
        // cull.addList(satelliteContainer.children);
        // cull.addList(pulseContainer.children);
        // cull.addList(flashContainer.children);
        // cull.cull(viewport.getVisibleBounds());
        // app.ticker.add(() => {
        //     if (viewport.dirty) {
        //         cull.cull(viewport.getVisibleBounds());
        //         viewport.dirty = false;
        //     }
        // });
        // app.ticker.maxFPS = 10;

        // dbg view (always add this last)
        this.dbg = new DebugRender(game, app, viewport, cull);

        const colorMap = game.players.reduce((map, player) => {
            let filter = new PIXI.filters.ColorMatrixFilter();
            filter.tint(player.color, true);
            map[player.team] = filter;
            return map;
        }, {})
        const greyTeamMatrix = new PIXI.filters.ColorMatrixFilter();
        greyTeamMatrix.tint(0x222222, true);
        colorMap['default'] = greyTeamMatrix;

        const filterSfxPool: ArrayPool<FilterSFX> = new ArrayPool(() => new FilterSFX(filterSfxPool, viewport));
        const pulsePool: ArrayPool<PulseSFX> = new ArrayPool(() => new PulseSFX(pulsePool, new PIXI.Graphics()));
        const flashPool: ArrayPool<FlashSFX> = new ArrayPool(() => new FlashSFX(flashPool, createGraphics(satelliteTexture)));
        const renderables: ArrayPool<Renderable>[] = [filterSfxPool, pulsePool, flashPool, targetFlashPool, satelliteTracesPool];

        const satellitePool: ArrayPool<SatelliteGFX> = new ArrayPool(() => new SatelliteGFX(satellitePool, createGraphics(satelliteTexture)));
        const planetPool: ArrayPool<PlanetGFX> = new ArrayPool(() => new PlanetGFX(planetPool, createGraphics(planetTexture), filterSfxPool, colorMap));

        game.forEachEntity(entity => entity.gfx = null);
        const renderInitializers = {
            'Satellite': (satellite: Satellite) => satellitePool.take().init(satellite, satelliteContainer, isPlayerSatellite),
            'Planet': (planet: Planet) => {
                const gfx = planetPool.take().init(planet, planetContainer, audio);
                ringContainer.addChild(gfx.rings);
                return gfx;
            },
        };

        // app.ticker.stop();
        app.ticker.add((delta) => {
            this.viewstate.set({ tx: viewport.x, ty: viewport.y, scale: viewport.scaled });
            this.dbg.tick(app);
            let elapsedMS = app.ticker.elapsedMS;
            // if we switch tabs, elapsedMS can get very large (seconds or minutes) and that will
            // mess up physics so process large pauses in 50ms increments. 50ms is chosen arbitrarily
            // here's more background https://codeincomplete.com/articles/javascript-game-foundations-the-game-loop/
            while (elapsedMS > 50) {
                game.tick(50);
                elapsedMS -= 50;
            }
            const state = game.tick(elapsedMS);

            game.forEachEntity(entity => {
                if (!entity.gfx) {
                    entity.gfx = renderInitializers[entity.type](entity);
                }
                entity.gfx.tick(state.elapsedMS);
            });

            if (state.log) {
                audio.pulse();
                pulseContainer.visible = this.dbg.config.enablePulseAnimation;
                game.planets.forEach(p => p.owner && pulsePool.take().init(p, pulseContainer));
            }
            state.removed.forEach(sat => flashPool.take().init(sat, flashContainer, audio));

            // a little weird to have the UI clear this but it works better for network games
            state.removed.clear();
            state.log = null;

            renderables.forEach(sfx => sfx.forEach(r => r.tick(state.elapsedMS)));
        });
    }

    destroy() {
        this.app.destroy(false, { baseTexture: true, children: true, texture: false });
    }

    base64Screenshot() {
        const size = 128;
        const corner = this.viewport.corner.clone();
        const scale = this.viewport.scale.clone();
        this.viewport.plugins.pause('clamp');
        this.viewport.plugins.pause('clamp-zoom');
        try {
            this.setScreenshotPosition(size);
            // https://www.html5gamedevs.com/topic/23467-how-to-get-the-screen-buffer-as-an-image/
            let renderTexture = PIXI.RenderTexture.create({ width: size, height: size });
            this.app.renderer.render(this.viewport, { renderTexture });

            const img = this.app.renderer.plugins.extract.base64(renderTexture);
            window.open(img)
            return img;
        } finally {
            this.viewport.plugins.resume('clamp');
            this.viewport.plugins.resume('clamp-zoom');
            this.viewport.scale = scale;
            this.viewport.corner = corner;
        }
    }

    private setScreenshotPosition(size = 128) {
        const margin = 200;
        const halfMargin = margin * 0.5;

        let bounds = PIXI.Rectangle.EMPTY;
        for (const p of this.game.planets) {
            const radius = p.orbitDistance;
            const diameter = radius * 2;
            bounds = bounds.enlarge(new PIXI.Rectangle(p.position.x - radius, p.position.y - radius, diameter, diameter));
        }

        const scale = Math.min(size / (bounds.width + margin), size / (bounds.height + margin));
        this.viewport.scale.set(scale);
        this.viewport.moveCorner(bounds.x - halfMargin, bounds.y - halfMargin);
    }
}

function createGraphics(texture: PIXI.Texture) {
    const gfx = PIXI.Sprite.from(texture);
    gfx.anchor.set(0.5, 0.5);
    return gfx;
}

class FilterSFX<T extends PIXI.Filter = PIXI.Filter> implements Renderable {
    private filter: T;
    private lifetimeMS: number;
    private ent: Entity;
    private tickFn: (vp: Viewport, ms: number) => void;
    constructor(readonly pool: ArrayPool<FilterSFX>, readonly viewport: Viewport) {}

    init(ent: Entity, lifetimeMS: number, filter: T, tickFn: (vp: Viewport, ms: number) => void) {
        this.ent = ent;
        this.tickFn = tickFn;
        this.lifetimeMS = lifetimeMS;
        this.filter = filter;
        this.viewport.filters.push(filter);
    }

    tick(elapsedMS: number): void {
        this.lifetimeMS -= elapsedMS;
        if (this.lifetimeMS < 0) {
            this.destroy();
            return;
        }

        // const bounds = this.viewport.getVisibleBounds();
        // if (!bounds.contains(this.ent.position.x, this.ent.position.y)) {
        //     this.filter.enabled = false;
        //     return;
        // }

        this.filter.enabled = true;
        this.tickFn(this.viewport, elapsedMS);
    }

    destroy(): void {
        if (this.pool.release(this)) {
            const idx = this.viewport.filters.indexOf(this.filter);
            this.viewport.filters.splice(idx, 1);
            // can't destroy because it seems to cause crashes... odd
            // this.filter.destroy();
        }
    }
}

class SFX<T extends PIXI.Container = PIXI.Container> implements Renderable {
    protected alphaInt = new Interpolator();
    protected rotationInt = new Interpolator();
    protected sizeInt = new Interpolator();
    protected xPoint = new Interpolator();
    protected yPoint = new Interpolator();

    constructor(private pool: ArrayPool<SFX<T>>, readonly gfx: T) {}

    sfxInit(container: PIXI.Container) {
        container.addChild(this.gfx);
        return this;
    }

    tick(elapsedMS: number): void {
        if (this.alphaInt.finished) {
            return this.destroy();
        }
        this.gfx.rotation = this.rotationInt.tick(elapsedMS);
        this.gfx.alpha = this.alphaInt.tick(elapsedMS);
        this.gfx.scale.set(this.sizeInt.tick(elapsedMS));
        this.gfx.position.x = this.xPoint.tick(elapsedMS);
        this.gfx.position.y = this.yPoint.tick(elapsedMS);
    }

    destroy () {
        this.pool.release(this);
        this.gfx.parent.removeChild(this.gfx);
    }

    protected position(point: Point) {
        this.xPoint.init(0, 0, point.x);
        this.yPoint.init(0, 0, point.y);
    }
}

class TargetSFX extends SFX<PIXI.Sprite> {
    init(point: Point, container: PIXI.Container) {
        this.alphaInt.init(2000, .6, 0, cubicOut);
        this.sizeInt.init(2000, 25, 30, cubicOut);
        this.rotationInt.init(2000, 0, Math.random() * Math.PI * 20);
        this.position(point);
        return super.sfxInit(container);
    }
}

class TraceSFX extends SFX<PIXI.Sprite> {
    init(point: Point, sat: Satellite, container: PIXI.Container) {
        const time = Math.random() * 100 + 400;
        this.xPoint.init(time, sat.position.x, point.x, cubicOut);
        this.yPoint.init(time, sat.position.y, point.y, cubicOut);
        this.alphaInt.init(time, .8, 0.2, cubicOut);
        this.sizeInt.init(0, 0, 1);
        this.rotationInt.init(time, 0, Math.random() * Math.PI * 30);
        return super.sfxInit(container);
    }
}

class PulseSFX extends SFX<PIXI.Graphics> {
    planet: Planet;

    init(planet: Planet, container: PIXI.Container) {
        this.sizeInt.init(2000, 0, 1);
        this.alphaInt.init(2000, 0.3, 0, cubicIn);
        this.planet = planet;

        this.gfx.clear();
        this.gfx.lineStyle(planet.orbitDistance, planet.owner.satelliteColor);
        this.gfx.drawCircle(0, 0, planet.orbitDistance * 2.5);
        return super.sfxInit(container);
    }

    tick(elapsedMS: number): void {
        super.tick(elapsedMS);
        this.gfx.rotation = this.planet.rotation;
        this.gfx.position = this.planet.position;
    }
}

class FlashSFX extends SFX<PIXI.Sprite> {
    init(sat: Satellite, container: PIXI.Container, audio: Sound) {
        const time = Math.random() * 300 + 200;
        if (sat.destroyedBy?.startsWith('s')) {
            // bigger explosion when destroyed by another satellite
            this.sizeInt.init(time, 1, 12 * Math.random() + 6, backOut);
            audio.satellitePop();
        } else {
            this.sizeInt.init(time, 1, 4, backOut);
            // no sound because the planet plays the absorb sound
        }
        this.gfx.tint = sat.owner.satelliteColor;
        this.alphaInt.init(time, 1, 0.1, backInOut);
        this.xPoint.init(time, sat.position.x, sat.position.x);
        this.yPoint.init(time, sat.position.y, sat.position.y);
        this.rotationInt.init(time, 0, Math.random() * Math.PI * 3);
        return super.sfxInit(container);
    }
}

class EntityGFX<T extends Entity, U extends PIXI.Container = PIXI.Container> implements Renderable {
    protected ent: T;
    constructor(private pool: ArrayPool<EntityGFX<any>>, readonly gfx: U) {}

    baseInit(entity: T, container: PIXI.Container) {
        this.ent = entity;
        container.addChild(this.gfx);
        return this;
    }

    tick(elapsedMS: number) {
        this.gfx.alpha = this.ent.alpha ?? 1;
        this.gfx.rotation = this.ent.rotation;
        this.gfx.scale.set(this.ent.size);
        this.gfx.position = this.ent.position;
    }

    destroy () {
        this.pool.release(this);
        this.gfx.parent.removeChild(this.gfx);
    }
}

class SatelliteGFX extends EntityGFX<Satellite, PIXI.Sprite> {
    private isPlayerSatellite: (sat: Satellite) => boolean;

    init(satellite: Satellite, container: PIXI.Container, isPlayerSatellite: (sat: Satellite) => boolean) {
        this.isPlayerSatellite = isPlayerSatellite;
        return super.baseInit(satellite, container);
    }

    tick(elapsedMS: number) {
        super.tick(elapsedMS);
        this.gfx.tint = this.isPlayerSatellite(this.ent) ? 0xaaaaaa : this.ent.owner.satelliteColor;
    }
}

const statusBarThickness = 8;
const statusOffset = -Math.PI * 0.5;
const circlePercent = Math.PI * 2 * 0.01;
class PlanetGFX extends EntityGFX<Planet, PIXI.Sprite> {
    private lastSize: number;
    private lastMaxLevel: number;
    private shockwaveInt = new ComboInterpolator();
    private sizeInt = new Interpolator();
    private planetAudio: PlanetAudio;
    private statusBarAlphaInt = new Interpolator();
    private statusBarAlphaLoop = new ComboInterpolator();
    rings: PIXI.Container;
    statusBars: PIXI.Graphics;
    constructor(pool: ArrayPool<PlanetGFX>, gfx: PIXI.Sprite, readonly fpool: ArrayPool<FilterSFX>, readonly colorMap: any) {
        super(pool, gfx);
    }

    init(planet: Planet, container: PIXI.Container, audio: Sound) {
        this.rings = new PIXI.Container();
        this.setupRings(planet);
        this.planetAudio = new PlanetAudio(planet, audio);

        this.statusBarAlphaLoop.init([this.statusBarAlphaInt.init(1000, 0.6, 0.8)], 'reverse');
        this.lastSize = planet.size;
        this.lastMaxLevel = planet.maxLevel;
        this.sizeInt.init(0, 0, planet.size);
        this.statusBars = new PIXI.Graphics();
        this.statusBars.alpha = 0.8;

        super.baseInit(planet, container);
        container.addChild(this.statusBars);
        return this;
    }

    private setupRings(planet: Planet) {
        this.rings.removeChildren();
        let rings: PIXI.Graphics[] = [];
        for (let i = 1; i < planet.maxLevel; i++) {
            const gfx = new PIXI.Graphics();
            this.rings.addChild(gfx);
            rings.push(gfx);

            const step = planet.game.config.planetRadius / 8;
            const radius = i * step + step;
            gfx.alpha = 0.5;
            gfx.lineStyle(step, 0x777777);
            gfx.drawCircle(0, 0, radius * 3);
        }
    }

    tick(elapsedMS: number) {
        super.tick(elapsedMS);
        this.planetAudio.tick(elapsedMS);

        const planet = this.ent;
        if (this.lastSize !== planet.size) {
            this.shockwave(planet);
            this.sizeInt.init(2000, this.lastSize, planet.size, backInOut);
            this.lastSize = planet.size;
        }
        this.gfx.scale.set(this.sizeInt.tick(elapsedMS));

        if (this.lastMaxLevel !== planet.maxLevel) {
            this.lastMaxLevel = planet.maxLevel;
            this.setupRings(planet);
        }

        this.gfx.filters = [this.colorMap[planet.owner?.team ?? 'default']];

        this.statusBars.clear();
        this.statusBars.alpha = this.statusBarAlphaLoop.tick(elapsedMS);
        if (this.statusBarAlphaLoop.finished) {
            const time = Math.ceil((planet.health < 100 ? planet.health : (100 - planet.upgrade)) / 10);
            this.statusBarAlphaInt.init(time * 200, 0.6, 0.8);
        }
        if (planet.upgrade > 0) {
            this.drawStatusBar(planet, planet.upgrade, planet.orbitDistance * 0.6, 0x404040, planet.candidateOwner?.color ?? planet.owner.color);
        }
        if (planet.health < 100) {
            this.drawStatusBar(planet, planet.health, planet.orbitDistance * 0.8, 0xa0a0a0, planet.owner.color);
        }

        for (let i = 0; i < this.rings.children.length; i++) {
            this.rings.children[i].visible = (planet.level <= i + 1);
        }
        this.rings.position = planet.position;
    }

    private shockwave(planet: Planet) {
        const growing = (this.lastSize < planet.size);
        const filter = new ShockwaveFilter();
        filter.radius = -1;
        filter.time = growing ? 0 : 1.5;
        const duration = 1500;
        const amplitude = 20;
        this.shockwaveInt.init([
            new Interpolator().init(200, 0, amplitude),
            new Interpolator().init(duration - 800, amplitude, amplitude),
            new Interpolator().init(600, amplitude, 0, cubicOut),
        ], 'stop');
        this.fpool.take().init(planet, duration, filter, (vp, ms) => {
            const screenPos = vp.worldTransform.apply(planet.position);
            filter.center = screenPos;
            filter.time += (growing ? (ms / 1000) : -(ms / 1000));
            filter.wavelength = 150 * vp.scale.x;
            filter.speed = 240 * vp.scale.x;
            filter.amplitude = this.shockwaveInt.tick(ms) * vp.scale.x;
        });
    }

    private drawStatusBar(planet: Planet, percentage: number, radius: number, grey: number, color: number) {
        this.statusBars.lineStyle(statusBarThickness, grey);
        this.statusBars.drawCircle(planet.position.x, planet.position.y, radius);
        this.statusBars.lineStyle(statusBarThickness + 2, color);
        this.statusBars.moveTo(planet.position.x, planet.position.y - radius);
        this.statusBars.arc(planet.position.x, planet.position.y, radius, statusOffset, statusOffset + percentage * circlePercent);
    }

    destroy () {
        this.planetAudio.destroy();
        this.statusBars.destroy();
        this.rings.destroy({ children: true });
        super.destroy();
    }
}
