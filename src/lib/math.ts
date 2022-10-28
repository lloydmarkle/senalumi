export interface Point {
    x: number;
    y: number;
}
export const originPoint = () => ({ x: 0, y: 0 });
export const copyPoint = (p: Point) => ({ x: p.x, y: p.y });
export const point = (x: number, y: number) => ({ x, y });


// Vector math
export const scaleVector = (p: Point, scalar: number) => {
    p.x *= scalar;
    p.y *= scalar;
};
export const vectorLength = (p: Point) => Math.sqrt(p.x * p.x + p.y * p.y);
export const normalizeVector = (p: Point) => scaleVector(p, 1 / vectorLength(p));

export const distSqr = (a: Point, b: Point) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);

class Box {
    constructor(readonly x1: number, readonly y1: number, readonly x2: number, readonly y2: number) {
        if (x1 > x2 || y1 > y2)  {
            throw new Error('invalid box ' + JSON.stringify({ x1, y1, x2, y2 }));
        }
    }

    intersectBox(box: Box) {
        return this.intersect(box.x1, box.y1, box.x2, box.y2);
    }

    intersect(x1: number, y1: number, x2: number, y2: number) {
        return (
            this.contains(x1, y1)
            || this.contains(x2, y1)
            || this.contains(x1, y2)
            || this.contains(x2, y2)
        );
    }

    contains(x: number, y: number) {
        return x > this.x1 && x < this.x2 && y > this.y1 && y < this.y2;
    }
}

// Mostly based on https://en.wikipedia.org/wiki/Quadtree
// but adapted for circles (xy + radius) based on some suggestions
// from https://gamedev.stackexchange.com/questions/175799
export class QuadTree<T extends { position: Point }> {
    private box: Box;
    chidlren: QuadTree<T>[];
    data: T[] = [];
    constructor(readonly topLeft: Point, readonly bottomRight: Point, readonly capacity = 10) {
        this.box = new Box(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y);
    }

    insert(t: T, radius: number) {
        if (!this.box.intersect(t.position.x - radius, t.position.y - radius, t.position.x + radius, t.position.y - radius)) {
            return false;
        }

        if (this.data.length < this.capacity) {
            this.data.push(t);
            return true;
        }

        this.subdivide();
        // push points to children
        let data = this.data;
        this.data = [];
        for (const d of data) {
            this.insertData(d, radius);
        }

        return this.insertData(t, radius);
    }

    private insertData(t: T, radius: number) {
        let inserted = this.chidlren
            .reduce((acc, child) => acc = acc || child.insert(t, radius), false);
        if (!inserted) {
            // point stradles a boundary(?) so allow it to overfill this tree
            this.data.push(t);
        }
        return inserted;
    }

    private subdivide() {
        if (this.chidlren) {
            return;
        }
        const { x: left, y: top } = this.topLeft;
        const { x: right, y: bottom } = this.bottomRight;
        const halfx = (left + right) / 2;
        const halfy = (top + bottom) / 2;
        this.chidlren = [
            new QuadTree(this.topLeft, point(halfx, halfy), this.capacity),
            new QuadTree(point(halfx, top), point(right, halfy), this.capacity),
            new QuadTree(point(halfx, halfy), this.bottomRight, this.capacity),
            new QuadTree(point(left, halfy), point(halfx, bottom), this.capacity),
        ];
    }

    query(point: Point, radius: number): T[] {
        const result: T[] = [];
        const box = new Box(point.x - radius, point.y - radius, point.x + radius, point.y + radius);
        this.appendPoints(result, box);
        return result;
    }

    private appendPoints(results: T[], box: Box) {
        if (!this.box.intersectBox(box) && !box.intersectBox(this.box)) {
            return;
        }
        for (const d of this.data) {
            results.push(d);
        }
        this.chidlren?.forEach(e => e.appendPoints(results, box));
    }
}
