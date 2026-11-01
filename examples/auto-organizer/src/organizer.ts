// The work of Auto Organizer: file a replay by the rules, back it up, tell Discord, remember what it did so it can be undone.
//
// The rules are the person's, saved per profile (`saveData`). The Library is changed only through the Library module's own calls
// (`createFolder`, `moveItem`, `renameReplay`), the same ones SOUP's screens use, so the catalog, the disk and the other screens stay
// in step. A failure in any step is shown (a Notice and a log line) and the next step, and the next match, carry on.

import { Notice, normalizePath, type Plugin } from "soup";
import { DEFAULT_RULES, factsOf, findFolder, isDiscordWebhook, modeAllowed, pathOf, planFor, resultFor, topFragger, undoSteps, type FolderLite, type Plan, type ReplayLite, type Rules } from "./logic";

export interface ReplayFull extends ReplayLite {
  vrfPath: string | null;
  jsonPath: string | null;
}

interface LibraryApi {
  list(): Promise<{ folders: FolderLite[]; replays: ReplayFull[] }>;
  createFolder(name: string, parentId: string | null, color: string | null): Promise<FolderLite>;
  moveItem(kind: "replay" | "folder", id: string, folderId: string | null): Promise<void>;
  renameReplay(id: string, name: string): Promise<void>;
}

export interface Undo {
  replayId: string;
  from: { folderId: string | null; name: string };
  to: { folderId: string | null; name: string };
}

export interface LogEntry {
  id: string;
  at: number;
  kind: "organized" | "backup" | "webhook" | "undo" | "skipped" | "error";
  text: string;
  undo?: Undo;
  undone?: boolean;
}

export interface Data {
  version: 1;
  rules: Rules;
  /** The last 50 things it did, newest first. */
  log: LogEntry[];
  /** Replays whose backup and Discord message are done, so a second event for the same match does neither again. */
  handled: Record<string, true>;
}

const LOG_LIMIT = 50;
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const baseName = (p: string) => normalizePath(p).split("/").pop() ?? p;

export function normalizeData(raw: unknown): Data {
  const r = (raw ?? {}) as Partial<Data>;
  const rules = { ...DEFAULT_RULES, ...(r.rules ?? {}) } as Rules;
  rules.modes = Array.isArray(rules.modes) ? rules.modes.filter((m) => typeof m === "string") : [];
  return { version: 1, rules, log: Array.isArray(r.log) ? r.log.filter((e) => e && typeof e.text === "string").slice(0, LOG_LIMIT) : [], handled: r.handled && typeof r.handled === "object" ? r.handled : {} };
}

export class Organizer {
  private data: Data = normalizeData(null);
  private listeners = new Set<() => void>();
  private saving: Promise<void> = Promise.resolve();
  private saveTimer: number | undefined;
  /** Jobs run one at a time, so two matches saved close together never fight over the same folder. */
  private chain: Promise<unknown> = Promise.resolve();
  /** Set when the extension is turned off: queued jobs and the retry loop stop instead of touching the Library. */
  private disposed = false;

  constructor(private plugin: Plugin) {}

  private get app() {
    return this.plugin.app;
  }

  async load(): Promise<void> {
    this.data = normalizeData(await this.plugin.loadData());
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  };
  get = (): Data => this.data;

  private commit(next: Data, saveNow = true): void {
    this.data = next;
    for (const l of [...this.listeners]) l();
    if (saveNow) this.save();
  }

  private save(): void {
    const snapshot = this.data;
    this.saving = this.saving.then(() => this.plugin.saveData(snapshot)).catch((e) => this.app.log.warn(`could not save: ${errText(e)}`));
  }

  /** Typing in a settings field changes the rules on every key; the save waits for a pause. */
  setRules(patch: Partial<Rules>): void {
    this.commit({ ...this.data, rules: { ...this.data.rules, ...patch } }, false);
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 400);
  }

  /** The extension is being turned off: nothing queued runs any more. */
  dispose(): void {
    this.disposed = true;
  }

  flush(): Promise<void> {
    window.clearTimeout(this.saveTimer);
    this.save();
    return this.saving;
  }

  clearLog(): void {
    this.commit({ ...this.data, log: [] });
  }

  private note(kind: LogEntry["kind"], text: string, extra: Partial<LogEntry> = {}): LogEntry {
    const entry: LogEntry = { id: uid(), at: Date.now(), kind, text, ...extra };
    this.commit({ ...this.data, log: [entry, ...this.data.log].slice(0, LOG_LIMIT) });
    return entry;
  }

  /** A failure: a Notice, a log line in SOUP and a line in the activity list. Never thrown. */
  private fail(what: string, e: unknown): void {
    const text = `${what}: ${errText(e)}`;
    this.app.log.warn(text);
    this.note("error", text);
    new Notice(`Auto Organizer: ${text}`, 8000, "error");
  }

  private library(): LibraryApi {
    const api = this.app.modules.get<LibraryApi>("library");
    if (!api) throw new Error("the Library module is off");
    return api;
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job);
    this.chain = run.catch(() => undefined);
    return run;
  }

  // ------------------------------------------------------------ what the rules would do

  /** The signed-in account's id, for `{result}`; null without a Riot Client. */
  private async me(): Promise<string | null> {
    try {
      return (await this.app.riot.identity())?.puuid ?? null;
    } catch {
      return null;
    }
  }

  private async readDetails(r: ReplayFull): Promise<unknown> {
    if (!r.jsonPath) return null;
    try {
      return JSON.parse(await this.app.fs.readText(r.jsonPath));
    } catch {
      return null; // a missing or broken match file only means `{result}` stays empty
    }
  }

  private async resultOf(r: ReplayFull, me: string | null): Promise<string> {
    const { folderTemplate, renameTemplate } = this.data.rules;
    if (!/\{result\}/.test(folderTemplate + renameTemplate) || !me) return "";
    return resultFor(await this.readDetails(r), me);
  }

  /** What "Organize existing replays..." would do to every replay, changing nothing. */
  async preview(): Promise<Array<{ replay: ReplayFull; plan: Plan | null; skip: string | null }>> {
    const { folders, replays } = await this.library().list();
    const me = await this.me();
    const rules = this.data.rules;
    const out: Array<{ replay: ReplayFull; plan: Plan | null; skip: string | null }> = [];
    // Planned one after another against the list as it would be: two replays that would get the same name in a folder do not.
    let working = replays.map((r) => ({ ...r }));
    for (const r of [...replays].sort((a, b) => (b.startedAt ?? b.importedAt) - (a.startedAt ?? a.importedAt))) {
      if (!modeAllowed(rules.modes, r.mode)) {
        out.push({ replay: r, plan: null, skip: `mode ${r.mode ?? "unknown"} is not in the list` });
        continue;
      }
      const plan = planFor(r, rules, folders, working, await this.resultOf(r, me));
      if (!plan.move && !plan.rename) out.push({ replay: r, plan: null, skip: "already in place" });
      else {
        out.push({ replay: r, plan, skip: null });
        working = working.map((x) => (x.id === r.id ? { ...x, name: plan.to.name, folderId: plan.to.folderExists ? plan.to.folderId : `new:${plan.to.folderPath.join("/")}` } : x));
      }
    }
    return out;
  }

  // ------------------------------------------------------------ doing it

  /** The Library's "Organize existing replays..." after the preview: file these replays. */
  applyPreview(replayIds: string[]): Promise<{ done: number; failed: number }> {
    return this.enqueue(async () => {
      let done = 0;
      let failed = 0;
      for (const id of replayIds) {
        if (this.disposed) break;
        const r = (await this.library().list()).replays.find((x) => x.id === id);
        if (!r) continue;
        const ok = await this.organizeOne(r, "manual");
        if (ok) done++;
        else failed++;
      }
      return { done, failed };
    });
  }

  /** SOUP saved a finished match (`match-capture/auto-saved`): find its replay and file it. */
  onAutoSaved(matchId: string): Promise<void> {
    if (!this.data.rules.enabled || this.disposed) return Promise.resolve();
    return this.enqueue(async () => {
      let r: ReplayFull | undefined;
      // The catalog can lag the event by a moment.
      for (let i = 0; i < 4 && !r; i++) {
        if (i > 0) await new Promise((res) => setTimeout(res, 1500));
        if (this.disposed) return;
        try {
          r = (await this.library().list()).replays.find((x) => x.matchId === matchId);
        } catch (e) {
          return this.fail("The Library could not be read", e);
        }
      }
      if (!r) return this.fail("A match was saved but is not in the Library", new Error(matchId));
      await this.organizeOne(r, "auto");
    });
  }

  /** File, back up and announce one replay. Resolves false when the filing itself failed. */
  private async organizeOne(r: ReplayFull, trigger: "auto" | "manual"): Promise<boolean> {
    const rules = this.data.rules;
    if (!modeAllowed(rules.modes, r.mode)) {
      if (trigger === "auto") this.note("skipped", `Left "${r.name}" alone: its mode (${r.mode ?? "unknown"}) is not in the list.`);
      return true;
    }
    let ok = true;
    let current = r;
    try {
      const lib = this.library();
      const { folders, replays } = await lib.list();
      const plan = planFor(r, rules, folders, replays, await this.resultOf(r, await this.me()));
      if (plan.move || plan.rename) {
        const folderId = plan.to.folderExists ? plan.to.folderId : await this.ensurePath(lib, folders, plan.to.folderPath);
        if (plan.move) await lib.moveItem("replay", r.id, folderId);
        if (plan.rename) await lib.renameReplay(r.id, plan.to.name);
        const where = plan.to.folderPath.length ? plan.to.folderPath.join("/") : "the top of the Library";
        this.note("organized", `Filed in ${where}${plan.rename ? ` as "${plan.to.name}" (was "${r.name}")` : ""}.`, {
          undo: { replayId: r.id, from: { folderId: r.folderId, name: r.name }, to: { folderId, name: plan.to.name } },
        });
        if (trigger === "auto") new Notice(`Auto Organizer: filed "${plan.to.name}" in ${where}`);
      }
      current = (await lib.list()).replays.find((x) => x.id === r.id) ?? r;
    } catch (e) {
      ok = false;
      this.fail(`Could not file "${r.name}"`, e);
    }

    if (rules.backupDir.trim()) {
      try {
        await this.backup(current);
      } catch (e) {
        this.fail(`Backup of "${current.name}" failed`, e);
      }
    }
    if (trigger === "auto" && rules.webhookUrl.trim() && !this.data.handled[r.id]) {
      try {
        await this.announce(current);
        this.commit({ ...this.data, handled: { ...this.data.handled, [r.id]: true } });
      } catch (e) {
        this.fail("The Discord message failed", e);
      }
    }
    return ok;
  }

  /** Make the folders of `path` that do not exist yet (the Library creates the directories) and return the last one's id. */
  private async ensurePath(lib: LibraryApi, folders: FolderLite[], path: string[]): Promise<string | null> {
    let known = [...folders];
    let parent: string | null = null;
    for (let i = 0; i < path.length; i++) {
      const have = findFolder(known, path.slice(0, i + 1));
      if (have.exists) {
        parent = have.id;
        continue;
      }
      const made: FolderLite = await lib.createFolder(path[i], parent, null);
      known = [...known, { id: made.id, name: made.name, parentId: made.parentId ?? parent }];
      parent = made.id;
    }
    return parent;
  }

  private async backup(r: ReplayFull): Promise<void> {
    const dir = normalizePath(this.data.rules.backupDir.trim());
    await this.app.fs.mkdir(dir);
    let copied = 0;
    for (const p of [r.vrfPath, r.jsonPath]) {
      if (!p) continue;
      const to = `${dir}/${baseName(p)}`;
      if (await this.app.fs.exists(to)) continue; // already there: a backup is never overwritten
      await this.app.fs.copy(p, to);
      copied++;
    }
    if (copied > 0) this.note("backup", `Copied ${copied} file${copied === 1 ? "" : "s"} of "${r.name}" to the backup folder.`);
  }

  // ------------------------------------------------------------ Discord

  /** A short summary embed: map, score, who got the most kills. No links. */
  private async announce(r: ReplayFull): Promise<void> {
    const details = await this.readDetails(r);
    const me = await this.me();
    const f = factsOf(r, resultFor(details, me));
    const top = topFragger(details);
    const lines = [`Score: ${f.score || "unknown"}`, f.result ? `Result: ${f.result}` : "", top ? `Top fragger: ${top.name} (${top.kills} kills)` : ""].filter(Boolean);
    await this.post({ title: `${f.mode} on ${f.map}`, description: lines.join("\n"), timestamp: new Date(f.startedAt).toISOString() });
    this.note("webhook", `Posted a summary of "${r.name}" to Discord.`);
  }

  /** The "Send a test message" button. */
  async sendTest(): Promise<void> {
    try {
      await this.post({ title: "Test message", description: "Auto Organizer can reach this channel." });
      this.note("webhook", "Sent a test message to Discord.");
      new Notice("Auto Organizer: the test message was sent");
    } catch (e) {
      this.fail("The test message failed", e);
    }
  }

  private async post(embed: { title: string; description: string; timestamp?: string }): Promise<void> {
    const url = this.data.rules.webhookUrl.trim();
    if (!isDiscordWebhook(url)) throw new Error("the address is not a Discord webhook address (https://discord.com/api/webhooks/...)");
    // The accent colour of the person's theme, as the integer Discord wants. (SOUP's log lists the address of a request; a webhook address is a secret, so do not share your log.)
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--forest-300").trim();
    await this.app.requestUrl({ url, method: "POST", body: { username: "SOUP", embeds: [{ ...embed, color: colorInt(accent), footer: { text: "Auto Organizer" } }] }, timeoutMs: 15000 });
  }

  // ------------------------------------------------------------ undo

  /** Put a replay back where it was and what it was called, if nobody changed it since. Safe to run again after a failure: the part already back is skipped. */
  undo(entryId: string): Promise<void> {
    return this.enqueue(async () => {
      const entry = this.data.log.find((e) => e.id === entryId);
      if (!entry?.undo || entry.undone) return;
      const u = entry.undo;
      try {
        const lib = this.library();
        const r = (await lib.list()).replays.find((x) => x.id === u.replayId);
        if (!r) throw new Error("the replay is not in the Library any more");
        const steps = undoSteps(r, u);
        if (typeof steps === "string") throw new Error(steps);
        // The reverse of what was done: the name first, then the folder. A step that failed last time is simply the one still to do.
        if (steps.rename) await lib.renameReplay(r.id, u.from.name);
        if (steps.move) await lib.moveItem("replay", r.id, u.from.folderId);
        const folders = (await lib.list()).folders;
        this.commit({ ...this.data, log: this.data.log.map((e) => (e.id === entryId ? { ...e, undone: true } : e)) });
        const back = u.from.folderId ? pathOf(folders, u.from.folderId).join("/") : "the top of the Library";
        this.note("undo", `Put "${u.from.name}" back in ${back}.`);
        new Notice(`Auto Organizer: put "${u.from.name}" back`);
      } catch (e) {
        this.fail("Could not undo", e);
      }
    });
  }
}

/** `148 42% 54%` (a theme variable) to the 0xRRGGBB integer Discord's embeds use. */
export function colorInt(channels: string): number {
  const m = /(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(channels);
  if (!m) return 0x4ec98a;
  const h = (((Number(m[1]) % 360) + 360) % 360) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round((l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
