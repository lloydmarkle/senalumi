<script lang="ts">
    import { type GameStateSnapshot, teamColor, type Team } from './game';
    import { fly } from 'svelte/transition';
    import * as Pancake from '@sveltejs/pancake';

    export let data: GameStateSnapshot[];

    let teamColourString = (team: Team) => ('#' + teamColor(team).toString(16));

    let teams = Array.from(data[0].satelliteCounts.keys());
    let teamPoints = teams.map(team =>
        data.map(e => ({ team, time: e.time, count: (e.satelliteCounts.get(team) ?? 0) })));

	let minx = teamPoints[0][0].time;
	let maxx = teamPoints[0].at(-1).time;
	let miny = +Infinity;
	let maxy = -Infinity;

    for (let j = 0; j < teams.length; j++) {
        for (let i = 0; i < teamPoints[j].length; i += 1) {
            const point = teamPoints[j][i];
            miny = Math.min(point.count, miny);
            maxy = Math.max(point.count, maxy);
        }
    }

    let highlights = data.filter(e => e.events.length);
    let blurBackground = false;

    function formatMinute(n: number) {
        let seconds = n % 60;
        let minutes = n / 60;
        return minutes.toFixed(0).padStart(2, '0') + ':' + seconds.toFixed(0).padStart(2, '0')
    }
</script>

<div class="container"
    class:container-visible={blurBackground}
    on:introend={() => blurBackground = true}
    on:outroend={() => blurBackground = false}
    transition:fly={{ y: (window.innerHeight * -0.8) }}
    >
    <div class="chart">
        <Pancake.Chart x1={minx} x2={maxx} y1={miny} y2={maxy}>
            <Pancake.Grid horizontal count={5} let:value let:last>
                <div class="grid-line horizontal"><span>{value} {last ? '' : ''}</span></div>
            </Pancake.Grid>

            <Pancake.Grid vertical count={10} let:value>
                <div class="grid-line vertical"></div>
                <span class="year-label">{formatMinute(value)}</span>
            </Pancake.Grid>

            <Pancake.Svg>
                {#each teamPoints as item}
                    <Pancake.SvgLine data={item} x={e => e.time} y={e => e.count} let:d>
                        <path class="avg" {d} stroke={teamColourString(item[0].team)} />
                    </Pancake.SvgLine>
                {/each}
            </Pancake.Svg>

            <!-- <Pancake.Quadtree data={points} x="{d => d.date}" y="{d => d.avg}" let:closest>
                {#if closest}
                    <Pancake.Point x={closest.date} y={closest.avg} let:d>
                        <div class="focus"></div>
                        <div class="tooltip" style="transform: translate(-{pc(closest.date)}%,0)">
                            <strong>{closest.avg} ppm</strong>
                            <span>{format(closest.date)}</span>
                        </div>
                    </Pancake.Point>
                {/if}
            </Pancake.Quadtree> -->

            <!-- annotate events -->
            <div class="annotation-container">
                {#each highlights as highlight}
                    {#each highlight.events as gameEvent}
                        <Pancake.Point x={highlight.time} y={maxy}>
                            <div class="annotation {gameEvent.type}" style="color:{teamColourString(gameEvent.team)}">
                                {gameEvent.type === 'planet-upgrade' ? '+' :
                                gameEvent.type === 'planet-capture' ? '▲' :
                                gameEvent.type === 'planet-lost' ? '▼' :
                                ''}
                            </div>
                        </Pancake.Point>
                    {/each}
                {/each}
            </div>
        </Pancake.Chart>
    </div>
</div>

<style>
    .container {
        display: flex;
        align-items: center;
        justify-content: center;

        transition: backdrop-filter 2s;
        backdrop-filter: blur(5px) opacity(0);
        background: linear-gradient(to bottom, rgb(200, 200, 200, 0.1), rgb(200, 200, 200, 0.3));
        position: absolute;
        top: 0;
        left: 0;
        right:0;
        /* width: 100vw; */
        height: 100vh;
    }
    .container-visible {
        backdrop-filter: blur(5px) opacity(1);
    }

    .chart {
        width: 80vw;
		height: 60vh;
		padding: 3em;
		max-width: 80em;
		max-height: 60em;
		margin: 0 auto;
        background: rgba(0,0,0, 0.5);
	}

	.grid-line {
		position: relative;
		display: block;
	}

	.grid-line.horizontal {
		width: calc(100% + 2em);
		left: -2em;
		border-bottom: 1px dashed #ccc;
	}

	.grid-line.vertical {
		height: 100%;
		border-left: 1px dashed #ccc;
	}

	.grid-line span {
		position: absolute;
		left: 0;
		bottom: 2px;
		line-height: 1;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
	}

	.year-label {
		position: absolute;
		width: 4em;
		left: -2em;
		bottom: -30px;
		font-family: sans-serif;
		font-size: 14px;
		color: #999;
		text-align: center;
	}

    .annotation-container {
        height: 100px;
        background: rgba(255, 255, 255, 0.1);
    }
    .annotation {
        position: absolute;
        /* right:0.5em; */
        /* top:-0.5em; */
        font-size:1.5em;
        font-weight:1000;
    }

	.text {
		position: absolute;
		width: 15em;
		line-height: 1;
		color: #666;
		transform: translate(0,-50%);
		text-shadow: 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white, 0 0 8px white;
	}

	.text p {
		margin: 0;
		line-height: 1.2;
		color: #999;
	}

	.text h2 {
		margin: 0;
		font-size: 1.4em;
	}

	path.avg {
		opacity: 0.9;
		stroke-linejoin: round;
		stroke-linecap: round;
		stroke-width: 4px;
		fill: none;
	}

	path.scatter {
		stroke-width: 3px;
	}

	.focus {
		position: absolute;
		width: 10px;
		height: 10px;
		left: -5px;
		top: -5px;
		border: 1px solid black;
		border-radius: 50%;
		box-sizing: border-box;
	}

	.tooltip {
		position: absolute;
		white-space: nowrap;
		width: 8em;
		bottom: 1em;
		/* background-color: white; */
		line-height: 1;
		text-shadow: 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white, 0 0 10px white;
	}

    .planet-capture {
        top: 0em;
    }
    .planet-upgrade {
        top: 1em;
    }
    .planet-lost {
        top: 2em;
    }

	.tooltip strong {
		font-size: 1.4em;
		display: block;
	}
</style>