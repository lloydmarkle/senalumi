import { Game } from '../lib/game.js';
import { performance, PerformanceObserver } from 'perf_hooks';

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

        // simulate several ticks of a game with 2,000 satellites
        for (let i = 0; i < 10; i++) {
            const game = new Game();
            while (game.satellites.length < 2000) {
                game.pulse();
                game.tick(20);
            }

            const start = performance.now();
            for (let i = 0; i < 500; i++) {
                game.tick(16);
            }
            timings.push(performance.now() - start);
        }
        obs.disconnect();
        console.log(timings, entries);
        console.log(stats(timings));
    }).timeout(100000);
});
