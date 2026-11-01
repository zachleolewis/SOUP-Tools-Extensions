// What Auto Organizer decides: where a replay goes and what it is called. Plain functions with no SOUP and no DOM, so
// `tests/auto-organizer.test.ts` can run them with node.
//
// Templates (the same tokens for the folder and the name; a `/` in the folder template makes sub-folders):
//
//   {mode}        Competitive, Custom, Premier, ...           {map}     Icebox
//   {date}        2026-10-27            {date:YYYY-MM}        any of YYYY MM DD HH mm in the format
//   {time}        18-05                 {score}               13-8 (the winning side's rounds first: Blue first, as the Library shows it)
//   {result}      Win, Loss or Draw for the signed-in account (empty when the file does not say or nobody is signed in)
//   {id}          the first 8 characters of the match id

export interface Rules {
  /** Automatic organizing of every match SOUP saves. The Library's "Organize existing replays..." works with this off. */
  enabled: boolean;
  folderTemplate: string;
  renameTemplate: string;
  /** Only these modes, lower case, e.g. `competitive`. Empty means every mode. */
  modes: string[];
  /** Copy the replay and match file here (a folder); empty for no backup. */
  backupDir: string;
  /** A Discord webhook address; empty for no message. */
  webhookUrl: string;
}

export const DEFAULT_RULES: Rules = { enabled: true, folderTemplate: "{mode}/{map}", renameTemplate: "{date} {map} {score}", modes: [], backupDir: "", webhookUrl: "" };

/** What a template can use, from a Library card (and the match file when `result` is wanted). */
export interface Facts {
  mode: string;
  map: string;
  startedAt: number;
  score: string;
  result: string;
  matchId: string;
}

export const TOKENS = ["mode", "map", "date", "time", "score", "result", "id"] as const;

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function dateFormat(ms: number, fmt: string): string {
  const d = new Date(ms);
  return fmt.replace(/YYYY|MM|DD|HH|mm/g, (t) => (t === "YYYY" ? pad(d.getFullYear(), 4) : t === "MM" ? pad(d.getMonth() + 1) : t === "DD" ? pad(d.getDate()) : t === "HH" ? pad(d.getHours()) : pad(d.getMinutes())));
}

/** Characters Windows does not allow in a file or folder name become `-`; the ends are trimmed; the length is capped. */
export function cleanName(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 80)
    .trim();
}

/** Fill in a template. Unknown tokens stay as written so a typo is visible in the preview. */
export function fill(template: string, f: Facts): string {
  return template.replace(/\{(\w+)(?::([^}]*))?\}/g, (whole, name: string, arg?: string) => {
    switch (name) {
      case "mode":
        return f.mode;
      case "map":
        return f.map;
      case "date":
        return dateFormat(f.startedAt, arg ?? "YYYY-MM-DD");
      case "time":
        return dateFormat(f.startedAt, "HH-mm");
      case "score":
        return f.score;
      case "result":
        return f.result;
      case "id":
        return f.matchId.slice(0, 8);
      default:
        return whole;
    }
  });
}

/** The tokens of a template that are not known (for a hint under the field). */
export function unknownTokens(template: string): string[] {
  return [...template.matchAll(/\{(\w+)(?::[^}]*)?\}/g)].map((m) => m[1]).filter((n) => !(TOKENS as readonly string[]).includes(n));
}

/** The folder path of a template, one cleaned segment per `/`; empty segments (a token with no value) are dropped. */
export function folderPath(template: string, f: Facts): string[] {
  return fill(template, f)
    .split("/")
    .map(cleanName)
    .filter((s) => s.length > 0);
}

/** The new name of a replay; when the template leaves nothing, the old name stays. */
export function newName(template: string, f: Facts, current: string): string {
  return cleanName(fill(template, f)) || current;
}

export const normalizeModes = (text: string): string[] => [
  ...new Set(
    text
      .split(/[,;\n]/)
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean),
  ),
];

/** Whether a replay's mode is allowed by the rule. A replay with no mode only passes when every mode is allowed. */
export const modeAllowed = (modes: string[], mode: string | null): boolean => modes.length === 0 || (mode !== null && modes.includes(mode.toLowerCase()));

/** `13 - 8` (the Library's score text) to `13-8`. */
export const compactScore = (score: string | null): string => (score ? score.replace(/\s*-\s*/g, "-") : "");

// ---------------------------------------------------------------- from a match file

type Json = any;

/** `Win`, `Loss` or `Draw` for `puuid` in a match file; an empty string when the file does not say (so the token stays quiet). */
export function resultFor(details: Json, puuid: string | null): string {
  if (!puuid) return "";
  const me = ((details?.players ?? []) as Json[]).find((p) => p?.subject === puuid);
  const teams = (details?.teams ?? []) as Json[];
  const mine = me ? teams.find((t) => t?.teamId === me.teamId) : undefined;
  const other = me ? teams.find((t) => t?.teamId !== me.teamId) : undefined;
  if (!mine || !other) return "";
  return mine.won === true ? "Win" : other.won === true ? "Loss" : "Draw";
}

/** The player with the most kills in a match file, for the Discord message. */
export function topFragger(details: Json): { name: string; kills: number } | null {
  let best: { name: string; kills: number } | null = null;
  for (const p of (details?.players ?? []) as Json[]) {
    const kills = p?.stats?.kills;
    if (typeof kills !== "number") continue;
    if (!best || kills > best.kills) best = { name: [p.gameName, p.tagLine].filter(Boolean).join("#") || "A player", kills };
  }
  return best;
}

// ---------------------------------------------------------------- the plan

export interface FolderLite {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ReplayLite {
  id: string;
  folderId: string | null;
  name: string;
  matchId: string | null;
  mode: string | null;
  map: string | null;
  score: string | null;
  startedAt: number | null;
  importedAt: number;
}

export interface Plan {
  replayId: string;
  /** The replay as it is now. */
  from: { folderId: string | null; folderPath: string; name: string };
  /** What the rules make of it. `folderId` is null for the root or for a folder that does not exist yet (`folderExists`). */
  to: { folderPath: string[]; folderId: string | null; folderExists: boolean; name: string };
  move: boolean;
  rename: boolean;
}

/** The names of the folders from the root down to `id`. */
export const pathOf = (folders: FolderLite[], id: string | null): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let cur = id; cur && !seen.has(cur); ) {
    seen.add(cur);
    const f = folders.find((x) => x.id === cur);
    if (!f) break;
    out.unshift(f.name);
    cur = f.parentId;
  }
  return out;
};

/** The folder that has this path (names compare without regard to case). The empty path is the root: it exists, and its id is null. */
export function findFolder(folders: FolderLite[], path: string[]): { exists: boolean; id: string | null } {
  let parent: string | null = null;
  for (const seg of path) {
    const hit = folders.find((f) => f.parentId === parent && f.name.toLowerCase() === seg.toLowerCase());
    if (!hit) return { exists: false, id: null };
    parent = hit.id;
  }
  return { exists: true, id: parent };
}

export function factsOf(r: ReplayLite, result: string): Facts {
  return { mode: r.mode ?? "Unknown mode", map: r.map ?? "Unknown map", startedAt: r.startedAt ?? r.importedAt, score: compactScore(r.score), result, matchId: r.matchId ?? "" };
}

/** What the rules would do to one replay. An empty template leaves that part alone; two replays never end up with the same name in a folder. */
export function planFor(r: ReplayLite, rules: Rules, folders: FolderLite[], replays: ReplayLite[], result: string): Plan {
  const facts = factsOf(r, result);
  const here = pathOf(folders, r.folderId);
  const path = rules.folderTemplate.trim() ? folderPath(rules.folderTemplate, facts) : here;
  let name = rules.renameTemplate.trim() ? newName(rules.renameTemplate, facts, r.name) : r.name;
  const target = findFolder(folders, path);
  if (target.exists) {
    const taken = new Set(replays.filter((x) => x.id !== r.id && x.folderId === target.id).map((x) => x.name.toLowerCase()));
    if (taken.has(name.toLowerCase())) {
      let n = 2;
      while (taken.has(`${name} (${n})`.toLowerCase())) n++;
      name = `${name} (${n})`;
    }
  }
  return {
    replayId: r.id,
    from: { folderId: r.folderId, folderPath: here.join("/"), name: r.name },
    to: { folderPath: path, folderId: target.id, folderExists: target.exists, name },
    move: path.join("/").toLowerCase() !== here.join("/").toLowerCase(),
    rename: name !== r.name,
  };
}