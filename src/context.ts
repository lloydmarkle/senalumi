import { getContext } from "svelte";
import type { Writable } from "svelte/store";
import type { Game } from "./lib/game";
import type { PlayerSchema } from "./lib/net-game";

// I don't love this whole "context" thing and would much rather pass around
// state as needed but between menus and level editor and remote games it was just
// too much to try and do this cleanly. I'd like to revisit it someday but for
// now, use a global "context" variable.

export type MenuScreens = 'start' | 'local' | 'remote' | 'lobby' | 'edit'
export interface Context {
    menu: Writable<MenuScreens>,
    roomName: Writable<string>,
    localPlayer: Writable<PlayerSchema>,
    game: Writable<Game>,
};

export const key = Symbol();
export const appContext = (): Context => getContext(key)