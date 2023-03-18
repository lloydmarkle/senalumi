import type { Room } from "colyseus.js";
import { getContext } from "svelte";
import { writable } from "svelte/store";
import type { Game } from "./lib/game";
import { GameSchema, PlayerSchema } from "./lib/net-game";
import { uniqueNamesGenerator, colors, NumberDictionary } from 'unique-names-generator';
import { Sound } from "./lib/sound";

// I don't love this whole "context" thing and would much rather pass around
// state as needed but between menus and level editor and remote games it was just
// too much to try and do this cleanly. I'd like to revisit it someday but for
// now, use a global "context" variable.

export interface UserPrefs {
    userName: string;
    soundVolume: number;
    showDemoGame: boolean;
}

export type MenuScreens = 'start' | 'local' | 'remote' | 'lobby' | 'edit'
export class Context {
    private _prefs = Context.loadPrefs();
    readonly game = writable<Game>(undefined);
    readonly menu = writable<MenuScreens>('start');
    readonly room = writable<Room<GameSchema>>();
    readonly prefs = writable<UserPrefs>(this._prefs);
    readonly localPlayer = writable(new PlayerSchema(this._prefs.userName));
    readonly audio = new Sound();

    constructor() {
        this.localPlayer.subscribe(player => {
            this._prefs.userName = player.displayName;
            this.prefs.set(this._prefs);
        })
        this.prefs.subscribe(prefs => {
            this.audio.volume(prefs.soundVolume);
            localStorage.setItem('prefs', JSON.stringify(prefs))
        });
    }

    static generateName() {
        return uniqueNamesGenerator({
            dictionaries: [colors, NumberDictionary.generate({ length: 5 })],
            style: 'lowerCase',
            separator: '-',
        });
    }

    static loadPrefs(): UserPrefs {
        let storedPrefs = {};
        try {
            storedPrefs = JSON.parse(localStorage.getItem('prefs'));
        } catch {
            // below we add in any default values since last time we loaded prefs
        }
        const prefs: UserPrefs = {
            userName: Context.generateName(),
            soundVolume: 1,
            showDemoGame: true,
            ...storedPrefs,
        };
        return prefs;
    }
}

export const key = Symbol();
export const appContext = (): Context => getContext(key)