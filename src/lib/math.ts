import { create } from 'deepool';

export interface Point {
    x: number;
    y: number;
}
export const point = (x: number, y: number) => ({ x, y });
export const originPoint = () => point(0, 0);
export const copyPoint = (src: Point, tgt: Point) => {
    tgt.x = src.x;
    tgt.y = src.y;
};

export const distSqr = (a: Point, b: Point) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

class Box {
    constructor(public left: number, public top: number, public right: number, public bottom: number) {
        if (left > right || top > bottom)  {
            throw new Error('invalid box ' + JSON.stringify({ x1: left, y1: top, x2: right, y2: bottom }));
        }
    }

    intersectBox(box: Box) {
        return (
            this.contains(box.left, box.top)
            || this.contains(box.right, box.top)
            || this.contains(box.left, box.bottom)
            || this.contains(box.right, box.bottom)
        );
    }

    contains(x: number, y: number) {
        return x > this.left && x < this.right && y > this.top && y < this.bottom;
    }
}

// Use a growing pool of quad tree for less gc
const pool = createPool(() => new QuadTree<any>());

// Much more memory efficient version based on the "loose quadtree" from https://stackoverflow.com/questions/41946007
export class QuadTree<T extends { position: Point }> {
    private nw: QuadTree<T>;
    private ne: QuadTree<T>;
    private se: QuadTree<T>;
    private sw: QuadTree<T>;
    data: T[] = [];
    constructor(readonly capacity = 10, private box: Box = null) {}

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
        if (this.nw) {
            const isLeaf = this.nw || !(
                this.nw.data.length || this.ne.data.length ||
                this.sw.data.length || this.se.data.length);

            this.nw.clean();
            this.ne.clean();
            this.se.clean();
            this.sw.clean();

            if (isLeaf) {
                pool.recycle(this.nw);
                pool.recycle(this.ne);
                pool.recycle(this.se);
                pool.recycle(this.sw);
                this.nw = this.ne = this.se = this.sw = null;
            }
        }
    }

    insert(t: T, radius: number) {
        if (!this.box) {
            this.box = new Box(t.position.x - radius, t.position.y - radius, t.position.x + radius, t.position.y + radius);
        }
        this.box.left = Math.min(this.box.left, t.position.x - radius);
        this.box.top = Math.min(this.box.top, t.position.y - radius);
        this.box.right = Math.max(this.box.right, t.position.x + radius);
        this.box.bottom = Math.max(this.box.bottom, t.position.y + radius);
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
        const halfx = (this.box.left + this.box.right) / 2;
        const halfy = (this.box.top + this.box.bottom) / 2;
        this.nw = this.setup(pool.use(), this.box.left, this.box.top, halfx, halfy);
        this.ne = this.setup(pool.use(), halfx, this.box.top, this.box.right, halfy);
        this.se = this.setup(pool.use(), halfx, halfy, this.box.right, this.box.bottom);
        this.sw = this.setup(pool.use(), this.box.left, halfy, halfx, this.box.bottom);

        // push points to children
        for (const d of this.data) {
            this.child(d).add(d, radius);
        }
        this.data = [];
    }

    private setup(tree: QuadTree<T>, x1: number, y1: number, x2: number, y2: number) {
        (tree as any).capacity = this.capacity;
        if (tree.box) {
            tree.box.left = x1;
            tree.box.top = y1;
            tree.box.right = x2;
            tree.box.bottom = y2;
        } else {
            tree.box = new Box(x1, y1, x2, y2);
        }
        return tree;
    }

    private child(t: T) {
        return (t.position.y < this.nw.box.bottom)
            ? ((t.position.x < this.nw.box.right) ? this.nw : this.ne)
            : ((t.position.x < this.nw.box.right) ? this.sw : this.se);
    }

    query(point: Point, radius: number, fn: (t: T) => void) {
        const box = new Box(point.x - radius, point.y - radius, point.x + radius, point.y + radius);
        this.findPoints(box, fn);
    }

    private findPoints(box: Box, fn: (t :T) => void) {
        if (!this.box) {
            return;
        }
        if (!this.box.intersectBox(box) && !box.intersectBox(this.box)) {
            return;
        }
        if (this.nw) {
            this.nw.findPoints(box, fn);
            this.ne.findPoints(box, fn);
            this.se.findPoints(box, fn);
            this.sw.findPoints(box, fn);
        } else {
            this.data.forEach(fn);
        }
    }
}

interface Pool<T> {
    use: () => T;
    recycle: (item: T) => void;
}
function createPool<T>(creator: () => T): Pool<T> {
    return create(creator);
}

export class ArrayPool<T> {
    private pool: Pool<T>;
    private items: T[] = [];
    private count = 0;

    constructor(itemFactory: () => T) {
        this.pool = createPool(itemFactory);
    }

    forEach(fn: (item: T) => void) {
        this.items.forEach(e => e && fn(e));
    }

    get length () { return this.count; }

    take() {
        const sat = this.pool.use();
        let idx = this.items.findIndex(e => !e);
        if (idx === -1) {
            this.grow();
            idx = this.count;
        }
        this.items[idx] = sat;
        this.count += 1;
        return sat;
    }

    release(item: T) {
        // inspired by https://github.com/pixijs/pixijs/blob/dev/packages/display/src/Container.ts#L292 and
        // https://github.com/pixijs/pixijs/blob/4cbadba3e46c4987f505e76a7f4e844d95a120cc/packages/utils/src/data/removeItems.ts#L9
        const idx = this.items.findIndex(e => e === item);
        if (idx === -1) {
            return false;
        }
        this.items[idx] = null;
        this.count -= 1;
        this.pool.recycle(item);
        return true;
    }

    private grow() {
        let len = this.items.length;
        this.items.length += (len ?? 10);
        for (let i = len; i < this.items.length; i++) {
            this.items[i] = null;
        }
    }
}

export interface Interpolation {
    finished: boolean;
    value: number;

    init(timeMS: number, start: number, stop: number): Interpolation;
    tick(elapsedMS: number): number;
}
export function interpolator(timeFn: (age: number, total: number) => number) {
    let age = 0;
    let initial = 0;
    let target = 0;
    let lifetime = 0;

    let result = {
        finished: false,
        value: 0,

        init(timeMS: number, start: number, stop: number) {
            age = 0;
            lifetime = timeMS;
            result.finished = false;
            initial = start;
            target = stop;
            return result;
        },

        tick: (elapsedMS: number) => {
            if (age < lifetime) {
                age += elapsedMS;
                const t = timeFn(age, lifetime);
                result.value = initial * (1 - t) + target * t;
            } else {
                result.finished = true;
                result.value = target;
            }
            return result.value;
        }
    }
    return result;
}

export const lirp = () => interpolator((a, b) => a / b);
