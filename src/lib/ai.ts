import type { Satellite } from "./game.js";
import { distSqr, QuadTree, type Point } from "./math.js";

// why are these types here? Because vite (or rullup) doesn't work well with circular imports
// (ie. game imports ai, ai imports game).
export interface IGame {
    planets: IPlanet[];
    collisionTree: QuadTree<ISatellite>;

    config: { planetRadius: number };
}
export interface IPlayer {
    game: IGame;
    selection(planet: IPlanet): ISatellite[];
}
export interface IPlanet {
    position: Point;
    owner?: IPlayer;
    candidateOwner?: IPlayer;

    upgrade: number;
    level: number;
    maxLevel: number;
    health: number;
    orbitDistance: number;
}
export interface ISatellite {
    position: Point;
    owner: IPlayer;
    moveToPlanet(planet: IPlanet): void;
}

export interface AIConfig {
    // max and min time between evaluating the map
    maxThinkGapMS: number;
    minThinkGapMS: number;
    // min satellites before moving
    minSatellites: number;
    // chance to heal
    healChance: number;
    // move satellites between planets
    transferChance: number;
    // upgrade a planet
    upgradeChance: number;
    // attack the closest, weakest, enemy
    attackChance: number;
    // conquer a vacant planet
    conquerChance: number;
}
export abstract class AIPlayer {
    private nextThink: number;
    enabled = true;

    constructor(readonly config: AIConfig) {}

    abstract tick(player: IPlayer, ms: number): void;

    protected shouldTick(ms: number) {
        if (!this.enabled) {
            return false;
        }
        this.nextThink -= ms;
        if (this.nextThink > 0) {
            return false;
        }
        this.nextThink = Math.random() * (this.config.maxThinkGapMS - this.config.minThinkGapMS) + this.config.minThinkGapMS;
        return true;
    }

    protected moveToPlanet(satellites: ISatellite[], planet: IPlanet) {
        satellites.forEach(s => s.moveToPlanet(planet));
    }
}

export class AIPlayer1 extends AIPlayer {
    tick(player: IPlayer, ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        // take action based on the satellites around each planet
        const planets = player.game.planets.filter(e => e.owner === player);
        // const unownedPlanets = this.game.planets.filter(e => !e.owner);
        // for (const planet of unownedPlanets) {
        //     const sats = this.satelliteTree.query(planet.position, planetRadius * 1.3);
        //     if (sats.length < this.config.minSatellies && Math.random() > this.config.conquerChance) {
        //         // planets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
        //         this.moveToPlanet(satellites, planet);
        //     }
        // }

        // TODO do I have stars near an open planet?
        for (const planet of planets) {
            const sats = player.selection(planet);
            // we have 100 so we can do something...
            if (sats.length > this.config.minSatellites) {
                this.takeAction(player, planets, planet, sats);
            }
        }
    }

    takeAction(player: IPlayer, planets: IPlanet[], planet: IPlanet, satellites: ISatellite[]) {
        // We could definitely do better but for now, we use random numbers to evaluate these decisions:
        // Can I upgrade? Should I?
        // TODO Should I heal?
        // Do I have enough satellites to conquer a planet?
        // Do I have enough satellites to attack someone else?
        // TODO Am I under attack and need to setup defense?
        const canUpgrade = planet.level < planet.maxLevel;
        const openPlanets = player.game.planets.filter(p => !p.owner);
        const enemyPlanets = player.game.planets.filter(p => p.owner && p.owner !== player);
        const someSatellites = () => satellites.slice(0,
            Math.max(Math.random() * satellites.length, 100))

        if (canUpgrade && Math.random() < this.config.upgradeChance) {
            this.moveToPlanet(satellites, planet);
        } else if(planet.health < 100 && Math.random() < this.config.healChance) {
            this.moveToPlanet(someSatellites(), planet);
        } else if(openPlanets.length && Math.random() < this.config.conquerChance) {
            openPlanets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), openPlanets[0]);
        } else if (enemyPlanets.length && Math.random() < this.config.attackChance) {
            enemyPlanets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), enemyPlanets[0]);
        } else if (planets.length && Math.random() < this.config.transferChance) {
            planets.sort((a, b) => distSqr(a.position, planet.position) - distSqr(b.position, planet.position));
            this.moveToPlanet(someSatellites(), planets[0]);
        }
    }
}

export class AIPlayer2 extends AIPlayer {
    tick(player: IPlayer, ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        const game = player.game;
        // TODO: better to use collision tree or graph search?
        const tree = new QuadTree<IPlanet>(3);
        player.game.planets.forEach(p => tree.insert(p, game.config.planetRadius));

        const someSatellites = (sats: ISatellite[]) =>
            sats.slice(0, Math.max(Math.random() * sats.length, this.config.minSatellites));

        const myPlanets = game.planets.filter(e => e.owner === player);
        if (myPlanets.length === game.planets.length) {
            return;
        }
        for (const planet of myPlanets) {
            const sats = player.selection(planet);
            if (sats.length < this.config.minSatellites) {
                continue;
            }

            let targets: IPlanet[] = [];
            let searchRadius = game.config.planetRadius;
            while (targets.length < 1) {
                tree.query(planet.position, searchRadius, p => {
                    if (p.owner !== planet.owner) {
                        targets.push(p);
                    }
                });
                searchRadius *= 1.5;
            }

            const openPlanets = targets.filter(p => !p.owner);
            const enemyPlanets = targets.filter(p => p.owner && p.owner !== player);
            const planetScore = (a: IPlanet, b: IPlanet) => (
                (distSqr(a.position, planet.position) - distSqr(b.position, planet.position))
            );

            if (planet.level < planet.maxLevel && Math.random() < this.config.upgradeChance) {
                this.moveToPlanet(someSatellites(sats), planet);
            } else if(planet.health < 100 && Math.random() < this.config.healChance) {
                this.moveToPlanet(someSatellites(sats), planet);
            } else if(openPlanets.length && Math.random() < this.config.conquerChance) {
                openPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), openPlanets[0]);
            } else if (enemyPlanets.length && Math.random() < this.config.attackChance) {
                enemyPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), enemyPlanets[0]);
            } else if (myPlanets.length && Math.random() < this.config.transferChance) {
                myPlanets.sort(planetScore);
                this.moveToPlanet(someSatellites(sats), myPlanets[0]);
            }
        }

        // should I upgrade?
        // should I expand into nearby open planets?
        // can I transfer units to the edge of my territory?
        // do I have enough satellites to attack a neighbour?
    }
}

interface NeighbourInfo {
    planet: IPlanet;
    distance: number;
}
interface PlanetInfo {
    planet: IPlanet,
    satellites: ISatellite[];
    neighbours: NeighbourInfo[];
}
const buildGameBoard = (game: IGame) => {
    const map = new Map<IPlanet, PlanetInfo>();
    for (const p1 of game.planets) {
        const neighbours: NeighbourInfo[] = [];
        for (const p2 of game.planets) {
            neighbours.push({
                planet: p2,
                distance: distSqr(p2.position, p1.position),
            });
        }
        neighbours.sort((a, b) => distSqr(p1.position, a.planet.position) - distSqr(p1.position, b.planet.position));

        const radius = p1.orbitDistance * 1.6;
        const radiusSqr = radius * radius;
        const satellites: ISatellite[] = [];
        game.collisionTree.query(p1.position, radius, sat => {
            if (distSqr(sat.position, p1.position) < radiusSqr) {
                satellites.push(sat);
            }
        })
        map.set(p1, { planet: p1, neighbours, satellites });
    }
    return map;
};

export class AIPlayer3 extends AIPlayer {
    tick(player: IPlayer, ms: number) {
        if (!this.shouldTick(ms)) {
            return;
        }

        // TODO: better to use collision tree or graph search?
        const game = player.game;
        const tree = new QuadTree<IPlanet>(3);
        game.planets.forEach(p => tree.insert(p, game.config.planetRadius));

        const someSatellites = (sats: ISatellite[]) =>
            sats.slice(0, Math.max(Math.random() * sats.length, this.config.minSatellites));

        const myPlanets = game.planets.filter(e => e.owner === player);
        if (myPlanets.length === game.planets.length) {
            return;
        }

        const gameBoard = buildGameBoard(game);
        for (const info of gameBoard.values()) {
            if (info.planet.owner && info.planet.owner !== player) {
                // not my planet
                continue;
            }

            // as we get closer to minSatellites, we get closer to making a move
            const mySats = info.satellites.filter(sat => sat.owner === player);
            if (Math.random() > (mySats.length / this.config.minSatellites)) {
                continue;
            }

            const maxGap = (a: number, b: number) => Math.max(a, b - a);
            const score = ({ distance, planet }: NeighbourInfo) =>
                (distance === 0 ? 1 : (1 / distance)) * (
                    (1 * (planet.owner === player && planet.health < 100 ? maxGap(100 - planet.health, mySats.length) : 0)) +
                    (4 * (planet.owner === player && planet.level < planet.maxLevel ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (6 * (planet.candidateOwner === player ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (2 * (planet.candidateOwner !== player ? -planet.upgrade : 0)) +
                    (.25 * (!planet.owner ? maxGap(planet.upgrade, mySats.length) : 0)) +
                    (2 * (!planet.owner ? planet.maxLevel : 0)) +
                    (4 * (planet.owner !== player ? (mySats.length - gameBoard.get(planet).satellites.length) : 0)) +
                    0
                );
            const nn = Array.from(info.neighbours).sort((a, b) => score(b) - score(a));
            this.moveToPlanet(someSatellites(mySats), nn[0].planet);
        }
    }
}
