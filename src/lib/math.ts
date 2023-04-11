import { linear } from 'svelte/easing';
import { create as createPool } from 'deepool';

export interface Point {
    x: number;
    y: number;
}
export const point = (x: number, y: number) => ({ x, y });
export const originPoint = () => point(0, 0);

export const distSqr = (a: Point, b: Point) => {
    const x = (a.x - b.x);
    const y = (a.y - b.y);
    return x * x + y * y
};

// Use a growing pool of quad tree for less gc
const quadTreePool: Pool<QuadTree<any>> = createPool(() => new QuadTree<any>());
const boxPool: Pool<Box> = createPool(() => new Box())

class Box {
    left: number;
    top: number;
    right: number;
    bottom: number;

    init(left: number, top: number, right: number, bottom: number) {
        if (left > right || top > bottom)  {
            throw new Error('invalid box ' + JSON.stringify({ x1: left, y1: top, x2: right, y2: bottom }));
        }
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        return this;
    }

    intersectBox(box: Box) {
        return !(box.left > this.right || box.right < this.left || box.top > this.bottom || box.bottom < this.top);
    }
}

// Memory efficient version based on the "loose quadtree" from https://stackoverflow.com/questions/41946007
export class QuadTree<T extends { position: Point }> {
    private nw: QuadTree<T>;
    private ne: QuadTree<T>;
    private se: QuadTree<T>;
    private sw: QuadTree<T>;
    data: T[] = [];
    constructor(private capacity = 10, private box: Box = null) {}

    get topLeft() { return point(this.box.left, this.box.top); }
    get bottomRight() { return point(this.box.right, this.box.bottom); }
    get children() { return this.nw ? [this.nw, this.ne, this.se, this.sw] : []; }

    walk(fn: (items: T[]) => void) {
        if (this.nw) {
            this.nw.walk(fn);
            this.ne.walk(fn);
            this.se.walk(fn);
            this.sw.walk(fn);
        } else {
            fn(this.data);
        }
    }

    clean() {
        this.data = [];
        const isLeaf = this.nw &&
            this.nw.data.length === 0 && this.ne.data.length === 0 &&
            this.sw.data.length === 0 && this.se.data.length === 0;

        if (this.nw) {
            this.nw.clean();
            this.ne.clean();
            this.se.clean();
            this.sw.clean();
        }

        if (isLeaf) {
            this.nw.recycle();
            this.ne.recycle();
            this.se.recycle();
            this.sw.recycle();
            this.nw = this.ne = this.se = this.sw = null;
        }
    }

    private recycle() {
        boxPool.recycle(this.box);
        quadTreePool.recycle(this);
        this.box = null;
    }

    insert(t: T, radius: number) {
        if (!this.box) {
            this.box = boxPool.use().init(t.position.x - radius, t.position.y - radius, t.position.x + radius, t.position.y + radius);
        } else {
            this.box.left = Math.min(this.box.left, t.position.x - radius);
            this.box.top = Math.min(this.box.top, t.position.y - radius);
            this.box.right = Math.max(this.box.right, t.position.x + radius);
            this.box.bottom = Math.max(this.box.bottom, t.position.y + radius);
        }
        this.add(t, radius);
    }

    private add(t: T, radius: number) {
        if (this.nw) {
            return this.child(t).insert(t, radius);
        }
        if (this.data.length < this.capacity) {
            return this.data.push(t);
        }
        this.subdivide(radius);
        this.child(t).add(t, radius);
    }

    private subdivide(radius: number) {
        const halfx = (this.box.left + this.box.right) * .5;
        const halfy = (this.box.top + this.box.bottom) * .5;
        this.nw = this.setup(this.box.left, this.box.top, halfx, halfy);
        this.ne = this.setup(halfx, this.box.top, this.box.right, halfy);
        this.se = this.setup(halfx, halfy, this.box.right, this.box.bottom);
        this.sw = this.setup(this.box.left, halfy, halfx, this.box.bottom);

        // push points to children
        for (let i = 0; i < this.data.length; ++i) {
            let d = this.data[i];
            this.child(d).add(d, radius);
        }
        this.data = [];
    }

    private setup(x1: number, y1: number, x2: number, y2: number) {
        const tree = quadTreePool.use();
        tree.capacity = this.capacity;
        tree.box = boxPool.use().init(x1, y1, x2, y2);
        return tree;
    }

    private child(t: T) {
        return (t.position.y < this.nw.box.bottom)
            ? ((t.position.x < this.nw.box.right) ? this.nw : this.ne)
            : ((t.position.x < this.nw.box.right) ? this.sw : this.se);
    }

    query(point: Point, radius: number, fn: (t: T) => void) {
        const box = boxPool.use().init(point.x - radius, point.y - radius, point.x + radius, point.y + radius);
        this.findPoints(box, fn);
        boxPool.recycle(box);
    }

    private findPoints(box: Box, fn: (t :T) => void) {
        if (!this.box) {
            return;
        }
        if (!box.intersectBox(this.box)) {
            return;
        }
        if (this.nw) {
            this.nw.findPoints(box, fn);
            this.ne.findPoints(box, fn);
            this.se.findPoints(box, fn);
            this.sw.findPoints(box, fn);
        } else {
            for (let i = 0; i < this.data.length; ++i) {
                fn(this.data[i]);
            }
        }
    }
}

interface Pool<T> {
    use(): T;
    recycle(item: T): void;
}

export class GrowOnlyArray<T> {
    private items: T[] = [];
    private count = 0;

    forEach(fn: (item: T) => void) {
        for (let i = 0; i < this.items.length; ++i) {
            const e = this.items[i];
            if (e) {
                fn(e);
            }
        }
    }

    get length () { return this.count; }

    clear() {
        for (let i = 0; i < this.items.length; ++i) {
            this.items[i] = null;
        }
        this.count = 0;
    }

    add(item: T) {
        // this is apparently faster than this.items.findIndex()
        let idx = -1;
        for (let i = 0; i < this.items.length; ++i) {
            if (!this.items[i]) {
                idx = i;
                break;
            }
        }
        if (idx === -1) {
            idx = this.items.length;
            this.grow();
        }

        this.items[idx] = item;
        this.count += 1;
        return item;
    }

    remove(item: T) {
        // inspired by https://github.com/pixijs/pixijs/blob/dev/packages/display/src/Container.ts#L292 and
        // https://github.com/pixijs/pixijs/blob/4cbadba3e46c4987f505e76a7f4e844d95a120cc/packages/utils/src/data/removeItems.ts#L9
        for (let i = 0; i < this.items.length; ++i) {
            if (this.items[i] === item) {
                this.items[i] = null;
                this.count -= 1;
                return true;
            }
        }
        return false;
    }

    private grow() {
        let len = this.items.length;
        this.items.length += (len ?? 10);
        for (let i = len; i < this.items.length; ++i) {
            this.items[i] = null;
        }
    }
}

export class ArrayPool<T> {
    private pool: Pool<T>;
    private array = new GrowOnlyArray<T>();

    constructor(itemFactory: () => T) {
        this.pool = createPool(itemFactory);
    }

    get length() { return this.array.length; }
    forEach = (fn: (item: T) => void) => this.array.forEach(fn);
    take = () => this.array.add(this.pool.use());
    release = (item: T) => {
        if (this.array.remove(item)) {
            this.pool.recycle(item);
            return true;
        }
        return false;
    }
}

type EaseFn = (p: number) => number;
export class Interpolator {
    finished = true;
    value = 0;
    private lifetime: number;
    private age: number;
    private initial: number;
    private target: number;
    private timeFn: EaseFn;

    init(timeMS: number, start: number, stop: number, timeFn: EaseFn = linear) {
        this.age = 0;
        this.lifetime = timeMS;
        this.finished = false;
        this.initial = start;
        this.target = stop;
        this.timeFn = timeFn;
        return this;
    };

    tick(elapsedMS: number) {
        if (this.finished) {
            return this.value;
        }

        this.age += elapsedMS;
        if (this.age < this.lifetime) {
            const t = this.timeFn(this.age / this.lifetime);
            this.value = this.initial * (1 - t) + this.target * t;
        } else {
            this.finished = true;
            this.value = this.target;
        }
        return this.value;
    }

    reverse() {
        this.init(this.lifetime, this.target, this.initial, this.timeFn);
    }
}

type InterpolatorEnding = 'stop' | 'reverse' | 'loop' | 'reset';
export class ComboInterpolator {
    private interps: Interpolator[];
    private direction: number;
    private idx: number;
    private ending: InterpolatorEnding;
    private get interp() { return this.interps[this.idx]; }

    finished: boolean;
    get value() { return this.interp.value; }

    init(interpolators: Interpolator[], ending: InterpolatorEnding) {
        this.finished = false;
        this.interps = interpolators;
        this.direction = 1;
        this.idx = 0;
        this.ending = ending;
        return this;
    }

    tick(elapsedMS: number) {
        if (this.interp.finished) {
            this.idx += this.direction;
            if (this.idx === this.interps.length || this.idx < 0) {
                this.handleEnding();
            }
        }
        return this.interp.tick(elapsedMS);
    }

    private handleEnding() {
        if (this.ending === 'loop') {
            this.idx = 0;
        } else if (this.ending === 'reset') {
            this.idx = 0;
        } else if (this.ending === 'stop') {
            this.idx -= 1;
            this.direction = 0;
        } else if (this.ending === 'reverse') {
            this.direction *= -1;
            this.idx += this.direction;
            this.interps.forEach(int => int.reverse());
        }
    }
}