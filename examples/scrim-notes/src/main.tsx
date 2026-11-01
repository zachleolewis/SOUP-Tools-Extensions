// Scrim Notes: write notes on any match (per round, tagged, searchable) and export them to Markdown.
//
// This file wires the extension into SOUP. Read it top to bottom: every `add*` call below puts one thing in SOUP, and all of them are
// removed again by SOUP when the extension is turned off (that is what `add*` and `register*` are for; there is no cleanup to write).
//
//   model.ts   the saved data and the logic that needs no SOUP (searching, Markdown)
//   store.ts   the notes in memory, with a subscription for the views and a save after every change
//   ui.tsx     the views: the tab and the dialog, in React with SOUP's kit
//
// What the extension reaches: the Library (to list replays), the match history (to name a match), its own saved data, and, when you
// export, the file you choose. It uses no network and no Riot call.

import { Notice, Plugin, Setting, SettingTab } from "soup";
import { TAGS, matchKey, toMarkdown, type Note, type Tag } from "./model";
import { NotesStore } from "./store";
import { NotesTab, libraryReplays, metaOfMatch, metaOfReplay, openNotesDialog, setCtx } from "./ui";
import "./styles.css";

/** What other extensions can call: `app.extensions.get("scrim-notes")?.api`. The heatmap extension uses it to show a match's notes. */
export interface ScrimNotesApi {
  /** The notes on a match, oldest first (a copy). */
  notesFor(matchId: string): Note[];
  /** Open the Notes tab on that match. */
  open(matchId: string): void;
  /** Write Markdown for the given match keys (every match when omitted) to a file; resolves with how many matches were written. */
  exportMarkdown(path: string, keys?: string[]): Promise<number>;
}

export default class ScrimNotes extends Plugin {
  store = new NotesStore(this);
  private badge?: { refresh(): void };

  api: ScrimNotesApi = {
    notesFor: (matchId) => [...(this.store.get().notes[matchId]?.entries ?? [])],
    open: (matchId) => {
      this.store.focusKey = matchId;
      this.app.ui.navigate(`${this.manifest.id}.notes`);
    },
    exportMarkdown: async (path, keys) => {
      const data = this.store.get();
      const which = keys ?? Object.keys(data.notes);
      await this.app.fs.write(path, toMarkdown(data, which));
      return which.filter((k) => data.notes[k]).length;
    },
  };

  async onload() {
    await this.store.load();
    setCtx({ plugin: this, store: this.store, exportMarkdown: this.api.exportMarkdown });

    // The tab. `component` is a React component; SOUP draws it again when the store says something changed.
    this.addTab({ id: "notes", label: "Notes", icon: "NotebookPen", order: 220, component: NotesTab });

    // The Library: a "Notes" button on every replay tile, and a badge that shows only on replays that have notes.
    this.addLibraryReplayAction({
      id: "notes",
      label: "Notes",
      icon: "NotebookPen",
      slot: "chip",
      run: (replay) => openNotesDialog(matchKey(replay), metaOfReplay(replay)),
    });
    this.badge = this.addLibraryReplayBadge({
      id: "count",
      // Returning null shows nothing, so a replay without notes has no badge.
      render: (replay) => {
        const n = this.store.get().settings.showBadge ? this.store.count(matchKey(replay)) : 0;
        return n > 0 ? `Notes ${n}` : null;
      },
    });
    // The badge reads our data, so it asks the tiles to draw again whenever the data changes.
    this.registerEvent({ off: this.store.subscribe(() => this.badge?.refresh()) });

    // The Matches tab: an "Add note" button on every row of the match history.
    this.addMatchRowAction({
      id: "add-note",
      label: "Add note",
      icon: "NotebookPen",
      run: async (matchId) => openNotesDialog(matchId, await metaOfMatch(matchId)),
    });

    // A command, with a shortcut: notes on the match you just played.
    this.addCommand({
      id: "new-note",
      name: "Scrim Notes: new note for the last match",
      hotkey: "Ctrl+Alt+N",
      callback: () => this.noteForLastMatch(),
    });

    this.addSettingTab(new NotesSettings(this.app, this));
    this.updateStatus();
    this.registerEvent({ off: this.store.subscribe(() => this.updateStatus()) });
    this.app.log.info("scrim-notes loaded");
  }

  /** The most recent match: the first of the match history (needs the Riot Client), or else the newest card in the Library. */
  private async noteForLastMatch() {
    try {
      const history = (await this.app.matches.history()) as Array<{ matchId: string }>;
      if (history[0]) return openNotesDialog(history[0].matchId, await metaOfMatch(history[0].matchId));
    } catch {
      // No Riot Client: the Library is still there.
    }
    const newest = (await libraryReplays()).sort((a, b) => (b.startedAt ?? b.importedAt) - (a.startedAt ?? a.importedAt))[0];
    if (newest) return openNotesDialog(matchKey(newest), metaOfReplay(newest));
    new Notice("No match to write about yet: play one, or add a replay to the Library.");
  }

  private updateStatus() {
    const notes = Object.values(this.store.get().notes);
    const n = notes.reduce((t, m) => t + m.entries.length, 0);
    this.addStatusText(n === 0 ? "No notes yet" : `${n} note${n === 1 ? "" : "s"} on ${notes.length} match${notes.length === 1 ? "" : "es"}`);
  }
}

/** Settings > Scrim Notes. `Setting` builds the rows; they look like the rest of SOUP's settings. */
class NotesSettings extends SettingTab {
  constructor(
    app: unknown,
    private plugin: ScrimNotes,
  ) {
    super(app);
    this.name = "Scrim Notes";
  }

  display() {
    const { store, app } = this.plugin;
    const el = this.containerEl;
    new Setting(el)
      .setName("Default tag")
      .setDesc("The tag a new note starts with.")
      .addDropdown((d) => {
        for (const t of TAGS) d.addOption(t.id, t.label);
        d.setValue(store.get().settings.defaultTag).onChange((v) => store.setSettings({ defaultTag: v as Tag }));
      });
    new Setting(el)
      .setName("Show the Notes badge on replays")
      .setDesc("A small chip with the number of notes on a replay's tile in the Library.")
      .addToggle((t) => t.setValue(store.get().settings.showBadge).onChange((v) => store.setSettings({ showBadge: v })));
    new Setting(el)
      .setName("Delete all notes in this profile")
      .setDesc("Other profiles keep theirs. This cannot be undone: export to Markdown first if you want a copy.")
      .addButton((b) =>
        b
          .setButtonText("Delete all notes")
          .setWarning()
          .onClick(async () => {
            const ok = await app.ui.confirm({ title: "Delete all notes?", message: "Every note in this profile is deleted.", confirmLabel: "Delete all", destructive: true });
            if (!ok) return;
            store.removeAll();
            new Notice("All notes in this profile were deleted");
          }),
      );
  }
}
