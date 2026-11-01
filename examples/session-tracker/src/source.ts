// Where the numbers come from. Everything that touches the Riot Client or the network is in this file, behind the `DataSource` interface,
// so the rest of the extension (and SOUP's self-test) can run with a stand-in that has no Riot Client.
//
// READ ONLY, OWN ACCOUNT ONLY. The Riot calls below are all GETs about the signed-in account's own matches and rating. Nothing here
// looks up other players, their ranks or anything Riot hides in a lobby; that is the line Riot draws and this extension stays inside it.
// SOUP writes one log line per call ("[ext-session-tracker] Riot remote call: GET pd ..."), visible with Ctrl+Shift+D > Extensions.

import type { App } from "soup";
import { parseTiers, type TierName } from "./logic";

export interface Who {
  puuid: string;
  name: string;
  tag: string | null;
}

export interface HistoryEntry {
  matchId: string;
  mode: string;
  startMillis: number;
}

export interface DataSource {
  /** The signed-in account, or null (no Riot Client, or nobody signed in). Local: asks SOUP, not Riot. */
  identity(): Promise<Who | null>;
  /** The match history SOUP keeps (newest first). Needs the Riot Client. */
  history(): Promise<HistoryEntry[]>;
  /** The details of one finished match (SOUP caches them for good). */
  details(matchId: string): Promise<unknown>;
  /** `GET pd /mmr/v1/players/<puuid>/competitiveupdates`: the rating change of the last ranked matches. */
  competitiveUpdates(puuid: string): Promise<unknown>;
  /** `idle`, `pregame`, `ingame`... what SOUP's live watcher last saw. */
  liveStatus(): Promise<string>;
  /** Tier names (`GOLD 2`) for the rank badge. */
  tierNames(): Promise<TierName[]>;
}

/** Tests point this at a local server (`window.__sessionTrackerApiBase`); nobody else sets it. */
export const apiBase = (): string => (globalThis as { __sessionTrackerApiBase?: string }).__sessionTrackerApiBase ?? "https://valorant-api.com";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** The real thing: SOUP's own API for the account and the history, `app.riot.remote` for the rating, valorant-api.com for tier names. */
export function riotSource(app: App): DataSource {
  return {
    async identity() {
      const me = await app.riot.identity();
      return me ? { puuid: me.puuid, name: me.name, tag: me.tag } : null;
    },
    async history() {
      return (await app.matches.history()) as HistoryEntry[];
    },
    details: (matchId) => app.matches.details(matchId),
    async competitiveUpdates(puuid) {
      const r = await app.riot.remote("GET", { service: "pd", path: `/mmr/v1/players/${encodeURIComponent(puuid)}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive` });
      if (r.status !== 200) throw new Error(`Riot answered ${r.status} for the rating history`);
      return r.json;
    },
    async liveStatus() {
      return ((await app.matches.liveState()) as { status?: string }).status ?? "idle";
    },
    async tierNames() {
      // Cached for a week in the data folder (`tiers.json`); a failure is not an error: the badge falls back to "Rank 12".
      try {
        if (await app.fs.exists("tiers.json")) {
          const c = JSON.parse(await app.fs.readText("tiers.json")) as { base: string; fetchedAt: number; names: TierName[] };
          if (c.base === apiBase() && Date.now() - c.fetchedAt < WEEK) return c.names;
        }
        const names = parseTiers((await app.requestUrl({ url: `${apiBase()}/v1/competitivetiers`, timeoutMs: 15000 })).json);
        if (names.length > 0) await app.fs.write("tiers.json", JSON.stringify({ base: apiBase(), fetchedAt: Date.now(), names }));
        return names;
      } catch {
        return [];
      }
    },
  };
}
