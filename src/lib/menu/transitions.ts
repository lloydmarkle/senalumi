import { type FlyParams, fly as svelteFly, type BlurParams, blur } from 'svelte/transition';

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


// Fade should be fine but blur performs better in firefox
export const fade = (el: Element, props?: BlurParams) => blur(el, { amount: 0, ...props });
