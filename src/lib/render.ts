import { type Point, distSqr, QuadTree, ArrayPool, lirp } from './math';
import { Game, constants, type Player, setLightness, Planet, type Renderable, Pulse, Flash, Satellite, type Entity } from './game';
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport'
import { Simple } from "pixi-cull"
import type { ListenerFn } from 'eventemitter3';

class Selector {
    private dragMove: ListenerFn;
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
        this.dragMove = ev => {
            const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
            this.pointermove(point);
        };
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
        this.viewport.on('pointermove', this.dragMove);
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
                } else {
                    this._mode = 'select';
                    // this.viewport.plugins.pause('drag');
                    // this.viewport.off('pointermove', this.dragMove);
                }
                console.log('set-mode',this._mode)
            }

            if (this._mode !== 'drag') {
                this.update(point);
            }
        }
    }

    pointerup() {
        // this.viewport.plugins.resume('drag');
        this.viewport.off('pointermove', this.dragMove);
        if (this._mode === 'none') {
            this.clearGfx();
        }
        this._mode = 'none';
        this.downStart = 0;
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
                    map[p.owner.id] = (map[p.owner.id] ?? 0) + p.level;
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
            gfx.visible = this.config.showPlayerSelection[player.id] ?? false;
            if (!gfx.visible) {
                return;
            }

            gfx.lineStyle(0.5, setLightness(player.color, 90));

            const planets = this.game.planets.filter(e => e.owner === player);
            for (const planet of planets) {
                gfx.drawCircle(planet.position.x, planet.position.y, planet.orbitDistance * 1.6);
                const sats = player.selection(planet);
                sats.forEach(sat => gfx.drawCircle(sat.position.x, sat.position.y, this.game.constants.satelliteRadius));

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
            text.text = planet.health + ':' + planet.upgrade + (planet.candidateOwner?.id[0] ?? '') + ':' + planet.level;
        });
    }

    private destroyChildren(container: PIXI.Container) {
        while(container.children[0]) {
            container.children[0].destroy();
        }
    }
}

const lastApp = (app?: any) =>
    (window as any).lastApp = app ?? (window as any).lastApp;

export class Renderer {
    paused = false;
    readonly dbg: DebugRender;
    readonly app: PIXI.Application;
    constructor(game: Game) {
        if (import.meta.hot && lastApp()) {
            lastApp().destroy(false, { baseTexture: true, children: true, texture: true });
        }

        const player = game.players.find(p => !('elapsedFromLastThink' in p));
        const isPlayerSatellite = (sat: any) => sat.owner === player && selector.contains(sat.position);
        // const isPlayerSatellite = (sat: any) => selector.contains(sat.position);
        let app = new PIXI.Application({
            view: document.querySelector("#game") as HTMLCanvasElement,
            autoDensity: true,
            resizeTo: window,
        });
        lastApp(this.app = app);

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
        viewport
            // .drag()
            .pinch()
            .wheel()
            .decelerate();

        // activate plugins
        viewport.clampZoom({
            maxScale: 3,
            minScale: 0.2,
        })
        viewport.clamp({
            top: -game.constants.maxWorld,
            bottom: game.constants.maxWorld,
            left: -game.constants.maxWorld,
            right: game.constants.maxWorld,
        })
        viewport.moveCenter(0, 0);
        viewport.setZoom(0.4);

        // Create the sprite and add it to the stage
        let satelliteTexture = PIXI.Texture.from('star.png');
        let planetTexture = PIXI.Texture.from('sun.png');

        let bgContainer = new PIXI.Container();
        viewport.addChild(bgContainer);
        let ringContainer = new PIXI.Container();
        ringContainer.filters = [
            new PIXI.filters.BlurFilter(50, 16),
        ];
        viewport.addChild(ringContainer);
        let pulseContainer = new PIXI.Container();
        pulseContainer.filters = [
            new PIXI.filters.BlurFilter(50, 16),
        ];
        viewport.addChild(pulseContainer);
        let planetContainer = new PIXI.Container();
        viewport.addChild(planetContainer);
        let satelliteContainer = new PIXI.ParticleContainer(constants.maxSatellites, { rotation: true, tint: true });
        viewport.addChild(satelliteContainer);
        let flashContainer = new PIXI.ParticleContainer(constants.maxSatellites, { scale: true, rotation: true, alpha: true });
        viewport.addChild(flashContainer);

        let interactionContainer = new PIXI.Container();
        viewport.addChild(interactionContainer);
        let selector = new Selector(viewport);
        interactionContainer.addChild(selector.gfx);
        viewport.on('pointerdown', ev => {
            const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
            selector.pointerdown(point);
        });
        viewport.on('pointerup', ev => {
            if (selector.mode === 'none') {
                const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
                const selection = []
                game.satellites.forEach(sat => {
                    if (isPlayerSatellite(sat)) {
                        selection.push(sat);
                    }
                });
                game.moveSatellites(player, selection, point);
            }
            selector.pointerup();
        });
        // app.ticker.maxFPS = 10;

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

        // dbg view (always add this last)
        this.dbg = new DebugRender(game, app, viewport, cull);

        const colorMap = game.players.reduce((map, player) => {
            let filter = new PIXI.filters.ColorMatrixFilter();
            filter.tint(player.color, true);
            map[player.id] = filter;
            return map;
        }, {})
        const greyTeamMatrix = new PIXI.filters.ColorMatrixFilter();
        greyTeamMatrix.tint(0x222222, true);
        colorMap['default'] = greyTeamMatrix;

        const pulsePool: ArrayPool<PulseGFX> = new ArrayPool(() => new PulseGFX(pulsePool, new PIXI.Graphics()));
        const flashPool: ArrayPool<EntityGFX<Flash, PIXI.Sprite>> = new ArrayPool(() => new EntityGFX(flashPool, createGraphics(satelliteTexture)));
        const satellitePool: ArrayPool<SatelliteGFX> = new ArrayPool(() => new SatelliteGFX(satellitePool, createGraphics(satelliteTexture)));
        const planetPool: ArrayPool<PlanetGFX> = new ArrayPool(() => new PlanetGFX(planetPool, createGraphics(planetTexture), colorMap));

        const renderInitializers = {
            'Pulse': (pulse: Pulse) => pulsePool.take().init(pulse, pulseContainer),
            'Flash': (flash: Flash) => flashPool.take().baseInit(flash, flashContainer),
            'Satellite': (satellite: Satellite) => satellitePool.take().init(satellite, satelliteContainer, isPlayerSatellite),
            'Planet': (planet: Planet) => planetPool.take().init(planet, planetContainer, game),
        };

        app.ticker.add((delta) => {
            this.dbg.tick(app);
            if (this.paused) {
                return;
            }

            const elapsedMS = app.ticker.elapsedMS * constants.gameSpeed;
            game.tick(elapsedMS);

            pulseContainer.visible = this.dbg.config.enablePulseAnimation;
            game.forEachEntity(entity => {
                if (!entity.gfx) {
                    entity.gfx = renderInitializers[entity.type](entity);
                }
                entity.gfx.update(entity, elapsedMS);
            })
        });
    }
}

function createGraphics(texture: PIXI.Texture) {
    const gfx = PIXI.Sprite.from(texture);
    gfx.anchor.set(0.5, 0.5);
    return gfx;
}

class EntityGFX<T extends Entity, U extends PIXI.Container = PIXI.Container> implements Renderable {
    constructor(private pool: ArrayPool<EntityGFX<any>>, readonly gfx: U) {}

    baseInit(entity: T, container: PIXI.Container) {
        container.addChild(this.gfx);
        return this;
    }

    update(ent: Entity, elapsedMS: number) {
        this.gfx.alpha = ent.alpha ?? 1;
        this.gfx.rotation = ent.rotation;
        this.gfx.scale.set(ent.size);
        this.gfx.position = ent.position;
    }

    destroy () {
        this.pool.release(this);
        this.gfx.parent.removeChild(this.gfx);
    }
}

class PulseGFX extends EntityGFX<Pulse, PIXI.Graphics> {
    init(pulse: Pulse, container: PIXI.Container) {
        this.gfx.clear();
        this.gfx.position = pulse.position;
        this.gfx.lineStyle(pulse.planet.orbitDistance, pulse.planet.owner.satelliteColor);
        this.gfx.drawCircle(0, 0, pulse.planet.orbitDistance * 2.5);
        return super.baseInit(pulse, container);
    }
}

class SatelliteGFX extends EntityGFX<Satellite, PIXI.Sprite> {
    private isPlayerSatellite: (sat: Satellite) => boolean;

    init(satellite: Satellite, container: PIXI.Container, isPlayerSatellite: (sat: Satellite) => boolean) {
        this.isPlayerSatellite = isPlayerSatellite;
        return super.baseInit(satellite, container);
    }

    update(sat: Satellite, elapsedMS: number) {
        super.update(sat, elapsedMS);
        this.gfx.tint = this.isPlayerSatellite(sat) ? 0xaaaaaa : sat.owner.satelliteColor;
    }
}

const statusBarThickness = 5;
const statusOffset = -Math.PI * 0.5;
const circlePercent = Math.PI * 2 * 0.01;
class PlanetGFX extends EntityGFX<Planet, PIXI.Sprite> {
    private rings: PIXI.Container;
    private lastSize: number;
    private sizeInt = lirp();
    statusBars: PIXI.Graphics;
    constructor(pool: ArrayPool<PlanetGFX>, gfx: PIXI.Sprite, readonly colorMap: any) {
        super(pool, gfx);
    }

    init(planet: Planet, container: PIXI.Container, game: Game) {
        this.rings = new PIXI.Container();

        let rings: PIXI.Graphics[] = [];
        for (let i = 1; i < planet.maxLevel; i++) {
            const gfx = new PIXI.Graphics();
            this.rings.addChild(gfx);
            rings.push(gfx);

            const step = game.constants.planetRadius / 8;
            const radius = i * step + step;
            gfx.alpha = 0.5;
            gfx.lineStyle(step, 0x777777);
            gfx.drawCircle(0, 0, radius * 3);
        }

        this.lastSize = planet.size;
        this.sizeInt.init(0, 0, planet.size);
        this.statusBars = new PIXI.Graphics();
        this.statusBars.alpha = 0.8;

        super.baseInit(planet, container);
        container.addChild(this.statusBars);
        return this;
    }

    update(planet: Planet, elapsedMS: number) {
        super.update(planet, elapsedMS);

        if (this.lastSize !== planet.size) {
            this.sizeInt.init(1000, this.lastSize, planet.size);
            this.lastSize = planet.size;
        }
        this.gfx.scale.set(this.sizeInt.tick(elapsedMS));

        this.gfx.filters = [this.colorMap[planet.owner?.id ?? 'default']];

        this.statusBars.clear();
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

    private drawStatusBar(planet: Planet, percentage: number, radius: number, grey: number, color: number) {
        this.statusBars.lineStyle(statusBarThickness, grey);
        this.statusBars.drawCircle(planet.position.x, planet.position.y, radius);
        this.statusBars.lineStyle(statusBarThickness, color);
        this.statusBars.arc(planet.position.x, planet.position.y, radius, statusOffset, statusOffset + percentage * circlePercent);
    }

    destroy () {
        this.statusBars.destroy();
        this.rings.destroy({ children: true });
        super.destroy();
    }
}
