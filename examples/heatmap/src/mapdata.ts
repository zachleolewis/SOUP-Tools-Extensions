// Map art and coordinates from valorant-api.com, fetched with `app.requestUrl` and cached in the extension's data folder for a week.
//
//   GET https://valorant-api.com/v1/maps      -> data[]: { uuid, displayName, mapUrl, displayIcon (the minimap), xMultiplier, yMultiplier, xScalarToAdd, yScalarToAdd }
//   GET https://valorant-api.com/v1/weapons   -> data[]: { uuid, displayName }
//
// The cache is a plain JSON file (`maps.json`, `weapons.json`; a relative path starts in the extension's data folder). If the network
// is down the stale cache is used, which is why the tab still draws on a plane. Only when there is no cache at all is it an error.

import type { App } from "soup";
import { WEEK_MS, isFresh, type MapInfo } from "./logic";

/** Tests point this at a local server (`window.__heatmapApiBase`); nobody else sets it. */
export const apiBase = (): string => (globalThis as { __heatmapApiBase?: string }).__heatmapApiBase ?? "https://valorant-api.com";

interface Cached<T> {
  base: string;
  fetchedAt: number;
  data: T;
}

export interface Loaded<T> {
  data: T;
  /** Where it came from: the cache while it is fresh, the network, or an old cache because the network failed. */
  from: "cache" | "network" | "stale-cache";
}

async function readCache<T>(app: App, file: string): Promise<Cached<T> | null> {
  try {
    if (!(await app.fs.exists(file))) return null;
    const c = JSON.parse(await app.fs.readText(file)) as Cached<T>;
    return c && typeof c.fetchedAt === "number" && c.base === apiBase() ? c : null; // a cache made for another server is not used
  } catch {
    return null; // a half-written or hand-edited file is just a cache miss
  }
}

async function cachedJson<T>(app: App, file: string, path: string, pick: (json: any) => T): Promise<Loaded<T>> {
  const cached = await readCache<T>(app, file);
  if (cached && isFresh(cached.fetchedAt, Date.now(), WEEK_MS)) return { data: cached.data, from: "cache" };
  try {
    const res = await app.requestUrl({ url: `${apiBase()}${path}`, timeoutMs: 15000 });
    const data = pick(res.json);
    await app.fs.write(file, JSON.stringify({ base: apiBase(), fetchedAt: Date.now(), data } satisfies Cached<T>));
    return { data, from: "network" };
  } catch (e) {
    if (cached) return { data: cached.data, from: "stale-cache" };
    throw e;
  }
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export const loadMaps = (app: App): Promise<Loaded<MapInfo[]>> =>
  cachedJson(app, "maps.json", "/v1/maps", (json) =>
    ((json?.data ?? []) as any[])
      .filter((m) => typeof m?.mapUrl === "string" && isNum(m.xMultiplier) && isNum(m.yMultiplier) && isNum(m.xScalarToAdd) && isNum(m.yScalarToAdd))
      .map((m) => ({
        uuid: String(m.uuid),
        displayName: String(m.displayName),
        mapUrl: m.mapUrl as string,
        displayIcon: typeof m.displayIcon === "string" ? m.displayIcon : "",
        xMultiplier: m.xMultiplier,
        yMultiplier: m.yMultiplier,
        xScalarToAdd: m.xScalarToAdd,
        yScalarToAdd: m.yScalarToAdd,
      })),
  );

/** Weapon id (lower case) to its name. Only a tooltip needs it, so a failure is not an error. */
export async function loadWeapons(app: App): Promise<Record<string, string>> {
  try {
    const { data } = await cachedJson(app, "weapons.json", "/v1/weapons", (json) => Object.fromEntries(((json?.data ?? []) as any[]).filter((w) => typeof w?.uuid === "string").map((w) => [w.uuid.toLowerCase(), String(w.displayName)])));
    return data;
  } catch {
    return {};
  }
}
