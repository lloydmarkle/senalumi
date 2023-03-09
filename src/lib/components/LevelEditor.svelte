<script lang="ts">
    import { fly } from 'svelte/transition';
    import WorldSpaceOverlay from "./WorldSpaceOverlay.svelte";
    import TeamSelectionIcon from './TeamSelectionIcon.svelte';
    import { Game, type GameMap, Planet, initializerFromMap, Satellite } from "../game";
    import { distSqr, originPoint, point, QuadTree, type Point } from "../math";
    import type { Renderer } from "../render";
    import { playerTeams } from '../data';
    import { appContext } from '../../context';


    export let mapProps: GameMap['props'];
    export let game: Game;
    export let gfx: Renderer;

    const { menu } = appContext();

    function hackGame(game: Game) {
        game.planets.forEach(p => p.destroy());
        game.start(0);
        game.players.forEach(player => player.ai.enabled = false);
        game.pulse = () => {};
    }
    hackGame(game);

    let drag = { planet: null };
    $: document.body.classList.toggle('dragging', drag.planet);

    let selectedPlanet: Planet;
    function mouseUp(ev: MouseEvent) {
        drag.planet = null;
        selectedPlanet = null;

        const worldPosition = gfx.viewport.toWorld(ev);
        const planetMap = new QuadTree<Planet>(1);
        const radiusSquare = game.config.planetRadius * game.config.planetRadius;
        game.planets.forEach(p => planetMap.insert(p, game.config.planetRadius));
        planetMap.query(worldPosition, 5, planet => {
            if (distSqr(planet.position, worldPosition) < radiusSquare) {
                selectedPlanet = planet;
                gfx.viewport.animate({
                    position: selectedPlanet.position,
                    time: 500,
                    scale: .75,
                    ease: 'easeInOutQuad',
                });
            }
        });
    }

    $: selectionNeighbours = selectedPlanet ? findNearest(selectedPlanet) : null;
    function findNearest(planet: Planet) {
        const mid = (p1: Point, p2: Point) => point((p1.x + p2.x) * .5, (p1.y + p2.y) * .5);
        const sortedPlanets = game.planets
            .sort((a, b) => distSqr(planet.position, a.position) - distSqr(planet.position, b.position));
        const closePlanets = sortedPlanets.filter(p => p !== planet && distSqr(planet.position, p.position) < 1000000);
        const planets = (closePlanets.length < 6) ? sortedPlanets.slice(0, 6) : closePlanets;
        return planets.map<[Planet, number, Point]>(p => [p, Math.sqrt(distSqr(planet.position, p.position)), mid(planet.position, p.position)]);
    }

    function mouseMove(ev: MouseEvent) {
        if (drag.planet) {
            selectedPlanet = selectedPlanet; // hack to update selection box while dragging
            const worldPosition = gfx.viewport.toWorld(ev);
            drag.planet.position.x = worldPosition.x;
            drag.planet.position.y = worldPosition.y;
        }
    }

    function assignPlanetOwner(planet: Planet, team?: string) {
        const player = game.players.find(p => p.team === team);
        planet.capture(player);
        updatePlanet();
    }

    let promptDelete = false;
    $: if (!selectedPlanet) promptDelete = false;
    function deletePlanet(planet: Planet) {
        let sats: Satellite[] = [];
        game.collisionTree.query(planet.position, planet.orbitDistance * 2, sat => sats.push(sat));
        sats.filter(sat => sat.owner === planet.owner).forEach(sat => sat.destroy());

        selectedPlanet = null;
        game.planets = game.planets.filter(p => p !== planet);
        planet.destroy();
    }

    function newPlanet() {
        selectedPlanet = new Planet(game, originPoint(), 1);
        game.planets = [...game.planets, selectedPlanet];
    }

    function updatePlanet() {
        // svelte hack to update ui
        selectedPlanet = selectedPlanet;

        // update initial satellites
        const expectedSatellites = selectedPlanet.owner ? selectedPlanet.initialSatellites : 0;
        let sats: Satellite[] = [];
        game.collisionTree.query(selectedPlanet.position, selectedPlanet.orbitDistance * 2, sat => sats.push(sat));
        // remove any satellites from the team (if team changes)
        sats.filter(s => s.owner !== selectedPlanet.owner).forEach(s => s.destroy());
        sats = sats.filter(s => s.owner === selectedPlanet.owner);
        // add any new sats (when initial gets bigger)
        while (sats.length < expectedSatellites) {
            game.spawnSatellite(selectedPlanet);
            sats.push(null); // placeholder just to change array length
        }
        // remove sats (when initial gets smaller)
        while (sats.length > expectedSatellites) {
            sats.pop().destroy();
        }
    }

    function exportMap() {
        mapProps.img = gfx.base64Screenshot();
        // https://stackoverflow.com/questions/13405129
        const map: GameMap = {
            props: mapProps,
            planets: game.planets.map(p => ({
                initialSatellies: p.initialSatellites,
                level: p.level,
                ownerTeam: p.owner?.team,
                maxLevel: p.maxLevel,
                position: p.position,
            }))
        };
        const url = URL.createObjectURL(new Blob([JSON.stringify(map)], { type: 'application/json'}));
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = mapProps.name.replace(' ', '-');
        // a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }

    function importMap() {
        // https://web.dev/read-files/
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.type = 'file';
        input.id = 'map-import';
        input.accept = 'application/json';
        input.multiple = false;
        input.onchange = (ev: any) => {
            // set to null to force LevelEditorScreen to mount a new GameView
            game = null;
            const file = ev.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', (event) => {
                const map: GameMap = JSON.parse(event.target.result.toString());
                // persist mapProps so that it reloads when the component reloads
                mapProps = map.props;
                game = new Game(initializerFromMap(map));
            });
            reader.readAsText(file);
        }
        input.click();
        setTimeout(() => document.body.removeChild(input), 0);
    }

    function hackPlanet(debugPlanet: Planet, prop: keyof Planet, value: any): any {
        (debugPlanet as any)[prop] = value;
        updatePlanet();
    }

    let planetLevels = [1, 2, 3, 4];
</script>

<svelte:body
    on:mouseup={mouseUp}
    on:mousemove={mouseMove} />

<div class="world-settings hstack">
    <span>
        <label for="map-name">Map name</label>
        <input type="text" name="map-name" id="map-name" bind:value={mapProps.name}>
    </span>
    <button on:click={newPlanet}>+ Planet</button>
    <button on:click={importMap}>Load</button>
    <button on:click={exportMap}>Save</button>
    <button on:click={() => $menu = 'start'}>Quit</button>
</div>

{#if selectedPlanet}
    <WorldSpaceOverlay {gfx}>
        <svg
            aria-hidden="true"
            class="svg-box"
            viewBox="{-game.config.maxWorld} {-game.config.maxWorld} {game.config.maxWorld * 2} {game.config.maxWorld * 2}"
            xmlns="http://www.w3.org/2000/svg">
            {#each selectionNeighbours as [neighbour, dist, mid]}
                <circle
                    cx="{neighbour.position.x}"
                    cy="{neighbour.position.y}"
                    r="{10}" fill="#fff" />
                <text fill="#fff" x={mid.x} y={mid.y}>{dist.toFixed(2)}</text>
                <path fill="none" stroke="#fff" d="M{selectedPlanet.position.x},{selectedPlanet.position.y} L{neighbour.position.x},{neighbour.position.y}" />
            {/each}
        </svg>

        <div in:fly={{ y: -10 }}
            class="planet-editor"
            style="--planet-radius:{game.config.planetRadius * 2}px; height:0; transform:translate({selectedPlanet.position.x}px, {selectedPlanet.position.y}px)"
        >
            <div class="planet-box">
                <div
                    class="drag-box"
                    on:mousedown|stopPropagation={() => drag.planet = selectedPlanet}
                >Move</div>
            </div>
            <div on:mouseup|stopPropagation class="planet-props">
                <div class="hstack">
                    <span>Max Level {selectedPlanet.maxLevel}</span>
                    <div>
                        {#each planetLevels as level}
                            <button
                                on:click={() => hackPlanet(selectedPlanet, 'maxLevel', level)}
                                class:selected-button={level === selectedPlanet.maxLevel}
                            >{level}</button>
                        {/each}
                    </div>
                </div>
                {#if selectedPlanet.owner}
                    <div class="hstack">
                        <span>Starting level {selectedPlanet.level}</span>
                        <div>
                            {#each planetLevels as level}
                                <button
                                    on:click={() => hackPlanet(selectedPlanet, 'level', level)} disabled={level > selectedPlanet.maxLevel}
                                    class:selected-button={level === selectedPlanet.level}
                                >{level}</button>
                            {/each}
                        </div>
                    </div>
                {/if}
                <div class="hstack">
                    <span>Team</span>
                    <div>
                        {#each playerTeams as team}
                            <button class="list-button" on:click={() => assignPlanetOwner(selectedPlanet, team.value)}>
                                <TeamSelectionIcon color={team.value} />
                            </button>
                        {/each}
                    </div>
                </div>
                {#if selectedPlanet.owner}
                    <div class="hstack">
                        <span>Initial satellites {selectedPlanet.initialSatellites}</span>
                        <input type="range" min="0" max="1000" step="25" on:change={updatePlanet} bind:value={selectedPlanet.initialSatellites} />
                    </div>
                {/if}
                <div class="hstack">
                    {#if promptDelete}
                        <span>Really delete?</span>
                        <button on:click={() => deletePlanet(selectedPlanet)}>Yes</button>
                        <button on:click={() => promptDelete = false}>No</button>
                    {:else}
                        <button on:click={() => promptDelete = true}>Delete</button>
                    {/if}
                </div>
            </div>
        </div>
    </WorldSpaceOverlay>
{/if}

<style>
    .world-settings {
        position: fixed;
        top: 1em;
        right: 2em;
        padding: 1rem 2rem;
        opacity: 0.2;
        background: var(--theme-background);
        border-radius: var(--theme-border-radius);
        transition: opacity 0.3s
    }
    .world-settings:hover {
        opacity:1
    }

    .list-button {
        background: var(--theme-background);
        padding: 0;
    }
    .selected-button {
        z-index: 1;
        position: relative;
        box-shadow: 0px 0px 4px 2px var(--theme-link);
    }

    .world-settings button {
        padding: 1rem 2rem;
    }

    .drag-box {
        transition: background 0.3s, filter 0.3s;
        position: relative;
        user-select: none;
        padding: 2rem;
        cursor: grab;
    }
    .drag-box::before {
        position: absolute;
        transform: translate(-33%, -40%);
        width: 8em;
        height: 8em;
        border-radius: 100%;
        content:'';
        box-shadow: 0px 0px 6px 1px var(--theme-foreground);
        background: var(--theme-gradient-bg1);
        transition: background 0.2s;
        z-index: -1;
    }
    .drag-box:hover::before {
        background: var(--theme-gradient-fg1);
    }
    .drag-box:active {
        filter: invert(20%);
    }

    .hstack {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem
    }

    .svg-box {
        position:absolute;
        top:0; bottom:0; left:0; right:0;
        transform: translate(-50%, -50%) scale(15.6 /* but.... why?? */);
        pointer-events:none;
    }

    .planet-editor {
        position: relative;
    }
    .planet-props {
        position: relative;
        transform: translateX(-50%);
        top: calc(var(--planet-radius) * -0.5);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem 2rem;
        border-bottom-right-radius: var(--theme-border-radius);
        border-bottom-left-radius: var(--theme-border-radius);
        background: linear-gradient(to bottom, var(--theme-gradient-fg1), var(--theme-gradient-fg2));
        box-shadow: 0px 0px 4px 2px var(--theme-link);
    }

    .planet-box {
        position: relative;
        transform: translate(-50%, -50%);
        width: var(--planet-radius);
        height: var(--planet-radius);
        box-shadow: 0px -1px 4px 2px var(--theme-link);
        border-top-right-radius: var(--theme-border-radius);
        border-top-left-radius: var(--theme-border-radius);

        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>