// The session: what is shown in the header and in the tab, and the rules for when it is read.
//
// Being polite to Riot is a feature here, not an afterthought:
//   - it reads when something happened (a match was saved, the Riot Client connected or changed account), when the tab is opened
//     and the data is a minute old, and when the person presses Refresh;
//   - otherwise it polls at most every two minutes;
//   - it never polls while a match is being played (`liveStatus() === "ingame"`);
//   - match details are asked for once per match and kept in memory (SOUP caches them on disk too).

import type { Plugin } from "soup";
import { buildMatch, parseUpdates, sessionStart, tierLabel, totals, type CompUpdate, type SessionMatch, type Totals } from "./logic";
import type { DataSource } from "./source";

export type Reason = "start" | "poll" | "event" | "manual";

export interface Rank {
  tier: number;
  rr: number;
  label: string;
}

export interface SessionState {
  /** `starting` until the first answer; `signed-out` when the Riot Client has no account; `error` when a read failed. */
  status: "starting" | "signed-out" | "ready" | "error";
  who: string | null;
  since: { at: number; kind: "today" | "reset" };
  matches: SessionMatch[];
  totals: Totals;
  rank: Rank | null;
  error: string | null;
  /** Things that did not stop the read: a match that could not be opened, a rating that did not arrive. */
  notes: string[];
  updatedAt: number | null;
  refreshing: boolean;
  /** Polling is paused because a match is being played. */
  inMatch: boolean;
}

const MIN_GAP_MS = 15_000;
const DETAILS_SPACING_MS = 250;
const MAX_NEW_DETAILS = 25;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SessionStore {
  private state: SessionState;
  private listeners = new Set<() => void>();
  private resetAt: number | null = null;
  private cache = new Map<string, SessionMatch>();
  private cacheFor: string | null = null;
  private busy = false;
  private queued: Reason | null = null;
  private lastStart = 0;

  constructor(
    private plugin: Plugin,
    public source: DataSource,
  ) {
    this.state = this.blank("starting");
  }

  private blank(status: SessionState["status"]): SessionState {
    return { status, who: null, since: sessionStart(Date.now(), this.resetAt), matches: [], totals: totals([]), rank: null, error: null, notes: [], updatedAt: null, refreshing: false, inMatch: false };
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  };

  get = (): SessionState => this.state;

  private set(patch: Partial<SessionState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of [...this.listeners]) l();
  }

  // ------------------------------------------------------------ the reset

  async load(): Promise<void> {
    const data = await this.plugin.loadData<{ resetAt?: number | null }>();
    this.resetAt = typeof data.resetAt === "number" ? data.resetAt : null;
    this.set({ since: sessionStart(Date.now(), this.resetAt) });
  }

  /** Start counting from now (Reset session), or go back to the start of today (null). */
  async setReset(at: number | null): Promise<void> {
    this.resetAt = at;
    await this.plugin.saveData({ resetAt: at });
    this.set({ since: sessionStart(Date.now(), at) });
    await this.refresh("manual");
  }

  get resetActive(): boolean {
    return this.state.since.kind === "reset";
  }

  /** The tab was opened: read again when the data is a minute old. */
  refreshIfStale(): void {
    if (!this.state.updatedAt || Date.now() - this.state.updatedAt > 60_000) void this.refresh("manual");
  }

  // ------------------------------------------------------------ reading

  /** Read the session. Calls that arrive while one is running become one more read afterwards. Never throws. */
  async refresh(reason: Reason): Promise<void> {
    if (this.busy) {
      this.queued = reason === "poll" ? this.queued : reason;
      return;
    }
    if (reason !== "manual" && Date.now() - this.lastStart < MIN_GAP_MS) return;
    this.busy = true;
    try {
      await this.read(reason);
    } catch (e) {
      // Anything unexpected is shown in the tab and logged at info level: a failing read is a state, not a fault of this extension.
      this.plugin.app.log.info(`session read failed: ${errText(e)}`);
      this.set({ status: "error", error: errText(e), refreshing: false });
    } finally {
      this.busy = false;
    }
    const again = this.queued;
    this.queued = null;
    if (again) await this.refresh(again);
  }

  private async read(reason: Reason): Promise<void> {
    const src = this.source;
    if (reason === "poll") {
      const live = await src.liveStatus().catch(() => "idle");
      if (live === "ingame") return this.set({ inMatch: true });
    }
    this.set({ refreshing: true, inMatch: false });
    this.lastStart = Date.now(); // a read that is skipped (a match is running) does not count against the gap

    const me = await src.identity();
    if (!me) {
      this.cache.clear();
      this.cacheFor = null;
      return this.set({ ...this.blank("signed-out"), updatedAt: Date.now() });
    }
    if (this.cacheFor !== me.puuid) {
      this.cache.clear(); // another account signed in: nothing of the old one is kept
      this.cacheFor = me.puuid;
    }
    const since = sessionStart(Date.now(), this.resetAt);
    const notes: string[] = [];

    // The history and the rating changes. The history is what makes a session, so its failure is the read's failure.
    let history;
    try {
      history = await src.history();
    } catch (e) {
      return this.set({ status: "error", who: label(me), since, error: `The match history could not be read: ${errText(e)}`, refreshing: false, updatedAt: Date.now() });
    }
    let updates: CompUpdate[] = [];
    try {
      updates = parseUpdates(await src.competitiveUpdates(me.puuid));
    } catch (e) {
      notes.push(`The rating changes could not be read (${errText(e)}). Results still show.`);
    }
    const rrOf = new Map(updates.map((u) => [u.matchId, u]));

    // New matches of the session get their details read, one at a time.
    const inSession = history.filter((h) => h.startMillis >= since.at);
    let opened = 0;
    for (const h of inSession) {
      if (this.cache.has(h.matchId)) continue;
      if (opened >= MAX_NEW_DETAILS) break;
      try {
        if (opened++ > 0) await wait(DETAILS_SPACING_MS);
        this.cache.set(h.matchId, buildMatch(await src.details(h.matchId), me.puuid, h));
      } catch (e) {
        notes.push(`A match could not be opened (${errText(e)}).`);
      }
    }
    const matches = inSession
      .map((h) => this.cache.get(h.matchId))
      .filter((m): m is SessionMatch => !!m)
      .map((m) => ({ ...m, rr: rrOf.get(m.matchId)?.rrEarned ?? null }))
      .sort((a, b) => b.startedAt - a.startedAt);

    let rank: Rank | null = null;
    if (updates[0]) rank = { tier: updates[0].tierAfter, rr: updates[0].rrAfter, label: tierLabel(updates[0].tierAfter, await src.tierNames()) };

    this.set({ status: "ready", who: label(me), since, matches, totals: totals(matches), rank, error: null, notes, updatedAt: Date.now(), refreshing: false });
  }
}

const label = (me: { name: string; tag: string | null }) => (me.tag ? `${me.name}#${me.tag}` : me.name);
