import { Game } from '../lib/game.js';
import { performance, PerformanceObserver } from 'perf_hooks';
import { memoryUsage } from 'node:process';

// neat little hack https://stackoverflow.com/a/75007985
import { setFlagsFromString } from 'v8';
import { runInNewContext } from 'vm';
setFlagsFromString('--expose_gc');
const megabyte = 1024 * 1024;

// https://stackoverflow.com/questions/7343890
const stats = (arr: number[], usePopulation = false) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    const standardDeviation= Math.sqrt(
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), [])
            .reduce((acc, val) => acc + val, 0) / (arr.length - (usePopulation ? 0 : 1))
    );
    return { mean, standardDeviation };
};

describe('perf', () => {
    it('benchmark', () => {
        let entries = [];
        const obs = new PerformanceObserver((list) => {
            entries = entries.concat(list.getEntries()[0]);
        });
        obs.observe({ entryTypes: ['gc'] });
        const timings = [];
        const memory = [];

        // simulate several ticks of a game 10 times to calculate some averages
        for (let i = 0; i < 10; i++) {
            const game = new Game();
            game.start();
            while (game.satellites.length < 2000) {
                game.pulse();
                game.tick(10);
            }

            runInNewContext('gc')();
            const mstart = memoryUsage.rss();
            const tstart = performance.now();
            for (let i = 0; i < 10000; i++) {
                game.tick(20);
            }
            timings.push(performance.now() - tstart);
            memory.push((memoryUsage.rss() - mstart) / megabyte);
            process.stdout.write('.')
        }
        obs.disconnect();
        console.log('raw', timings, memory, entries);
        console.log('cpu',stats(timings));
        console.log('mem',stats(memory));
    }).timeout(100_000);
});
