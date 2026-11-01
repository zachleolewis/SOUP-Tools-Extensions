// The notes, in memory, with a subscription for the UI and a save after every change.
//
// React views read it with `useSyncExternalStore(store.subscribe, store.get)`: `get` returns a new object after every change, which
// is what makes a view draw again. (The first version of this example kept a counter in a static `textContent` and never
// re-rendered. This is the part that fixes it.)

import type { Plugin } from "soup";
import { emptyData, newId, normalize, type MatchNotes, type Note, type NotesData, type Settings, type Tag } from "./model";

export interface MatchMeta {
  title: string;
  map: string;
  startedAt: number | null;
}

export class NotesStore {
  private data: NotesData = emptyData();
  private listeners = new Set<() => void>();
  private saving: Promise<void> = Promise.resolve();
  /** The match the Notes tab should show when it opens (set by the dialog's "Open in the Notes tab" and by other extensions). */
  focusKey: string | null = null;

  constructor(private plugin: Plugin) {}

  async load(): Promise<void> {
    this.data = normalize(await this.plugin.loadData());
  }

  /** For `useSyncExternalStore`. */
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  };

  get = (): NotesData => this.data;

  count(key: string): number {
    return this.data.notes[key]?.entries.length ?? 0;
  }

  // ------------------------------------------------------------ changes

  add(key: string, meta: MatchMeta, input: { round?: number; tag: Tag; text: string }): Note {
    const now = Date.now();
    const note: Note = { id: newId(), round: input.round, tag: input.tag, text: input.text.trim(), createdAt: now, updatedAt: now };
    const existing = this.data.notes[key];
    const next: MatchNotes = existing ? { ...existing, entries: [...existing.entries, note] } : { ...meta, entries: [note] };
    this.commit({ ...this.data, notes: { ...this.data.notes, [key]: next } });
    return note;
  }

  update(key: string, id: string, patch: { round?: number | null; tag?: Tag; text?: string }): void {
    const m = this.data.notes[key];
    if (!m) return;
    const entries = m.entries.map((e) =>
      e.id !== id
        ? e
        : {
            ...e,
            tag: patch.tag ?? e.tag,
            text: patch.text !== undefined ? patch.text.trim() : e.text,
            round: patch.round === undefined ? e.round : patch.round === null ? undefined : patch.round,
            updatedAt: Date.now(),
          },
    );
    this.commit({ ...this.data, notes: { ...this.data.notes, [key]: { ...m, entries } } });
  }

  remove(key: string, id: string): void {
    const m = this.data.notes[key];
    if (!m) return;
    const entries = m.entries.filter((e) => e.id !== id);
    const notes = { ...this.data.notes };
    if (entries.length === 0) delete notes[key];
    else notes[key] = { ...m, entries };
    this.commit({ ...this.data, notes });
  }

  removeAll(): void {
    this.commit({ ...this.data, notes: {} });
  }

  setSettings(patch: Partial<Settings>): void {
    this.commit({ ...this.data, settings: { ...this.data.settings, ...patch } });
  }

  // ------------------------------------------------------------ saving

  private commit(next: NotesData): void {
    this.data = next;
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch (e) {
        this.plugin.app.log.warn(`a notes listener threw: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    // Saves run one after the other, so an older snapshot never lands after a newer one.
    const snapshot = next;
    this.saving = this.saving
      .then(() => this.plugin.saveData(snapshot))
      .catch((e) => this.plugin.app.log.warn(`could not save the notes: ${e instanceof Error ? e.message : String(e)}`));
  }

  /** Resolves when everything changed so far is on disk. */
  flush(): Promise<void> {
    return this.saving;
  }
}
