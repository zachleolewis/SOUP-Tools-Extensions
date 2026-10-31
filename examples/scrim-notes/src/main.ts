// Scrim Notes: the common extension points in one small extension: a tab, a settings section, a Library action and badge, a command
// with a shortcut, an event subscription, per-profile saved data and a status line on the extension's row in Settings.
import { Notice, Plugin, Setting, SettingTab } from "soup";

interface Data {
  showOnTiles: boolean;
  notes: number;
}

class NotesSettings extends SettingTab {
  constructor(
    app: unknown,
    private readonly plugin: ScrimNotes,
  ) {
    super(app);
    this.name = "Scrim Notes";
  }

  display() {
    new Setting(this.containerEl)
      .setName("Show a NOTE badge on replay tiles")
      .setDesc("Saved per profile.")
      .addToggle((t) =>
        t.setValue(this.plugin.data.showOnTiles).onChange(async (v) => {
          this.plugin.data.showOnTiles = v;
          await this.plugin.saveData(this.plugin.data);
        }),
      );
  }
}

export default class ScrimNotes extends Plugin {
  data: Data = { showOnTiles: true, notes: 0 };

  async onload() {
    // loadData() gives back what saveData() stored for the ACTIVE profile ({} the first time).
    this.data = { ...this.data, ...(await this.loadData<Partial<Data>>()) };

    this.addTab({
      id: "notes",
      label: "Notes",
      icon: "NotebookPen",
      order: 310,
      // mount(el) works with any framework (or none): fill the element, and return a cleanup if you need one.
      mount: (el) => {
        el.textContent = `Notes: ${this.data.notes}`;
      },
    });

    this.addSettingTab(new NotesSettings(this.app, this));

    this.addLibraryReplayAction({
      id: "note",
      label: "Add a note",
      icon: "NotebookPen",
      run: async (replay) => {
        await this.bump();
        new Notice(`Note ${this.data.notes} saved for ${replay.name}`);
      },
    });
    this.addLibraryReplayBadge({ id: "badge", render: () => (this.data.showOnTiles ? "NOTE" : null) });

    this.addCommand({
      id: "new-note",
      name: "New scrim note",
      hotkey: "Ctrl+Alt+N",
      callback: async () => {
        await this.bump();
        new Notice("Scrim note added");
      },
    });

    // The subscription ends by itself when the extension unloads.
    this.registerEvent(this.app.events.on("library/changed", () => this.app.log.debug("the library changed")));
    this.addStatusText(`${this.data.notes} notes`);
  }

  async bump() {
    this.data.notes++;
    await this.saveData(this.data);
    this.addStatusText(`${this.data.notes} notes`);
  }
}
