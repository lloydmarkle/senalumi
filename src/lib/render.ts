import { type Point, distSqr, QuadTree } from './math';
import { Game, constants, type Player, setLightness } from './game';
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

class DebugRender {
    private overlayInfo = {
        lastTime: new Date(),
        fps: 0,
        frames: 0,
    };
    private dbg: PIXI.Container;
    private overlayText: PIXI.Text;
    private dbgFns: Function[] = [];
    updateFrequencyMS = 500;

    constructor(private game: Game, container: PIXI.Container, gameview: PIXI.Container) {
        this.overlayText = new PIXI.Text('');
        this.overlayText.x = 50;
        this.overlayText.y = 100;
        this.overlayText.style.fill = 0xffffff;
        this.overlayText.scale.set(0.5);
        container.addChild(this.overlayText);
        this.showOverlayInfo();

        this.dbg = new PIXI.Container();
        gameview.addChild(this.dbg);
    }

    tick(app: PIXI.Application) {
        const now = new Date();
        this.overlayInfo.frames += 1;
        this.overlayInfo.fps += app.ticker.FPS;
        if (now.getTime() - this.overlayInfo.lastTime.getTime() > this.updateFrequencyMS) {
            this.overlayInfo.lastTime = now;
            this.dbgFns.forEach(fn => fn());
        }
    }

    clear() {
        this.dbgFns = [];
        this.dbg.removeChildren();
        this.showOverlayInfo();
    }

    showOverlayInfo() {
        this.dbgFns.push(() => {
            const satStats = {};
            this.game.satellites.forEach(sat => {
                satStats[sat.owner.id] = (satStats[sat.owner.id] ?? 0) + 1;
            });
            const planets = this.game.planets.reduce((map, p) => {
                if (p.owner) {
                    map[p.owner.id] = (map[p.owner.id] ?? 0) + p.level;
                }
                return map;
            }, {});
            const stats = Object.keys(satStats)
                .sort((a, b) => satStats[b] - satStats[a])
                .map(team => `${team}: ${satStats[team]} satellites, ${planets[team] ?? 0}/s`);

            const perfStats = [];
            Object.keys(this.game.stats.collisionStages).forEach(stage => {
                perfStats.push(`collision-${stage}: ${this.game.stats.collisionStages[stage].toFixed(2)}`);
            });
            perfStats.push(`moveTime: ${this.game.stats.moveTime.toFixed(2)}ms`);
            perfStats.push(`collideTime: ${this.game.stats.collideTime.toFixed(2)}ms`);
            perfStats.push(`pulseTime: ${this.game.stats.pulseTime.toFixed(2)}ms`);
            perfStats.push(`thinkTime: ${this.game.stats.thinkTime.toFixed(2)}ms`);
            perfStats.push(`gameTime: ${this.game.stats.gameTime.toFixed(2)}ms`);

            this.overlayText.text = [
                (this.overlayInfo.fps / this.overlayInfo.frames).toFixed(2) + 'fps',
                this.game.satellites.length + ' satellites',
                'stats: [', '  ' + stats.join('\n  '), ']',
                'perf: [', '  ' + perfStats.join('\n  '), ']',
            ].join('\n');
            this.overlayInfo.fps = 0;
            this.overlayInfo.frames = 0;
        });
    }

    quadTree() {
        let gfx = new PIXI.Graphics();
        this.dbg.addChild(gfx);

        this.dbgFns.push(() => {
            gfx.clear();
            gfx.removeChildren();
            let colors = [0xD2042D, 0xCC5500, 0xFFF44F, 0x7CFC00, 0x1111DD, 0x7F00FF, 0xFF10F0];

            let q: Array<[number, QuadTree<any>]> = [];
            q.push([0, this.game.collisionTree]);
            while (q.length){
                const [ci, item] = q.shift();
                let color = colors[ci % colors.length];
                item.children.forEach(e => q.push([ci + 1, e]));
                gfx.lineStyle(4 / (ci + 1), color);
                gfx.drawRect(item.topLeft.x, item.topLeft.y, item.bottomRight.x - item.topLeft.x, item.bottomRight.y - item.topLeft.y);

                const itemCount = new PIXI.Text(item.data.length);
                itemCount.scale.set(0.25);
                itemCount.x = (item.topLeft.x + item.bottomRight.x) / 2;
                itemCount.y = (item.topLeft.y + item.bottomRight.y) / 2;
                itemCount.style.fill = color;
                gfx.addChild(itemCount);
            }
        });
    }

    planetSelections(player: Player) {
        let gfx = new PIXI.Graphics();
        this.dbg.addChild(gfx);

        this.dbgFns.push(() => {
            gfx.clear();
            gfx.removeChildren();
            gfx.lineStyle(0.5, setLightness(player.color, 90));

            const planets = this.game.planets.filter(e => e.owner === player);
            for (const planet of planets) {
                gfx.drawCircle(planet.position.x, planet.position.y, this.game.constants.planetRadius);
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
}

export class Renderer {
    readonly dbg: DebugRender;
    readonly app: PIXI.Application;
    constructor(game: Game) {
        if (import.meta.hot && this.app) {
            this.app.destroy(true, { baseTexture: true, children: true, texture: true });
        }

        const player = game.players[0];
        const isPlayerSatellite = (sat: any) => sat.owner === player && selector.contains(sat.position);
        // const isPlayerSatellite = (sat: any) => selector.contains(sat.position);
        let app = new PIXI.Application({
            view: document.querySelector("#game") as HTMLCanvasElement,
            autoDensity: true,
            resizeTo: window,
        });
        this.app = app;

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
            .drag()
            .pinch()
            .wheel()
            .decelerate();

        // activate plugins
        viewport.clampZoom({
            maxScale: 1.8,
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

        let greyTeamMatrix = new PIXI.filters.ColorMatrixFilter();
        greyTeamMatrix.tint(0x222222, true);
        let teamColours = game.players.reduce((map, player) => {
            let filter = new PIXI.filters.ColorMatrixFilter();
            filter.tint(player.color, true);
            map[player.id] = filter;
            return map;
        }, {})

        // Create the sprite and add it to the stage
        let satelliteTexture = PIXI.Texture.from('star.png');
        let planetTexture = PIXI.Texture.from('sun.png');

        let bgContainer = new PIXI.Container();
        let planetContainer = new PIXI.Container();
        let satellieContainer = new PIXI.ParticleContainer(constants.maxSatellites, { rotation: true, tint: true });
        let flashContainer = new PIXI.ParticleContainer(constants.maxSatellites, { scale: true, rotation: true, alpha: true });
        let interactionContainer = new PIXI.Container();

        let selector = new Selector(viewport);
        interactionContainer.addChild(selector.gfx);
        // viewport.plugins.pause('drag');
        // viewport.on('pointerdown', ev => {
        //     const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        //     selector.pointerdown(point);
        // });
        // viewport.on('pointermove', ev => {
        //     const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        //     selector.pointermove(point);
        // });
        // viewport.on('pointerup', ev => {
        //     if (selector.mode === 'none') {
        //         const point = viewport.toWorld(ev.data.global.x, ev.data.global.y);
        //         const selection = game.satellites.filter(isPlayerSatellite);
        //         game.moveSatellites(player, selection, point);
        //     }
        //     selector.pointerup();
        // });
        // app.ticker.maxFPS = 10;

        viewport.addChild(bgContainer);
        viewport.addChild(planetContainer);
        viewport.addChild(satellieContainer);
        viewport.addChild(flashContainer);
        viewport.addChild(interactionContainer);

        // dbg view (always add this last)
        this.dbg = new DebugRender(game, app.stage, viewport);

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

        app.ticker.add((delta) => {
            this.dbg.tick(app);
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

            game.satellites.forEach(satellite => {
                if (satellite.render) {
                    satellite.render();
                    return;
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
            });
        });
    }
}