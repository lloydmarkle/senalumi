import { type Point, QuadTree, point } from '../lib/math.js';

type Star = { position: Point };
let id = 0;
const star = (x: number, y: number) => ({ id: (id += 1).toString(), position: { x, y }});

const qPrint = (qt: QuadTree<any>, spaces = '') => {
    console.log(spaces, [qt.topLeft, qt.bottomRight, qt.data.length])
    qt.chidlren?.forEach(c => qPrint(c, '  ' + spaces));
}

describe('quad tree', () => {
    it('does stuff', () => {
        const radius = 8;
        const qt = new QuadTree<Star>(
            point(0 - radius - 1, 0 - radius - 1),
            point(100 + radius + 1, 100 + radius + 1),
            1);
        qt.insert(star(3, 3), radius);
        qt.insert(star(0, 0), radius);
        qt.insert(star(75, 75), radius);
        qPrint(qt);

        console.log(qt.query(point(3, 3), radius));
    });
});


/*

_gfx.dbg.planetSelections(_game.players[0])
_gfx.dbg.quadTree(_game.players[0])

*/