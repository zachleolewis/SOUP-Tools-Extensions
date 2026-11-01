// The Heatmap's state: which matches are read, what the person chose to look at, and the loading that fills it. The views read it with
// `useSyncExternalStore(ctrl.subscribe, ctrl.get)`; every change makes a new snapshot object, which is what makes a view draw again.
//
// Where the matches come from:
//   - the Library: every replay with a match file (`jsonPath`), read with `app.fs.readText`;
//   - recent matches: `app.matches.history()` and then `app.matches.details(matchId)` for the ones that are not in the Library
//     (this needs the Riot Client; without it the Library is still there).

import type { Plugin } from "soup";
import { loadMaps, loadWeapons } from "./mapdata";
import { DEFAULT_PREFS, needsRead, normalizePrefs, parseMatch, type MapInfo, type Mode, type ParsedMatch, type Prefs, type SideFilter } from "./logic";

export type Source = "library" | "recent" | "both";

export interface View {
  source: Source;
  /** `null`: the map with the most matches. */
  mapUrl: string | null;
  /** An account id or "all". */
  who: string;
  mode: Mode;
  side: SideFilter;
  /** Only this Library replay (the Library's Heatmap button sets it). */
  replayId: string | null;
  glow: boolean;
  dots: boolean;
}

export interface Snapshot {
  view: View;
  matches: ParsedMatch[];
  maps: MapInfo[] | null;
  weapons: Record<string, string>;
  loading: boolean;
  progress: { done: number; total: number };
  /** Plain-language lines about what could not be read (the Riot Client is off, a file is broken). */
  notes: string[];
  /** Set when the map data could not be loaded at all (no network and no cache). */
  mapError: string | null;
  /** The signed-in account's id, when the Riot Client knows it. */
  me: string | null;
  /** The settings page's choices, saved for the active profile. */
  prefs: Prefs;
}

interface LibReplay {
  id: string;
  matchId: string | null;
  name: string;
  jsonPath: string | null;
  hasJson: boolean;
  startedAt: number | null;
}

const RECENT_LIMIT = 20;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class Controller {
  private snap: Snapshot = {
    view: { source: "both", mapUrl: null, who: "all", mode: "both", side: "both", replayId: null, glow: true, dots: true },
    matches: [],
    maps: null,
    weapons: {},
    loading: false,
    progress: { done: 0, total: 0 },
    notes: [],
    mapError: null,
    me: null,
    prefs: DEFAULT_PREFS,
  };
  private listeners = new Set<() => void>();
  private cache = new Map<string, ParsedMatch>();
  private stamps = new Map<string, number>();
  private running: Promise<void> | null = null;
  private again = false;
  private lastRun = 0;
  /** What the last finished read fetched, so a change of source reads again only when it needs something that is not there yet. */
  private loaded = { library: false, recent: false };
  private disposed = false;
  private reloadTimer: number | undefined;

  constructor(private plugin: Plugin) {}

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  };

  get = (): Snapshot => this.snap;

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of [...this.listeners]) l();
  }

  setView(patch: Partial<View>): void {
    this.set({ view: { ...this.snap.view, ...patch } });
    // Each source is only fetched when it is wanted: asking for one that was not read yet reads again.
    if (patch.source && needsRead(patch.source, this.loaded)) void this.reload();
  }

  /** The Library changes in bursts (an import adds several replays): read once, a moment after the last change. Cancelled by `dispose`. */
  reloadSoon(ms = 800): void {
    window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => void this.reload(), ms);
  }

  /** The extension is being turned off: no timer fires and no read starts any more. */
  dispose(): void {
    this.disposed = true;
    window.clearTimeout(this.reloadTimer);
  }

  /** Read the settings saved for this profile; the tab starts from the source they name. */
  async loadPrefs(): Promise<void> {
    const saved = await this.plugin.loadData<{ prefs?: unknown }>();
    const prefs = normalizePrefs(saved?.prefs);
    this.set({ prefs, view: { ...this.snap.view, source: prefs.startSource } });
  }

  /** The settings page changed something: draw with it and save it for this profile. */
  setPrefs(patch: Partial<Prefs>, persist = true): void {
    const prefs = normalizePrefs({ ...this.snap.prefs, ...patch });
    this.set({ prefs });
    if (persist) this.savePrefs();
  }

  /** Save the current settings for this profile (a colour being dragged is drawn with `setPrefs(patch, false)` and saved once, when it is let go). */
  savePrefs(): void {
    const prefs = this.snap.prefs;
    this.saving = this.saving.then(() => this.plugin.saveData({ prefs })).catch((e) => this.plugin.app.log.warn(`could not save the settings: ${errText(e)}`));
  }
  private saving: Promise<void> = Promise.resolve();

  /** The Library's Heatmap button: that replay's map, only that replay, every player. */
  focusReplay(r: { id: string; mapUrl: string | null }): void {
    this.setView({ replayId: r.id, mapUrl: r.mapUrl, who: "all", source: "library" });
  }

  /** Draw the tab again without reading anything (what it shows from another extension, the note counts, changed). */
  touch(): void {
    this.set({});
  }

  /** Read again if it has been a while (the tab was opened). */
  refreshIfStale(): void {
    if (Date.now() - this.lastRun > 60_000) void this.reload();
  }

  /** Read the Library and the recent matches again. Calls made while a read is running are folded into one more pass. */
  reload(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        if (this.disposed) break;
        try {
          await this.pass();
        } catch (e) {
          // A pass never throws out: whatever went wrong is shown in the tab as a line, and the log has it.
          this.plugin.app.log.warn(`reading matches failed: ${errText(e)}`);
          this.set({ loading: false, notes: [...this.snap.notes, `Reading matches failed: ${errText(e)}`] });
        }
      } while (this.again);
      this.running = null;
      this.lastRun = Date.now();
    })();
    return this.running;
  }

  private async pass(): Promise<void> {
    const app = this.plugin.app;
    const notes: string[] = [];
    this.set({ loading: true, notes: [], progress: { done: 0, total: 0 } });

    // The map data and the signed-in account, alongside the reading.
    const side = Promise.all([
      loadMaps(app).then(
        (m) => ({ maps: m.data, mapError: null as string | null }),
        (e) => ({ maps: this.snap.maps, mapError: `Could not load the map data from valorant-api.com: ${errText(e)}` }),
      ),
      loadWeapons(app),
      app.riot.identity().then(
        (me) => me?.puuid ?? null,
        () => null,
      ),
    ]).then(([m, weapons, me]) => this.set({ ...m, weapons, me }));

    // 1. The Library.
    let library: LibReplay[] = [];
    try {
      library = ((await app.library.list()) as { replays: LibReplay[] }).replays.filter((r) => r.hasJson && r.jsonPath);
    } catch (e) {
      notes.push(`The Library could not be read: ${errText(e)}`);
    }
    const wantLibrary = this.snap.view.source !== "recent";
    const wantRecent = this.snap.view.source !== "library";

    let recent: Array<{ matchId: string }> = [];
    let recentRead = false;
    if (wantRecent) {
      try {
        recent = ((await app.matches.history()) as Array<{ matchId: string }>).slice(0, RECENT_LIMIT);
        recentRead = true;
      } catch {
        notes.push("Recent matches need the Riot Client, and it is not running. Showing what is in your Library.");
      }
    }
    const inLibrary = new Set(library.map((r) => r.matchId).filter(Boolean));
    const fresh = recent.filter((m) => !inLibrary.has(m.matchId));
    const total = (wantLibrary ? library.length : 0) + fresh.length;
    let done = 0;
    const live = new Set<string>();
    const publish = () => this.set({ matches: [...this.cache.values()].filter((m) => live.has(m.id)).sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0)), progress: { done, total } });

    for (const r of wantLibrary ? library : []) {
      const key = `lib:${r.id}`;
      try {
        const stamp = (await app.fs.stat(r.jsonPath!)).modifiedMs;
        let m = this.cache.get(key);
        // The file is read again only when it changed (its modified time is part of what is cached).
        if (!m || this.stamps.get(key) !== stamp) {
          const parsed = parseMatch(JSON.parse(await app.fs.readText(r.jsonPath!)), { replayId: r.id, source: "library", name: r.name });
          if (!parsed) {
            notes.push(`${r.name}: not a match file`);
            continue;
          }
          m = parsed;
          this.cache.set(key, m);
          this.stamps.set(key, stamp);
        }
        live.add(m.id);
      } catch (e) {
        notes.push(`${r.name}: ${errText(e)}`);
      }
      if (++done % 4 === 0) publish();
    }

    // 2. Recent matches that are not in the Library, one at a time (the details endpoint has a rate limit).
    for (const h of fresh) {
      const key = `recent:${h.matchId}`;
      try {
        let m = this.cache.get(key);
        if (!m) {
          const json = await app.matches.details(h.matchId);
          const parsed = parseMatch(json, { replayId: null, source: "recent", name: "Recent match" });
          if (parsed) {
            m = parsed;
            this.cache.set(key, m);
          }
        }
        if (m) live.add(m.id);
      } catch (e) {
        notes.push(`A recent match could not be read: ${errText(e)}`);
        break; // the rest would fail the same way (the client went away, a rate limit)
      }
      done++;
      publish();
    }

    // What left the Library or the history is forgotten.
    for (const [key, m] of this.cache) if (!live.has(m.id)) this.cache.delete(key);
    await side;
    done = total;
    publish();
    this.loaded = { library: wantLibrary, recent: recentRead };
    this.set({ loading: false, notes });
  }
}
