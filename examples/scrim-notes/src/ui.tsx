// The views of Scrim Notes, all written in React on SOUP's own React (`app.ui.react`), with SOUP's kit (Button, EmptyState, inputCls)
// so they look like the rest of the app. The same editor is used twice: as the "Notes" tab, and inside the dialog the Library's
// "Notes" button, the Matches tab's "Add note" button and the command open.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal, Notice, type Plugin } from "soup";
import { TAGS, formatDate, formatDateTime, lastEdit, mapName, noteMatches, searchMatches, tagLabel, type MatchNotes, type Note, type Tag } from "./model";
import type { MatchMeta, NotesStore } from "./store";

export interface Ctx {
  plugin: Plugin;
  store: NotesStore;
  /** Write Markdown for the given matches (all when omitted) to a path. */
  exportMarkdown(path: string, keys?: string[]): Promise<number>;
}
let ctx!: Ctx;
export const setCtx = (c: Ctx) => void (ctx = c);

const kit = () => ctx.plugin.app.ui.react.kit;
const useData = () => useSyncExternalStore(ctx.store.subscribe, ctx.store.get);
const useSaveError = () => useSyncExternalStore(ctx.store.subscribeStatus, ctx.store.getSaveError);

// ---------------------------------------------------------------- what SOUP knows about a match

interface LibReplay {
  id: string;
  matchId: string | null;
  name: string;
  map: string | null;
  startedAt: number | null;
  importedAt: number;
}

export async function libraryReplays(): Promise<LibReplay[]> {
  try {
    return ((await ctx.plugin.app.library.list()) as { replays: LibReplay[] }).replays;
  } catch {
    return []; // the Library module is off
  }
}

export const metaOfReplay = (r: LibReplay): MatchMeta => ({ title: r.name, map: r.map ?? "", startedAt: r.startedAt ?? r.importedAt });

/** What to call a match that is only known by its id (a row of the Matches tab): the Library card if it has one, else Riot's details. */
export async function metaOfMatch(matchId: string): Promise<MatchMeta> {
  const card = (await libraryReplays()).find((r) => r.matchId === matchId);
  if (card) return metaOfReplay(card);
  try {
    const d = (await ctx.plugin.app.matches.details(matchId)) as { matchInfo?: { mapId?: string; gameStartMillis?: number } };
    const map = mapName(d.matchInfo?.mapId);
    const startedAt = d.matchInfo?.gameStartMillis ?? null;
    return { title: [map || "Match", formatDate(startedAt)].filter(Boolean).join(" - "), map, startedAt };
  } catch {
    return { title: `Match ${matchId.slice(0, 8)}`, map: "", startedAt: null };
  }
}

// ---------------------------------------------------------------- small pieces

function TagChips({ value, onChange, withAll }: { value: Tag | "all"; onChange: (t: Tag | "all") => void; withAll?: boolean }) {
  const options: Array<{ id: Tag | "all"; label: string }> = withAll ? [{ id: "all", label: "All" }, ...TAGS] : [...TAGS];
  return (
    <div className="sn-chips" role="group" aria-label={withAll ? "Filter by tag" : "Tag"}>
      {options.map((o) => (
        <button key={o.id} type="button" className={`sn-chip sn-tag-${o.id}`} aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TagPill({ tag }: { tag: Tag }) {
  return <span className={`sn-pill sn-tag-${tag}`}>{tagLabel(tag)}</span>;
}

/** Add a note: an optional round, a tag and the text. Ctrl+Enter saves. */
function Composer({ onAdd, autoFocus }: { onAdd: (n: { round?: number; tag: Tag; text: string }) => void; autoFocus?: boolean }) {
  const { Button, inputCls } = kit();
  const defaultTag = useData().settings.defaultTag;
  const [round, setRound] = useState("");
  const [tag, setTag] = useState<Tag>(defaultTag);
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, []);
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    const r = Math.floor(Number(round));
    onAdd({ round: round !== "" && Number.isFinite(r) && r > 0 ? r : undefined, tag, text: t });
    setText("");
    setRound("");
    ref.current?.focus();
  };
  return (
    <div className="sn-composer">
      <div className="sn-composer-row">
        <input className={`${inputCls} sn-round`} type="number" min={1} placeholder="Round" aria-label="Round (optional)" value={round} onChange={(e) => setRound(e.target.value)} />
        <TagChips value={tag} onChange={(t) => t !== "all" && setTag(t)} />
      </div>
      <textarea
        ref={ref}
        className={`${inputCls} sn-text`}
        rows={3}
        placeholder="What happened, what to try next time... (Ctrl+Enter to save)"
        aria-label="Note text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="sn-composer-actions">
        <Button variant="forest" size="sm" disabled={!text.trim()} onClick={submit}>
          Add note
        </Button>
      </div>
    </div>
  );
}

/** One note: read, edit in place, delete. `inlineConfirm` asks "Delete?" in the row (the dialog cannot show another dialog above itself). */
function NoteRow({ matchKey, note, inlineConfirm }: { matchKey: string; note: Note; inlineConfirm?: boolean }) {
  const { Button, inputCls } = kit();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [text, setText] = useState(note.text);
  const [tag, setTag] = useState<Tag>(note.tag);
  const [round, setRound] = useState(note.round !== undefined ? String(note.round) : "");

  const save = () => {
    if (!text.trim()) return;
    const r = Math.floor(Number(round));
    ctx.store.update(matchKey, note.id, { text, tag, round: round !== "" && Number.isFinite(r) && r > 0 ? r : null });
    setEditing(false);
  };
  const remove = async () => {
    if (inlineConfirm) return setAsking(true);
    const ok = await ctx.plugin.app.ui.confirm({ title: "Delete this note?", message: "It is removed from this profile's notes and cannot be brought back.", confirmLabel: "Delete", destructive: true });
    if (ok) ctx.store.remove(matchKey, note.id);
  };

  if (editing) {
    return (
      <li className="sn-note sn-editing" data-note={note.id}>
        <div className="sn-composer-row">
          <input className={`${inputCls} sn-round`} type="number" min={1} placeholder="Round" aria-label="Round (optional)" value={round} onChange={(e) => setRound(e.target.value)} />
          <TagChips value={tag} onChange={(t) => t !== "all" && setTag(t)} />
        </div>
        <textarea className={`${inputCls} sn-text`} rows={3} aria-label="Edit note text" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="sn-composer-actions">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button variant="forest" size="sm" disabled={!text.trim()} onClick={save}>
            Save
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li className="sn-note" data-note={note.id}>
      <div className="sn-note-head">
        <TagPill tag={note.tag} />
        {note.round !== undefined && <span className="sn-round-label">Round {note.round}</span>}
        <span className="sn-when" title={`Written ${formatDateTime(note.createdAt)}`}>
          {formatDateTime(note.updatedAt)}
          {note.updatedAt !== note.createdAt ? " (edited)" : ""}
        </span>
      </div>
      <p className="sn-note-text">{note.text}</p>
      {asking ? (
        <div className="sn-note-actions">
          <span className="sn-ask">Delete this note?</span>
          <Button variant="outline" size="sm" onClick={() => setAsking(false)}>
            Keep
          </Button>
          <Button variant="destructive" size="sm" onClick={() => ctx.store.remove(matchKey, note.id)}>
            Delete note
          </Button>
        </div>
      ) : (
        <div className="sn-note-actions">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => void remove()}>
            Delete
          </Button>
        </div>
      )}
    </li>
  );
}

function NoteList({ matchKey, entries, query, tag, inlineConfirm }: { matchKey: string; entries: Note[]; query: string; tag: Tag | "all"; inlineConfirm?: boolean }) {
  const shown = entries.filter((e) => noteMatches(e, query, tag)).sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || a.createdAt - b.createdAt);
  if (entries.length > 0 && shown.length === 0) return <p className="sn-hint">No note matches this search. Clear it to see all {entries.length}.</p>;
  return (
    <ul className="sn-notes">
      {shown.map((n) => (
        <NoteRow key={n.id} matchKey={matchKey} note={n} inlineConfirm={inlineConfirm} />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- the dialog

function DialogBody({ matchKey, meta, onClose }: { matchKey: string; meta: MatchMeta; onClose: () => void }) {
  const { Button } = kit();
  const data = useData();
  const m: MatchNotes | undefined = data.notes[matchKey];
  return (
    <div className="sn-dialog">
      <p className="sn-sub">
        {[meta.map, formatDate(meta.startedAt)].filter(Boolean).join(" - ") || "Match"}
        {m ? ` - ${m.entries.length} note${m.entries.length === 1 ? "" : "s"}` : ""}
      </p>
      <Composer autoFocus onAdd={(n) => ctx.store.add(matchKey, meta, n)} />
      {m ? <NoteList matchKey={matchKey} entries={m.entries} query="" tag="all" inlineConfirm /> : <p className="sn-hint">No notes on this match yet. The first one you add is saved right away.</p>}
      <div className="soup-ext-buttons">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            ctx.store.focusKey = matchKey;
            onClose();
            ctx.plugin.app.ui.navigate(`${ctx.plugin.manifest.id}.notes`);
          }}
        >
          Open in the Notes tab
        </Button>
        <Button variant="forest" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

/** The dialog for one match. It is SOUP's `Modal` with a React root inside. */
class NotesModal extends Modal {
  private root: Root | null = null;
  constructor(
    private matchKey: string,
    private meta: MatchMeta,
  ) {
    super();
  }
  onOpen() {
    this.setTitle(`Notes: ${this.meta.title}`);
    this.root = createRoot(this.contentEl);
    this.root.render(<DialogBody matchKey={this.matchKey} meta={this.meta} onClose={() => this.close()} />);
  }
  onClose() {
    this.root?.unmount();
    this.root = null;
  }
}

export function openNotesDialog(matchKey: string, meta: MatchMeta): void {
  new NotesModal(matchKey, meta).open();
}

// ---------------------------------------------------------------- the tab

interface Pending {
  key: string;
  meta: MatchMeta;
}

export function NotesTab({ active }: { active?: boolean }) {
  const { Button, EmptyState, inputCls } = kit();
  const data = useData();
  const saveError = useSaveError();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<Tag | "all">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [replays, setReplays] = useState<LibReplay[]>([]);

  // Come back to the match that was last open, or the one another view asked for; refresh the Library list for the picker.
  useEffect(() => {
    if (active === false) return;
    void libraryReplays().then(setReplays);
    if (ctx.store.focusKey) {
      setSelected(ctx.store.focusKey);
      setQuery("");
      setTag("all");
      ctx.store.focusKey = null;
    }
  }, [active]);

  const keys = useMemo(() => searchMatches(data, query, tag), [data, query, tag]);
  const total = Object.values(data.notes).reduce((n, m) => n + m.entries.length, 0);
  const current = selected ?? keys[0] ?? pending?.key ?? null;
  const currentNotes = current ? data.notes[current] : undefined;
  const currentMeta: MatchMeta | null = currentNotes ?? (pending && pending.key === current ? pending.meta : null);

  const pickable = replays.filter((r) => !data.notes[r.matchId ?? `replay:${r.id}`]).sort((a, b) => (b.startedAt ?? b.importedAt) - (a.startedAt ?? a.importedAt));

  const exportKeys = async (which: string[]) => {
    try {
      const path = await ctx.plugin.app.dialog.save({ title: "Export notes", defaultPath: "scrim-notes.md", filters: [{ name: "Markdown", extensions: ["md"] }] });
      if (!path) return;
      const n = await ctx.exportMarkdown(path, which);
      new Notice(`Exported ${n} match${n === 1 ? "" : "es"} to ${path}`);
    } catch (e) {
      ctx.plugin.app.log.warn(`export failed: ${e instanceof Error ? e.message : String(e)}`);
      new Notice(`Could not export: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const picker = (
    <select
      className={`${inputCls} sn-pick`}
      aria-label="Start notes on a match from your Library"
      value=""
      onChange={(e) => {
        const r = replays.find((x) => x.id === e.target.value);
        if (!r) return;
        const key = r.matchId ?? `replay:${r.id}`;
        setPending({ key, meta: metaOfReplay(r) });
        setSelected(key);
        setQuery("");
        setTag("all");
      }}
    >
      <option value="">{pickable.length ? "Start notes on a Library match..." : "No other Library matches"}</option>
      {pickable.slice(0, 60).map((r) => (
        <option key={r.id} value={r.id}>
          {r.name} {formatDate(r.startedAt ?? r.importedAt)}
        </option>
      ))}
    </select>
  );

  return (
    <div className="sn-panel" data-testid="scrim-notes">
      <div className="sn-toolbar">
        <h2 className="sn-title">Scrim Notes</h2>
        <span className="sn-count" title="Notes in this profile">
          {total}
        </span>
        <div className="sn-grow" />
        <Button variant="outline" size="sm" disabled={total === 0} onClick={() => void exportKeys(Object.keys(data.notes))}>
          Export all to Markdown
        </Button>
      </div>
      {saveError && (
        <p className="sn-warn" role="alert">
          The notes could not be saved ({saveError}), so they are lost when SOUP closes. Export them to Markdown now. Saved data is limited to 1 MB per profile.
        </p>
      )}
      <div className="sn-filters">
        <input className={`${inputCls} sn-search`} type="search" placeholder="Search notes, tags, maps..." aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        <TagChips value={tag} onChange={setTag} withAll />
      </div>
      {total === 0 && !pending ? (
        <EmptyState
          title="No notes yet"
          hint="Press Notes on a replay in the Library, Add note on a match in the Matches tab, or use Ctrl+Alt+N after a game. Your notes are kept per profile."
          action={pickable.length > 0 ? <div className="sn-empty-pick">{picker}</div> : undefined}
        />
      ) : (
        <div className="sn-split">
          <div className="sn-side">
            {pickable.length > 0 && picker}
            <ul className="sn-matches" aria-label="Matches with notes">
              {pending && !data.notes[pending.key] && (
                <li>
                  <button type="button" className="sn-match" aria-current={current === pending.key} onClick={() => setSelected(pending.key)}>
                    <span className="sn-match-title">{pending.meta.title}</span>
                    <span className="sn-match-sub">New - no notes yet</span>
                  </button>
                </li>
              )}
              {keys.map((k) => {
                const m = data.notes[k];
                return (
                  <li key={k}>
                    <button type="button" className="sn-match" aria-current={current === k} onClick={() => setSelected(k)}>
                      <span className="sn-match-title">{m.title}</span>
                      <span className="sn-match-sub">
                        {[m.map, formatDate(m.startedAt)].filter(Boolean).join(" - ")} - {m.entries.length} note{m.entries.length === 1 ? "" : "s"} - edited {formatDate(lastEdit(m))}
                      </span>
                    </button>
                  </li>
                );
              })}
              {keys.length === 0 && !pending && <li className="sn-hint">Nothing matches this search.</li>}
            </ul>
          </div>
          <section className="sn-editor" aria-label="Notes on the selected match">
            {current && currentMeta ? (
              <>
                <div className="sn-editor-head">
                  <div className="sn-grow">
                    <h3 className="sn-match-name">{currentMeta.title}</h3>
                    <p className="sn-sub">{[currentMeta.map, formatDate(currentMeta.startedAt)].filter(Boolean).join(" - ")}</p>
                  </div>
                  {currentNotes && (
                    <Button variant="outline" size="sm" onClick={() => void exportKeys([current])}>
                      Export this match
                    </Button>
                  )}
                </div>
                <Composer onAdd={(n) => ctx.store.add(current, currentMeta, n)} />
                {currentNotes ? <NoteList matchKey={current} entries={currentNotes.entries} query={query} tag={tag} /> : <p className="sn-hint">Write the first note above. It is saved as soon as you add it.</p>}
              </>
            ) : (
              <p className="sn-hint">Pick a match on the left.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

