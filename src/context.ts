import type { Room } from "colyseus.js";
import { getContext } from "svelte";
import { writable } from "svelte/store";
import type { Game } from "./lib/game";
import { GameSchema, PlayerSchema } from "./lib/net-game";
import { uniqueNamesGenerator, colors, NumberDictionary } from 'unique-names-generator';

// I don't love this whole "context" thing and would much rather pass around
// state as needed but between menus and level editor and remote games it was just
// too much to try and do this cleanly. I'd like to revisit it someday but for
// now, use a global "context" variable.

export type MenuScreens = 'start' | 'local' | 'remote' | 'lobby' | 'edit'
export class Context {
    constructor(
        readonly game = writable<Game>(undefined),
        readonly localPlayer = writable(new PlayerSchema(Context.generateName())),
        readonly menu = writable<MenuScreens>('start'),
        readonly room = writable<Room<GameSchema>>(),
    ) {}

    static generateName() {
        return uniqueNamesGenerator({
            dictionaries: [colors, NumberDictionary.generate({ length: 5 })],
            style: 'lowerCase',
            separator: '-',
        })
    }
}

export const key = Symbol();
export const appContext = (): Context => getContext(key)