import { gameTitle } from "./context";
import { preloadedMaps } from "./lib/data";
import type { GameMap } from "./lib/game";

export interface MapData {
    id: string;
    order: number;
    map: GameMap;
    stats: {
        bestTime: number;
        attempts: number;
        wins: number;
        loses: number;
    }
}

export interface ImageData {
    id: string;
    buff: ArrayBuffer;
}

const dbName = gameTitle + '-db'
export class DataStore {
    static load() {
        const dbRequest = indexedDB.open(dbName, 1);
        const result = new Promise<DataStore>((resolve, reject) => {
            dbRequest.onupgradeneeded = ev => {
                const db: IDBDatabase = (ev.target as any).result;

                if (!db.objectStoreNames.contains('image-cache')) {
                    db.createObjectStore('image-cache', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('map-data')) {
                    let store = db.createObjectStore('map-data', { keyPath: 'id' });
                    store.transaction.oncomplete = () => populateDefaultMaps(db);
                } else {
                    populateDefaultMaps(db);
                }
            };
            dbRequest.onsuccess = ev => {
                const db: IDBDatabase = (ev.target as any).result;
                resolve(new DataStore(db));
            };
            dbRequest.onerror = reject;
        });
        return result;

        function populateDefaultMaps(db: IDBDatabase) {
            const obj = db.transaction('map-data', 'readwrite').objectStore('map-data');
            for (let i = 0; i < preloadedMaps.length; i++) {
                const item: MapData = {
                    id: preloadedMaps[i].props.name,
                    order: i,
                    map: preloadedMaps[i],
                    stats: { attempts: 0, bestTime: 0, loses: 0, wins: 0 },
                }
                obj.add(item);
            }
        }
    }
    private constructor(private db: IDBDatabase) {}

    // The plan is to use pixijs more efficiently by creating a sprite sheet and/or prerendering graphics that we currently
    // generate via PIXI.Graphics() or filters. The renderer feels inefficient so caching images should help. I sort of like
    // how this project only has really only two pngs (so far...). It would be cool to generate all the graphics. Maybe the
    // planets could be animated or have different atmospheres or...
    async loadImage(id: string, imageGenerator: () => Promise<ArrayBuffer>) {
    }

    storeMap(mapData: MapData) {
        const ref = this.db.transaction('map-data', 'readwrite')
            .objectStore('map-data')
            .put(mapData);
        return new Promise((resolve, reject) => {
            ref.onsuccess = resolve;
            ref.onerror = reject;
        });
    }

    // it would be nice use a generator to avoid loading the whole list into memory. Yes, it's only a 100KB now (including images)
    // but if we have a bunch more maps or larger images, that size grows. Ideally we could do something like
    // {#each datastore.maps() as map} and svelte would query and iterate over the list using a db cursor.
    // Or maybe a virtual list?
    loadMaps(): Promise<MapData[]> {
        const cursor = this.db.transaction('map-data', 'readonly')
            .objectStore('map-data')
            .openCursor();
        return new Promise<MapData[]>((resolve, reject) => {
            const result: MapData[] = [];

            cursor.onerror = reject;
            cursor.onsuccess = ev => {
                const ref: IDBCursorWithValue = (ev.target as any).result;
                if (!ref) {
                    return resolve(result.sort((a, b) => a.order - b.order));
                }

                result.push(ref.value);
                ref.continue();
            };
        });
    }
}
