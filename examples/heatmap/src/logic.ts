// What the heatmap knows about a match, and the arithmetic that puts a kill on the minimap. Plain functions: no SOUP, no DOM, so
// `tests/heatmap.test.ts` can run them with node.
//
// The match file is Riot's match-details JSON (the same file SOUP keeps next to a replay in the Library). Measured on real files:
//
//   matchInfo.mapId           "/Game/Maps/Port/Port"
//   players[]                 subject (the account's id), gameName, tagLine, teamId ("Blue" | "Red")
//   kills[]                   killer, victim (subjects), victimLocation { x, y }, playerLocations[] { subject, location { x, y } }, round, roundTime,
//                             finishingDamage { damageItem (a weapon id), damageType }
//   roundResults[]            roundNum, winningTeam, winningTeamRole ("Attacker" | "Defender"), playerStats[].kills[] (the same kills again)
//
// Some versions leave the top-level kills[] out and only keep them under roundResults[].playerStats[].kills[]; both are read.

export interface MapInfo {
  uuid: string;
  displayName: string;
  /** `/Game/Maps/Port/Port`: what `matchInfo.mapId` says. */
  mapUrl: string;
  /** The minimap picture. */
  displayIcon: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
}

export type Side = "attack" | "defense";

export interface KillEvent {
  /** 0 based, as Riot counts rounds (a person says "round 1"). */
  round: number;
  killer: string;
  victim: string;
  killerTeam: string;
  victimTeam: string;
  /** Where the killer stood when it happened, when the file says (playerLocations). */
  killerAt: { x: number; y: number } | null;
  victimAt: { x: number; y: number } | null;
  /** Which side the killer / the victim was on in that round, when the file says. */
  killerSide: Side | null;
  victimSide: Side | null;
  weapon: string;
  damageType: string;
  roundTimeMs: number;
}

export interface ParsedMatch {
  /** The match id, or `replay:<Library id>` when the file has none (the key Scrim Notes uses). */
  id: string;
  /** The Library replay this came from (null for a recent match that is not in the Library). */
  replayId: string | null;
  source: "library" | "recent";
  name: string;
  mapUrl: string;
  startedAt: number | null;
  players: Record<string, { name: string; team: string }>;
  kills: KillEvent[];
}

type Json = any; // Riot's file is only partly known; every read below checks what it needs

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const loc = (v: Json): { x: number; y: number } | null => {
  const x = num(v?.x);
  const y = num(v?.y);
  return x === null || y === null ? null : { x, y };
};

/** Read the kills and players out of a match-details JSON. `null` when it is not a match file or has no map. */
export function parseMatch(json: Json, meta: { replayId: string | null; source: "library" | "recent"; name: string }): ParsedMatch | null {
  const info = json?.matchInfo;
  const mapUrl = typeof info?.mapId === "string" ? info.mapId : null;
  if (!mapUrl || !Array.isArray(json?.players)) return null;

  const players: ParsedMatch["players"] = {};
  for (const p of json.players as Json[]) {
    if (typeof p?.subject !== "string") continue;
    const name = [p.gameName, p.tagLine].filter(Boolean).join("#") || "Player";
    players[p.subject] = { name, team: typeof p.teamId === "string" ? p.teamId : "" };
  }

  // Which side each team was on, round by round. A round says who won and as what; the other team had the other role.
  const roles = new Map<number, Record<string, Side>>();
  for (const [i, r] of ((json.roundResults ?? []) as Json[]).entries()) {
    const n = num(r?.roundNum) ?? i;
    const role = r?.winningTeamRole === "Attacker" ? "attack" : r?.winningTeamRole === "Defender" ? "defense" : null;
    const winner = typeof r?.winningTeam === "string" ? r.winningTeam : null;
    if (!role || !winner) continue;
    const other = winner === "Blue" ? "Red" : "Blue";
    roles.set(n, { [winner]: role, [other]: role === "attack" ? "defense" : "attack" });
  }

  const raw: Json[] = Array.isArray(json.kills) && json.kills.length > 0 ? json.kills : [];
  if (raw.length === 0) {
    for (const [i, r] of ((json.roundResults ?? []) as Json[]).entries()) {
      for (const s of (r?.playerStats ?? []) as Json[]) for (const k of (s?.kills ?? []) as Json[]) raw.push({ round: num(k?.round) ?? num(r?.roundNum) ?? i, ...k });
    }
  }

  const kills: KillEvent[] = [];
  for (const k of raw) {
    if (typeof k?.killer !== "string" || typeof k?.victim !== "string") continue;
    const round = num(k.round) ?? 0;
    const killerTeam = players[k.killer]?.team ?? "";
    const victimTeam = players[k.victim]?.team ?? "";
    const at = (subject: string) => loc((k.playerLocations as Json[] | undefined)?.find((p) => p?.subject === subject)?.location);
    kills.push({
      round,
      killer: k.killer,
      victim: k.victim,
      killerTeam,
      victimTeam,
      killerAt: at(k.killer),
      victimAt: loc(k.victimLocation) ?? at(k.victim),
      killerSide: roles.get(round)?.[killerTeam] ?? null,
      victimSide: roles.get(round)?.[victimTeam] ?? null,
      weapon: typeof k.finishingDamage?.damageItem === "string" ? k.finishingDamage.damageItem.toLowerCase() : "",
      damageType: typeof k.finishingDamage?.damageType === "string" ? k.finishingDamage.damageType : "",
      roundTimeMs: num(k.roundTime) ?? 0,
    });
  }

  return {
    // The key Scrim Notes files notes under: the match id, or `replay:<library id>` for a file that has none.
    id: typeof info.matchId === "string" && info.matchId ? info.matchId : meta.replayId ? `replay:${meta.replayId}` : "match",
    replayId: meta.replayId,
    source: meta.source,
    name: meta.name,
    mapUrl,
    startedAt: num(info.gameStartMillis),
    players,
    kills,
  };
}

// ---------------------------------------------------------------- coordinates

/** A point of the game world as a fraction of the minimap picture, both 0..1 (valorant-api's formula). */
export function project(m: Pick<MapInfo, "xMultiplier" | "yMultiplier" | "xScalarToAdd" | "yScalarToAdd">, x: number, y: number): { u: number; v: number } {
  return { u: y * m.xMultiplier + m.xScalarToAdd, v: x * m.yMultiplier + m.yScalarToAdd };
}

// ---------------------------------------------------------------- filtering

export type Mode = "kills" | "deaths" | "both";
export type SideFilter = "both" | Side;

export interface Filter {
  mapUrl: string | null;
  mode: Mode;
  side: SideFilter;
  /** An account id, or "all". */
  who: string;
  /** Only this Library replay. */
  replayId: string | null;
}

export interface Point {
  kind: "kill" | "death";
  /** Position on the minimap, 0..1. */
  u: number;
  v: number;
  match: ParsedMatch;
  event: KillEvent;
  side: Side | null;
}

/** The dots for the chosen filter. A kill is drawn where the killer stood, a death where the victim fell. */
export function pointsFor(matches: ParsedMatch[], map: Pick<MapInfo, "xMultiplier" | "yMultiplier" | "xScalarToAdd" | "yScalarToAdd">, f: Filter): Point[] {
  const out: Point[] = [];
  for (const m of matches) {
    if (f.mapUrl && m.mapUrl !== f.mapUrl) continue;
    if (f.replayId && m.replayId !== f.replayId) continue;
    for (const e of m.kills) {
      if (f.mode !== "deaths" && (f.who === "all" || e.killer === f.who) && e.killerAt && (f.side === "both" || e.killerSide === f.side)) {
        out.push({ kind: "kill", ...project(map, e.killerAt.x, e.killerAt.y), match: m, event: e, side: e.killerSide });
      }
      if (f.mode !== "kills" && (f.who === "all" || e.victim === f.who) && e.victimAt && (f.side === "both" || e.victimSide === f.side)) {
        out.push({ kind: "death", ...project(map, e.victimAt.x, e.victimAt.y), match: m, event: e, side: e.victimSide });
      }
    }
  }
  return out;
}

/** The point closest to (u, v) within `radius` (the same fraction units), or null. */
export function nearest(points: Point[], u: number, v: number, radius: number): Point | null {
  let best: Point | null = null;
  let bestD = radius * radius;
  for (const p of points) {
    const d = (p.u - u) ** 2 + (p.v - v) ** 2;
    if (d <= bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Maps you have data for, the one with the most matches first. */
export function mapChoices(matches: ParsedMatch[]): Array<{ mapUrl: string; matches: number }> {
  const count = new Map<string, number>();
  for (const m of matches) count.set(m.mapUrl, (count.get(m.mapUrl) ?? 0) + 1);
  return [...count].map(([mapUrl, matches]) => ({ mapUrl, matches })).sort((a, b) => b.matches - a.matches || a.mapUrl.localeCompare(b.mapUrl));
}

/** Players seen in the matches on that map: the name they used most often, and in how many matches. Most matches first. */
export function playerChoices(matches: ParsedMatch[]): Array<{ subject: string; name: string; matches: number }> {
  const seen = new Map<string, { names: Map<string, number>; matches: number }>();
  for (const m of matches) {
    for (const [subject, p] of Object.entries(m.players)) {
      const s = seen.get(subject) ?? { names: new Map(), matches: 0 };
      s.matches++;
      s.names.set(p.name, (s.names.get(p.name) ?? 0) + 1);
      seen.set(subject, s);
    }
  }
  return [...seen]
    .map(([subject, s]) => ({ subject, name: [...s.names].sort((a, b) => b[1] - a[1])[0][0], matches: s.matches }))
    .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
}

/** `/Game/Maps/Port/Port` is the last part of `mapUrl`; a readable fallback when valorant-api has not answered. */
export function mapCode(mapUrl: string): string {
  return mapUrl.split("/").filter(Boolean).pop() ?? mapUrl;
}

// ---------------------------------------------------------------- caching

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const isFresh = (fetchedAt: number | undefined, now: number, maxAgeMs = WEEK_MS): boolean => typeof fetchedAt === "number" && now - fetchedAt < maxAgeMs && fetchedAt <= now + 60_000;

/** `hsl` channels as CSS stores them ("148 42% 54%") to [r, g, b]. */
export function hslToRgb(channels: string): [number, number, number] {
  const m = /(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(channels.trim());
  if (!m) return [128, 128, 128];
  const h = (((Number(m[1]) % 360) + 360) % 360) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

// ---------------------------------------------------------------- the settings page

/** What the settings page saves (`saveData`, so per profile). An empty colour means "the theme's". */
export interface Prefs {
  killColor: string;
  deathColor: string;
  startSource: "library" | "recent" | "both";
}
export const DEFAULT_PREFS: Prefs = { killColor: "", deathColor: "", startSource: "both" };

/** Whatever `loadData` returned, as well-formed Prefs: a colour must be #rrggbb, anything unknown is the default. */
export function normalizePrefs(raw: unknown): Prefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const colour = (v: unknown) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : "");
  const src = r.startSource === "library" || r.startSource === "recent" || r.startSource === "both" ? r.startSource : DEFAULT_PREFS.startSource;
  return { killColor: colour(r.killColor), deathColor: colour(r.deathColor), startSource: src };
}

/** "#ff4655" as [255, 70, 85]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
