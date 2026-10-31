// Match Exporter: a button on every Library folder that writes the folder's replays to a CSV file.
// It uses the Library's own API (`app.modules.get("library")`), a save dialog (`app.dialog`) and the file system (`app.fs`).
import { Notice, Plugin } from "soup";
import type { LibraryFolder, LibraryReplay } from "soup";

/** The part of the Library module's snapshot this extension reads. */
interface LibrarySnapshot {
  replays: LibraryReplay[];
}

interface LibraryApi {
  list(): Promise<LibrarySnapshot>;
}

/** One CSV field: quoted when it holds a comma, a quote or a line break. */
export function csvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(replays: LibraryReplay[]): string {
  const head = ["name", "map", "mode", "score", "players", "played", "match id"];
  const rows = replays.map((r) => [
    r.name,
    r.map,
    r.mode,
    r.score,
    r.agents.map((a) => a.name ?? "").join(" "),
    r.startedAt ? new Date(r.startedAt).toISOString() : "",
    r.matchId,
  ]);
  return [head, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n") + "\r\n";
}

export default class MatchExporter extends Plugin {
  async onload() {
    this.addLibraryFolderAction({
      id: "export-csv",
      label: "Export to CSV",
      icon: "Download",
      run: (folder) => this.exportFolder(folder),
    });
  }

  async exportFolder(folder: LibraryFolder) {
    const library = this.app.modules.get<LibraryApi>("library");
    if (!library) {
      new Notice("The Library module is off");
      return;
    }
    const replays = (await library.list()).replays.filter((r) => r.folderId === folder.id);
    if (replays.length === 0) {
      new Notice(`"${folder.name}" has no replays`);
      return;
    }
    // null means the person closed the dialog.
    const target = await this.app.dialog.save({
      title: "Export replays to CSV",
      defaultPath: `${folder.name}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!target) return;
    await this.app.fs.write(target, toCsv(replays));
    new Notice(`Wrote ${replays.length} replays to ${target}`);
    this.app.log.info(`exported ${replays.length} replays`);
  }
}
