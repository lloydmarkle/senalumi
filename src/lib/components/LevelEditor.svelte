<script lang="ts">
    import { fly } from 'svelte/transition';
    import Select from './Select.svelte';
    import WorldSpaceOverlay from "./WorldSpaceOverlay.svelte";
    import { Game, type GameMap, Planet, type Team, initializerFromMap, Satellite } from "../game";
    import { distSqr, originPoint, QuadTree } from "../math";
    import type { Renderer } from "../render";
    import { playerTeams } from '../data';

    export let mapProps: GameMap['props'];
    export let game: Game;
    export let gfx: Renderer;

    function hackGame(game: Game) {
        game.start(0);
        game.players.forEach(player => player.ai.enabled = false);
        game.pulse = () => {};
    }
    hackGame(game);

    let drag = { planet: null };
    $: document.body.classList.toggle('dragging', drag.planet);
    $: console.log('map props',mapProps)

    let debugPlanet: Planet;
    function mouseUp(ev: MouseEvent) {
        drag.planet = null;
        debugPlanet = null;

        const worldPosition = gfx.viewport.toWorld(ev);
        const planetMap = new QuadTree<Planet>(1);
        const radiusSquare = game.config.planetRadius * game.config.planetRadius;
        game.planets.forEach(p => planetMap.insert(p, game.config.planetRadius));
        planetMap.query(worldPosition, 5, planet => {
            if (distSqr(planet.position, worldPosition) < radiusSquare) {
                debugPlanet = planet
            }
        });
    }

    function mouseMove(ev: MouseEvent) {
        if (drag.planet) {
            debugPlanet = debugPlanet; // hack to update selection box while dragging
            const worldPosition = gfx.viewport.toWorld(ev);
            drag.planet.position.x = worldPosition.x;
            drag.planet.position.y = worldPosition.y;
        }
    }

    function assignPlanetOwner(planet: Planet, team?: Team) {
        const player = game.players.find(p => p.team === team);
        planet.capture(player);
        updatePlanet();
    }

    let promptDelete = false;
    $: if (!debugPlanet) promptDelete = false;
    function deletePlanet(planet: Planet) {
        debugPlanet = null;
        game.planets = game.planets.filter(p => p !== planet);
        planet.destroy();
    }

    function newPlanet() {
        debugPlanet = new Planet(game, originPoint(), 1);
        game.planets = [...game.planets, debugPlanet];
    }

    function updatePlanet() {
        // svelte hack to update ui
        debugPlanet = debugPlanet;

        // update initial satellites
        const expectedSatellites = debugPlanet.owner ? debugPlanet.initialSatellites : 0;
        let sats: Satellite[] = [];
        game.collisionTree.query(debugPlanet.position, debugPlanet.orbitDistance * 2, sat => sats.push(sat));
        // remove any satellites from the team (if team changes)
        sats.filter(s => s.owner !== debugPlanet.owner).forEach(s => s.destroy());
        sats = sats.filter(s => s.owner === debugPlanet.owner);
        // add any new sats (when initial gets bigger)
        while (sats.length < expectedSatellites) {
            game.spawnSatellite(debugPlanet);
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
</script>

<svelte:body
    on:mouseup={mouseUp}
    on:mousemove={mouseMove} />

<div class="world-settings vstack">
    <span>
        <input type="text" name="map-name" id="map-name" bind:value={mapProps.name}>
        <label for="map-name">Map name</label>
    </span>
    <button on:click={newPlanet}>+ Planet</button>
    <button on:click={importMap}>Load</button>
    <button on:click={exportMap}>Save</button>
</div>

{#if debugPlanet}
    <WorldSpaceOverlay {gfx}>
        <div in:fly={{ y: -10 }} style="--planet-radius:{game.config.planetRadius * 2}px; transform:translate({debugPlanet.position.x}px, {debugPlanet.position.y}px)">
            <div class="planet-box">
                <div
                    class="drag-box"
                    on:mousedown|stopPropagation={() => drag.planet = debugPlanet}
                >Move</div>
            </div>
            <div on:mouseup|stopPropagation class="planet-editor">
                <span class="hstack">
                    <input type="range" min="1" max="4" bind:value={debugPlanet.maxLevel} on:change={updatePlanet} />
                    <span>Max Level {debugPlanet.maxLevel}</span>
                </span>
                <span class="hstack">
                    <input type="range" min={debugPlanet.owner ? 1 : 0} max={debugPlanet.maxLevel} on:change={updatePlanet} bind:value={debugPlanet.level} />
                    <span>Level {debugPlanet.level} (max {debugPlanet.maxLevel})</span>
                </span>
                <span class="hstack">
                    <span>Team</span>
                    <Select options={playerTeams} value={debugPlanet.owner?.team} on:select={ev => assignPlanetOwner(debugPlanet, ev.detail.value)} />
                </span>
                {#if debugPlanet.owner}
                <span class="hstack">
                    <input type="range" min="0" max="1000" step="25" on:change={updatePlanet} bind:value={debugPlanet.initialSatellites} />
                    <span>Initial satellites {debugPlanet.initialSatellites}</span>
                </span>
                {/if}
                <span class="hstack">
                    {#if promptDelete}
                        <span>Confirm delete?</span>
                        <button on:click={() => deletePlanet(debugPlanet)}>Yes</button>
                        <button on:click={() => promptDelete = false}>No</button>
                    {:else}
                        <button on:click={() => promptDelete = true}>Delete</button>
                    {/if}
                </span>
            </div>
        </div>
    </WorldSpaceOverlay>
{/if}

<style>
    .world-settings {
        position: fixed;
        bottom: 5rem;
        right: 4rem;
        padding: 1rem 2rem;
        opacity: 0.2;
        background: grey;
        transition: opacity 0.3s
    }
    .world-settings:hover {
        opacity:1
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
        top: -1em;
        left: -1em;
        border-radius: 100%;
        width: 8em;
        height: 8em;
        content:'';
        background:rgba(0, 0, 0, .4);
        transition: background 0.2s;
        z-index: -1;
    }
    .drag-box:hover::before {
        background: rgba(0, 0, 0, .7);
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

    .vstack {
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        gap: 1rem
    }
    .planet-editor {
        position: relative;
        top: calc(var(--planet-radius) * -1.5);
        left: calc(var(--planet-radius) * 0.5);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem 2rem;
        background: linear-gradient(to bottom, rgba(50, 50, 50, 0.9), rgba(50, 50, 50, 0.8));
        box-shadow: 0px 0px 4px 2px blue;
    }

    .planet-box {
        position: relative;
        top: calc(var(--planet-radius) * -0.5);
        left: calc(var(--planet-radius) * -0.5);
        width: var(--planet-radius);
        height: var(--planet-radius);
        box-shadow: 0px 0px 4px 2px blue;

        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>