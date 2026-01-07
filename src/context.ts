import { getContext } from "svelte";
import { writable } from "svelte/store";
import type { Game, Team } from "./lib/game";
import { uniqueNamesGenerator, colors, NumberDictionary } from 'unique-names-generator';
import { Sound } from "./lib/sound";

export const gameTitle = 'Senalumi'

const defaultPreferences = () => ({
    userName: Context.generateName(),
    userTeam: '',
    soundVolume: 1,
    showDemoGame: true,
    preferredTeams: [] as Team[],
});
export type UserPrefs = ReturnType<typeof defaultPreferences> & {
    remoteGame?: { name: string, sessionId: string, roomId: string },
}

// I don't love this whole "context" thing and would much rather pass around
// state as needed but between menus and level editor and remote games it was just
// too much to try and do this cleanly. I'd like to revisit it someday but for
// now, use a global "context" variable.

export class Context {
    private _prefs = Context.loadPrefs();
    readonly game = writable<Game>(undefined);
    readonly urlParams = writable(new URLSearchParams());
    readonly prefs = writable<UserPrefs>(this._prefs);
    readonly localPlayer = writable({ displayName: this._prefs.userName, team: this._prefs.userTeam as Team });
    readonly audio = new Sound();

    constructor() {
        this.localPlayer.subscribe(player => {
            this._prefs.userName = player.displayName;
            this._prefs.userTeam = player.team;
            this.prefs.set(this._prefs);
        });

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
        return { ...defaultPreferences(), ...storedPrefs, };
    }
}

export const key = Symbol();
export const appContext = (): Context => getContext(key)