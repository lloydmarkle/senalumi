export interface Point {
    x: number;
    y: number;
}
export const originPoint = () => ({ x: 0, y: 0 });
export const copyPoint = (p: Point) => ({ x: p.x, y: p.y });
export const point = (x: number, y: number) => ({ x, y });


// Vector math
export const vectorLength = (p: Point) => {
    return Math.sqrt(p.x * p.x + p.y * p.y);
};
export const normalizeVector = (p: Point) => {
    const len = vectorLength(p);
    p.x /= len;
    p.y /= len;
};
export const scaleVector = (p: Point, scalar: number) => {
    p.x *= scalar;
    p.y *= scalar;
};

export const distSqr = (a: Point, b: Point) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
