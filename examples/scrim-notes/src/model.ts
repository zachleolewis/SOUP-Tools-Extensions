// The data model of Scrim Notes and everything that is plain logic (no SOUP, no React), so it can be tested on its own.
//
// What is saved (`plugin.saveData`, so it belongs to the active SOUP profile: a team profile holds the team's notes):
//
//   { version: 1, notes: { "<matchKey>": { title, map, startedAt, entries: [ { id, round?, tag, text, createdAt, updatedAt } ] } }, settings: { ... } }
//
// `version` is written so a later release of this extension can migrate old data; `normalize` is where that would happen.

export type Tag = "good" | "bad" | "review" | "strat" | "other";

export const TAGS: ReadonlyArray<{ id: Tag; label: string }> = [
  { id: "good", label: "Good" },
  { id: "bad", label: "Bad" },
  { id: "review", label: "Review" },
  { id: "strat", label: "Strat" },
  { id: "other", label: "Other" },
];

export interface Note {
  id: string;
  /** Round number (1 based, as a person counts rounds), when the note is about one round. */
  round?: number;
  tag: Tag;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface MatchNotes {
  title: string;
  map: string;
  startedAt: number | null;
  entries: Note[];
}

export interface Settings {
  defaultTag: Tag;
  showBadge: boolean;
}

export interface NotesData {
  version: 1;
  notes: Record<string, MatchNotes>;
  settings: Settings;
}

export const emptyData = (): NotesData => ({ version: 1, notes: {}, settings: { defaultTag: "review", showBadge: true } });

const isTag = (t: unknown): t is Tag => TAGS.some((x) => x.id === t);

/** Whatever `loadData` returned (`{}` on a first run) as a well-formed NotesData. Unknown or broken parts are dropped, never thrown on. */
export function normalize(raw: unknown): NotesData {
  const out = emptyData();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as { notes?: unknown; settings?: { defaultTag?: unknown; showBadge?: unknown } };
  if (isTag(r.settings?.defaultTag)) out.settings.defaultTag = r.settings.defaultTag;
  if (typeof r.settings?.showBadge === "boolean") out.settings.showBadge = r.settings.showBadge;
  if (r.notes && typeof r.notes === "object") {
    for (const [key, value] of Object.entries(r.notes as Record<string, Partial<MatchNotes>>)) {
      if (!value || typeof value !== "object" || !Array.isArray(value.entries)) continue;
      const entries: Note[] = [];
      for (const e of value.entries as Array<Partial<Note>>) {
        if (!e || typeof e.text !== "string" || typeof e.id !== "string") continue;
        entries.push({
          id: e.id,
          round: typeof e.round === "number" && e.round > 0 ? Math.floor(e.round) : undefined,
          tag: isTag(e.tag) ? e.tag : "other",
          text: e.text,
          createdAt: typeof e.createdAt === "number" ? e.createdAt : 0,
          updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : typeof e.createdAt === "number" ? e.createdAt : 0,
        });
      }
      if (entries.length === 0) continue;
      out.notes[key] = { title: String(value.title ?? key), map: String(value.map ?? ""), startedAt: typeof value.startedAt === "number" ? value.startedAt : null, entries };
    }
  }
  return out;
}

/** The key notes are filed under: the match id when SOUP knows it, otherwise the replay's own id. */
export function matchKey(r: { matchId: string | null; id: string }): string {
  return r.matchId ? r.matchId : `replay:${r.id}`;
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** The last time anything in the match was written. */
export function lastEdit(m: MatchNotes): number {
  return m.entries.reduce((t, e) => Math.max(t, e.updatedAt), 0);
}

/** Match keys that have notes, newest edit first, narrowed by a search text (note text, tag, title, map) and an optional tag. */
export function searchMatches(data: NotesData, query: string, tag: Tag | "all"): string[] {
  const q = query.trim().toLowerCase();
  return Object.keys(data.notes)
    .filter((k) => {
      const m = data.notes[k];
      return m.entries.some((e) => noteMatches(e, q, tag) || (q !== "" && tag === "all" && (m.title.toLowerCase().includes(q) || m.map.toLowerCase().includes(q))));
    })
    .sort((a, b) => lastEdit(data.notes[b]) - lastEdit(data.notes[a]));
}

export function noteMatches(e: Note, query: string, tag: Tag | "all"): boolean {
  if (tag !== "all" && e.tag !== tag) return false;
  const q = query.trim().toLowerCase();
  return q === "" || e.text.toLowerCase().includes(q) || e.tag.includes(q) || (e.round !== undefined && `round ${e.round}`.includes(q));
}

export function tagLabel(t: Tag): string {
  return TAGS.find((x) => x.id === t)?.label ?? "Other";
}

// ---------------------------------------------------------------- maps

const MAP_NAMES: Record<string, string> = {
  Ascent: "Ascent",
  Bonsai: "Split",
  Canyon: "Fracture",
  Duality: "Bind",
  Foxtrot: "Breeze",
  Jam: "Lotus",
  Juliett: "Sunset",
  Pitt: "Pearl",
  Port: "Icebox",
  Triad: "Haven",
  Infinity: "Abyss",
  Rook: "Corrode",
};

/** `/Game/Maps/Port/Port` to `Icebox`; an unknown map keeps its code name. */
export function mapName(mapId: string | null | undefined): string {
  if (!mapId) return "";
  const code = mapId.split("/").filter(Boolean).pop() ?? "";
  return MAP_NAMES[code] ?? code;
}

// ---------------------------------------------------------------- dates and Markdown

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDate(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateTime(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Markdown for the given matches (newest first): a heading per match, one bullet per note, grouped by round. */
export function toMarkdown(data: NotesData, keys: string[]): string {
  const lines: string[] = ["# Scrim notes", ""];
  const ordered = keys.filter((k) => data.notes[k]).sort((a, b) => (data.notes[b].startedAt ?? lastEdit(data.notes[b])) - (data.notes[a].startedAt ?? lastEdit(data.notes[a])));
  for (const k of ordered) {
    const m = data.notes[k];
    lines.push(`## ${[m.title, formatDate(m.startedAt)].filter(Boolean).join(" - ")}`, "");
    if (m.map) lines.push(`Map: ${m.map}`, "");
    const sorted = [...m.entries].sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.createdAt - b.createdAt);
    for (const e of sorted) {
      const text = e.text.trim().replace(/\r?\n/g, "\n  ");
      lines.push(`- ${e.round !== undefined ? `Round ${e.round}: ` : ""}[${tagLabel(e.tag)}] ${text}`);
    }
    lines.push("");
  }
  if (ordered.length === 0) lines.push("No notes.", "");
  return lines.join("\n");
}
