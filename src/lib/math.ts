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


const sinQuarterPi = Math.sin(Math.PI * 0.25);
// Mostly based on https://en.wikipedia.org/wiki/Quadtree
// but adapted for circles (xy + radius) based on some suggestions
// from https://gamedev.stackexchange.com/questions/175799
export class QuadTree<T extends { position: Point }> {
    chidlren: QuadTree<T>[];
    data: T[] = [];
    constructor(readonly topLeft: Point, readonly bottomRight: Point, readonly capacity = 10) {
        if (topLeft.x > bottomRight.x || topLeft.y > bottomRight.y)  {
            throw new Error('invalid tree ' + JSON.stringify([topLeft, bottomRight]));
        }
    }

    private containsCorner(point: Point, cornerDist: number) {
        return (
            this.containsPoint(point.x - cornerDist, point.y - cornerDist)
            || this.containsPoint(point.x + cornerDist, point.y - cornerDist)
            || this.containsPoint(point.x - cornerDist, point.y + cornerDist)
            || this.containsPoint(point.x + cornerDist, point.y + cornerDist)
        );
    }

    private containsPoint(x: number, y: number) {
        return x > this.topLeft.x && x < this.bottomRight.x
            && y > this.topLeft.y && y < this.bottomRight.y;
    }

    insert(t: T, radius: number) {
        return this._insert(t, radius);
    }

    _insert(t: T, cornerDist: number) {
        if (!this.containsCorner(t.position, cornerDist)) {
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
            this.insertData(d, cornerDist);
        }

        return this.insertData(t, cornerDist);
    }

    private insertData(t: T, cornerDist: number) {
        let inserted = this.chidlren
            .reduce((acc, child) => acc = acc || child._insert(t, cornerDist), false);
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
        this.appendPoints(result, point, radius);
        return result;
    }

    private appendPoints(results: T[], pt: Point, cornerDist: number) {
        if (!this.containsCorner(pt, cornerDist) && !this.covered(pt, cornerDist)) {
            return;
        }
        for (const d of this.data) {
            results.push(d);
        }
        this.chidlren?.forEach(e => e.appendPoints(results, pt, cornerDist));
    }

    private covered(point: Point, cornerDist: number) {
        return (point.x - cornerDist) < this.topLeft.x && (point.x + cornerDist) > this.bottomRight.x
            && (point.y - cornerDist) < this.topLeft.y && (point.y + cornerDist) > this.bottomRight.y;
    }
}
