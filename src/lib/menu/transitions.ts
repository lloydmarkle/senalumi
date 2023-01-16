import { type FlyParams, fly as svelteFly } from 'svelte/transition';

let count = 0;
export function delayFly(el: Element, item: number = undefined) {
    if (typeof item === 'number') {
        count = item;
    }
    let delay = (++count) * 60 + 100;
    return fly(el, { x: -20, delay });
}

export function fly(el: Element, opts?: FlyParams) {
    return svelteFly(el, { x: -20, ...(opts ?? {}) });
}