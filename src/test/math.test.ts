import { type Point, QuadTree, point } from '../lib/math.js';

type Star = { position: Point };
let id = 0;
const star = (x: number, y: number) => ({ id: (id += 1).toString(), position: { x, y }});

const qPrint = (qt: QuadTree<any>, spaces = '') => {
    console.log(spaces, [qt.topLeft, qt.bottomRight, qt.data.length])
    qt.children?.forEach(c => qPrint(c, '  ' + spaces));
}

describe('quad tree', () => {
    it('does stuff', () => {
        const radius = 8;
        const qt = new QuadTree<Star>(1);
        qt.insert(star(3, 3), radius);
        qt.insert(star(0, 0), radius);
        // qt.insert(star(0, 0), radius);
        // qt.insert(star(175, 75), radius);
        // qt.insert(star(175, 75), radius);
        // qt.insert(star(275, 75), radius);
        // qt.insert(star(375, 75), radius);
        // qt.insert(star(475, 75), radius);
        // qt.insert(star(575, 75), radius);
        qPrint(qt);

        const items = [];
        qt.query(point(3, 3), radius, e => items.push(e));
        console.log(items);
    });
});


/*

_gfx.dbg.planetSelections(_game.players[0])
_gfx.dbg.quadTree(_game.players[0])


game.players.forEach(p => _gfx.dbg.planetSelections(p))
_game.players.forEach(p => _gfx.dbg.quadTree(p))

*/