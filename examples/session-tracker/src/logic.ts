// Session Tracker's arithmetic: what counts as "today", how a match file becomes a win or a loss for you, how rating changes add up, and
// what the header says. Plain functions: no SOUP, no DOM, so `tests/session-tracker.test.ts` runs them with node.
//
// Everything here is about the signed-in account's own matches. Nothing looks at another player's rank or anything Riot hides.

export type Result = "win" | "loss" | "draw" | "unknown";

export interface SessionMatch {
  matchId: string;
  startedAt: number;
  map: string;
  mode: string;
  result: Result;
  /** Your team's rounds first: "13-8". Empty when the file did not say. */
  score: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  /** Rating change, for a competitive match whose update has arrived; otherwise null. */
  rr: number | null;
}

/** One entry of `/mmr/v1/players/<puuid>/competitiveupdates` (the fields used). */
export interface CompUpdate {
  matchId: string;
  mapUrl: string;
  startedAt: number;
  tierAfter: number;
  rrAfter: number;
  rrEarned: number;
}

type Json = any;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The `Matches` array of the competitive-updates answer, newest first; entries that are not understood are dropped. */
export function parseUpdates(json: Json): CompUpdate[] {
  const out: CompUpdate[] = [];
  for (const m of (json?.Matches ?? []) as Json[]) {
    const earned = num(m?.RankedRatingEarned);
    const after = num(m?.RankedRatingAfterUpdate);
    const tier = num(m?.TierAfterUpdate);
    if (typeof m?.MatchID !== "string" || earned === null || after === null || tier === null) continue;
    out.push({ matchId: m.MatchID, mapUrl: typeof m.MapID === "string" ? m.MapID : "", startedAt: num(m.MatchStartTime) ?? 0, tierAfter: tier, rrAfter: after, rrEarned: earned });
  }
  return out.sort((a, b) => b.startedAt - a.startedAt);
}

// ---------------------------------------------------------------- the session window

export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0); // local time
  return d.getTime();
};

/** A session starts at the beginning of today (local time), or later if the person reset it. */
export const sessionStart = (now: number, resetAt: number | null): { at: number; kind: "today" | "reset" } => {
  const today = startOfDay(now);
  return resetAt !== null && resetAt > today ? { at: resetAt, kind: "reset" } : { at: today, kind: "today" };
};

// ---------------------------------------------------------------- when to read

/** Why a read happens. */
export type Reason = "start" | "poll" | "event" | "manual";

const RANK: Record<Reason, number> = { poll: 0, start: 1, event: 2, manual: 3 };

/** The reason a queued read keeps when another arrives while one is running: a person's Refresh outranks an event, an event outranks a poll. */
export const strongest = (queued: Reason | null, reason: Reason): Reason => (queued === null || RANK[reason] > RANK[queued] ? reason : queued);

// ---------------------------------------------------------------- one match

const MAP_NAMES: Record<string, string> = { Ascent: "Ascent", Bonsai: "Split", Canyon: "Fracture", Duality: "Bind", Foxtrot: "Breeze", Jam: "Lotus", Juliett: "Sunset", Pitt: "Pearl", Port: "Icebox", Triad: "Haven", Infinity: "Abyss", Rook: "Corrode" };

/** `/Game/Maps/Port/Port` to `Icebox`. */
export function mapName(mapUrl: string | null | undefined): string {
  const code = (mapUrl ?? "").split("/").filter(Boolean).pop() ?? "";
  return MAP_NAMES[code] ?? code;
}

/** A finished match as seen by `puuid`: result, score and K/D/A from the match details, and the rating change when there is one. */
export function buildMatch(details: Json, puuid: string, summary: { matchId: string; mode: string; startMillis: number }, update?: CompUpdate): SessionMatch {
  const players = (details?.players ?? []) as Json[];
  const me = players.find((p) => p?.subject === puuid);
  const teams = (details?.teams ?? []) as Json[];
  const mine = me ? teams.find((t) => t?.teamId === me.teamId) : undefined;
  const other = me ? teams.find((t) => t?.teamId !== me.teamId) : undefined;
  let result: Result = "unknown";
  let score = "";
  if (mine && other) {
    // A draw is both sides saying they did not win; a file without the `won` fields says nothing, so the result stays unknown.
    result = mine.won === true ? "win" : other.won === true ? "loss" : mine.won === false && other.won === false ? "draw" : "unknown";
    const a = num(mine.roundsWon);
    const b = num(other.roundsWon);
    if (a !== null && b !== null) score = `${a}-${b}`;
  }
  return {
    matchId: summary.matchId,
    startedAt: num(details?.matchInfo?.gameStartMillis) ?? summary.startMillis,
    map: mapName(details?.matchInfo?.mapId ?? update?.mapUrl),
    mode: summary.mode,
    result,
    score,
    kills: num(me?.stats?.kills),
    deaths: num(me?.stats?.deaths),
    assists: num(me?.stats?.assists),
    rr: update ? update.rrEarned : null,
  };
}

// ---------------------------------------------------------------- totals and the header

export interface Totals {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  /** Sum of the rating changes that are known. */
  rr: number;
  /** Whether any match in the session had a rating change (so "+0 RR" is not shown for a session of custom games). */
  hasRr: boolean;
}

export function totals(matches: SessionMatch[]): Totals {
  const t: Totals = { games: matches.length, wins: 0, losses: 0, draws: 0, rr: 0, hasRr: false };
  for (const m of matches) {
    if (m.result === "win") t.wins++;
    else if (m.result === "loss") t.losses++;
    else if (m.result === "draw") t.draws++;
    if (m.rr !== null) {
      t.rr += m.rr;
      t.hasRr = true;
    }
  }
  return t;
}

export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `-${Math.abs(n)}` : "0");

/** The text of the header chip: `Today 5W 2L +42 RR` (a draw adds `1D`; RR only when a ranked game is in the session). */
export function chipText(kind: "today" | "reset", t: Totals): string {
  const parts = [kind === "today" ? "Today" : "Session", `${t.wins}W`, `${t.losses}L`];
  if (t.draws > 0) parts.push(`${t.draws}D`);
  if (t.hasRr) parts.push(`${signed(t.rr)} RR`);
  return parts.join(" ");
}

// ---------------------------------------------------------------- ranks

export interface TierName {
  tier: number;
  name: string;
}

/** valorant-api's `/v1/competitivetiers`: one entry per episode; the last has the current tier names (`GOLD 2`). */
export function parseTiers(json: Json): TierName[] {
  const episodes = (json?.data ?? []) as Json[];
  const last = episodes[episodes.length - 1];
  const out: TierName[] = [];
  for (const t of (last?.tiers ?? []) as Json[]) if (typeof t?.tier === "number" && typeof t?.tierName === "string") out.push({ tier: t.tier, name: t.tierName });
  return out;
}

const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** `GOLD 2` to `Gold 2`. A tier the names do not have is `Rank 17`; the unused low tiers (0 to 2) are "Unranked". */
export function tierLabel(tier: number, names: TierName[]): string {
  const n = names.find((t) => t.tier === tier)?.name;
  if (tier <= 2 && (!n || /^unused/i.test(n))) return "Unranked";
  return n ? title(n) : `Rank ${tier}`;
}
