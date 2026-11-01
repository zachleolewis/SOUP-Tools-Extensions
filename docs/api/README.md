# API reference

Generated from [`types/soup.d.ts`](../../types/soup.d.ts) for extension API version **1.0.0** by SOUP's `extension-api:publish` script. Do not edit by hand.

```ts
import { Plugin, Notice /* ... */ } from "soup";
```

## Classes

### Modal

```ts
/** A dialog: fill `contentEl` in `onOpen`, call `close()` to end it. */
export class Modal {
  app: unknown;
  titleEl: HTMLElement;
  contentEl: HTMLElement;
  constructor(app?: unknown);
  setTitle(title: string): this;
  open(): void;
  close(): void;
  onOpen(): void | Promise<void>;
  onClose(): void | Promise<void>;
}
```

### Notice

```ts
/** A toast. */
export class Notice {
  constructor(message: string, durationMs?: number);
}
```

### Plugin

```ts
/**
 * The base class of an extension: `export default class X extends Plugin`. Everything registered through `register*` and `add*`
 * is removed when the extension unloads, in reverse order, after `onunload()`.
 */
export class Plugin {
  app: App;
  manifest: ExtensionManifestInfo;
  constructor(app: App, manifest: ExtensionManifestInfo);

  /** Called once when the extension loads. A throw marks it "Error" and removes what it added; SOUP and other extensions carry on. */
  onload(): void | Promise<void>;
  /** Called when it unloads (turned off, removed, updated, Restricted mode, a profile switch), before the registered cleanups. */
  onunload(): void | Promise<void>;

  /** Per-profile settings (at most 1 MB of JSON); `{}` when nothing was saved. */
  loadData<T = Record<string, unknown>>(): Promise<T>;
  saveData(data: unknown): Promise<void>;
  /** The folder for this extension's files in the active profile (created). */
  readonly dataDir: string;
  /** The folder for files that are the same under every profile (created). */
  readonly machineDir: string;

  /** Run `fn` when the extension unloads (after `onunload`, in reverse order of registration). */
  register(fn: () => void | Promise<void>): void;
  /** `this.registerEvent(this.app.events.on(...))`: the subscription ends when the extension unloads. */
  registerEvent(ref: { off: () => void }): void;
  registerInterval(id: number): number;
  registerDomEvent<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  registerDomEvent<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions): void;
  registerDomEvent(target: HTMLElement, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void;

  addTab(o: TabOptions): Handle;
  /** A small item in the header, beside the connection pill. */
  addHeaderItem(o: Placement & Mountable): Handle;
  /** A strip under the navigation, shown on every tab. */
  addActivityBar(o: Placement & Mountable): Handle;
  addMatchesSidebarPanel(o: PanelOptions): Handle;
  addViewer3dPanel(o: PanelOptions): Handle;
  /**
   * This extension's settings page, titled by the tab's `name` (default: the extension's name). A cog on the extension's row in
   * Settings > Extensions opens it. One per extension: a second call replaces the first.
   */
  addSettingTab(tab: SettingTab): Handle;
  /** Open this extension's settings page (for a "Settings" button in your own tab). */
  openSettings(): void;
  addLibraryReplayAction(o: ReplayActionOptions): Handle;
  /** A chip next to the replay's name on its Library tile. Call the returned `refresh()` when what `render` answers has changed (a note was added). */
  addLibraryReplayBadge(o: ReplayBadgeOptions): Handle & { refresh(): void };
  addLibraryFolderAction(o: FolderActionOptions): Handle;
  addLibraryToolbarAction(o: ToolbarActionOptions): Handle;
  /** A button on each row of the Matches tab (match history). */
  addMatchRowAction(o: MatchRowActionOptions): Handle;
  /** A command in the palette (Ctrl+K) and an optional keyboard shortcut. */
  addCommand(spec: CommandSpec): Handle;
  /** Small text on this extension's row in Settings > Extensions ("Synced 2 min ago"). */
  addStatusText(text: string): void;
}
```

### RequestError

```ts
export class RequestError extends Error {
  status: number;
  response: RequestUrlResponse;
}
```

### Setting

```ts
/** One settings row: `new Setting(el).setName("x").setDesc("y").addToggle((t) => t.setValue(true).onChange(save))`. */
export class Setting {
  readonly settingEl: HTMLElement;
  readonly infoEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly controlEl: HTMLElement;
  constructor(containerEl: HTMLElement);
  setName(name: string | DocumentFragment): this;
  /** Text, or a fragment you built (a link, a line break). */
  setDesc(desc: string | DocumentFragment): this;
  /** Make this row a heading that starts a group (`new Setting(el).setName("Discord").setHeading()`). */
  setHeading(): this;
  /** Add a CSS class to the row (your styles.css can style it). */
  setClass(cls: string): this;
  /** Grey the row out and turn its controls off (or on again). */
  setDisabled(d: boolean): this;
  /** Hide the row (or show it again), for settings that only matter when another one is on. */
  setVisible(v: boolean): this;
  addColorPicker(cb: (c: ColorComponent) => void): this;
  addExtraButton(cb: (c: ExtraButtonComponent) => void): this;
  addToggle(cb: (c: ToggleComponent) => void): this;
  addText(cb: (c: TextComponent) => void): this;
  addTextArea(cb: (c: TextComponent) => void): this;
  addDropdown(cb: (c: DropdownComponent) => void): this;
  addButton(cb: (c: ButtonComponent) => void): this;
  addSlider(cb: (c: SliderComponent) => void): this;
}
```

### SettingTab

```ts
/**
 * An extension's settings page, opened from the cog on its row in Settings > Extensions (or `plugin.openSettings()`).
 * SOUP empties `containerEl` and calls `display()` each time the page opens, and `hide()` when it closes. Save with
 * `plugin.saveData`: the settings then belong to the active profile, and each profile has its own.
 */
export class SettingTab {
  app: unknown;
  containerEl: HTMLElement;
  /** The page title (default: the extension's name). */
  name?: string;
  constructor(app?: unknown);
  display(): void;
  hide(): void;
  /** Empty the page and call `display()` again (after a change that shows or hides rows). */
  redraw(): void;
}
```

## Functions

### debounce

```ts
/** Run `fn` once calls stop for `ms` (default 250). */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms?: number): (...a: A) => void;
```

### normalizePath

```ts
/** Forward slashes, no doubled or trailing slashes. */
export function normalizePath(p: string): string;
```

## Constants

### apiVersion

```ts
/** The extension API version of this SOUP (a manifest's `apiVersion` range must contain it). */
export const apiVersion: string;
```

### Platform

```ts
export const Platform: { isWindows: boolean };
```

## Interfaces

### App

```ts
/** What an extension reaches SOUP through: `this.app`. */
export interface App {
  /** This extension's id. */
  id: string;

  /** The built-in modules (their frontend APIs) and whether they are on. */
  modules: {
    isEnabled(module: string): boolean;
    /** The module's frontend API object (the one SOUP's own screens use), or undefined when the module is off. */
    get<T = unknown>(module: string): T | undefined;
  };
  library: {
    list(): Promise<unknown>;
    root(): Promise<string>;
    onChanged(cb: (c: unknown) => void): EventRef;
  };
  matches: {
    history(): Promise<unknown>;
    details(matchId: string): Promise<unknown>;
    liveState(): Promise<unknown>;
  };

  /** The Riot account and the Riot Client. Everything here is full trust: see docs/09-riot.md before using it. */
  riot: {
    /** The signed-in account, or null (no Riot Client, or nobody signed in). */
    identity(): Promise<Identity | null>;
    /** The Riot tokens and client headers (connects to the Riot Client first if needed). Treat them like the account's password. */
    tokens(): Promise<RawSession>;
    /** A call to the Riot Client's local API (any method, a path starting with /). Returns the status even when it is not 2xx. */
    local(method: string, path: string, body?: unknown): Promise<RiotResponse>;
    /** A call to a remote Riot service with the session's headers, through SOUP's shared limiter. `url` must be https. */
    remote(method: string, target: { service: "pd" | "glz" | "shared"; path: string } | { url: string }, body?: unknown, headers?: Record<string, string>): Promise<RiotResponse>;
    /** Events of the Riot Client's socket whose URI contains `uri` (empty: every event), with their payloads. */
    onLocalEvent(uri: string, cb: (e: ClientEvent) => void): Promise<Stoppable>;
    connection(): Promise<ConnectionState>;
    onConnectionChanged(cb: (c: ConnectionState) => void): EventRef;
  };

  events: {
    /** A SOUP event (`library/changed`, `core/profile-changed`, ...) or another extension's (`<id>/<name>`). */
    on(name: string, cb: (payload: any) => void): EventRef;
    /** Tell other extensions: the name must start with this extension's id and a slash. */
    emit(name: string, payload?: unknown): void;
  };

  /** The file system. Any path; a relative path starts in `dataDir`. */
  fs: {
    read(path: string): Promise<Uint8Array>;
    readText(path: string): Promise<string>;
    write(path: string, data: string | Uint8Array | ArrayBuffer): Promise<void>;
    append(path: string, data: string | Uint8Array | ArrayBuffer): Promise<void>;
    /** Folders first, then by name. */
    list(path: string): Promise<FsEntry[]>;
    stat(path: string): Promise<FsStat>;
    exists(path: string): Promise<boolean>;
    mkdir(path: string): Promise<void>;
    remove(path: string, o?: { recursive?: boolean }): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    copy(from: string, to: string): Promise<void>;
    /** Call `cb` when something under `path` is created, changed or removed (checked twice a second). */
    watch(path: string, cb: (e: WatchEvent) => void): Promise<Stoppable>;
  };

  /** Programs. Children that are not `detached` are stopped when the extension unloads or SOUP exits. */
  process: {
    spawn(cmd: string, args?: string[], o?: SpawnOptions): Promise<ProcessHandle>;
    /** Run a program to the end and return what it printed. */
    exec(cmd: string, args?: string[], o?: SpawnOptions & { input?: string }): Promise<{ code: number | null; stdout: string; stderr: string }>;
    /** Open a file or folder with Windows' default program. */
    openPath(path: string): Promise<void>;
    /** Open an address (a website, a mail link, ...) in its default program. */
    openUrl(url: string): Promise<void>;
  };

  dialog: {
    openFile(o?: DialogInput): Promise<string | null>;
    openFiles(o?: DialogInput): Promise<string[]>;
    openFolder(o?: DialogInput): Promise<string | null>;
    save(o?: DialogInput): Promise<string | null>;
  };
  clipboard: {
    readText(): Promise<string | null>;
    writeText(text: string): Promise<void>;
  };

  /** Any URL from SOUP's side of the app: no CORS, any method. */
  requestUrl(opts: RequestUrlOptions | string): Promise<RequestUrlResponse>;

  profiles: {
    active(): Promise<ProfileInfo | undefined>;
    list(): Promise<ProfileInfo[]>;
    /** Fires before the window reloads for the new profile. */
    onChange(cb: (p: ProfileInfo) => void): EventRef;
  };

  /** Other extensions. */
  extensions: {
    /** The loaded instance of another extension (its public `api` property is what it offers). */
    get(other: string): Plugin | undefined;
    isEnabled(other: string): boolean;
    list(): ExtensionSummary[];
  };

  ui: {
    /** An awaited yes/no dialog. */
    confirm(o: { title: string; message: string; confirmLabel?: string; destructive?: boolean }): Promise<boolean>;
    /** Switch to a tab by its id (`<extension id>.<tab id>` for an extension's tab). */
    navigate(tabId: string): void;
    /** A separate window for the extension's own page (a file of the extension, or an https address). */
    openWindow(o: { url: string; title?: string; width?: number; height?: number; alwaysOnTop?: boolean }): Promise<{ label: string; url: string; close(): Promise<boolean> }>;
    /** SOUP's React and its UI kit, so an extension looks native. */
    react: {
      React: typeof import("react");
      ReactDOM: typeof import("react-dom") & typeof import("react-dom/client");
      jsxRuntime: typeof import("react/jsx-runtime");
      createElement: typeof import("react").createElement;
      Fragment: typeof import("react").Fragment;
      kit: {
        Button: ComponentType<any>;
        Switch: ComponentType<any>;
        Progress: ComponentType<any>;
        StatusPill: ComponentType<any>;
        EmptyState: ComponentType<any>;
        ErrorCard: ComponentType<any>;
        SettingsSection: ComponentType<any>;
        inputCls: string;
      };
    };
    /** The theme tokens (CSS variables on <html>) and a way to hear when they change. */
    theme: {
      tokens(): Record<string, string>;
      onChange(cb: (tokens: Record<string, string>) => void): EventRef;
    };
  };

  paths: {
    dataDir: string;
    machineDir: string;
    saveDir: string;
    libraryRoot: string;
    valorantDemos: string;
    vr3dDir: string;
    tempDir: string;
    /** The extension's own folder (where main.js is): a helper program shipped with the extension lives here. */
    codeDir: string;
  };

  /** Lines into SOUP's log under `[ext-<id>]` (visible in the debug console). */
  log: {
    debug(message: string, data?: unknown): void;
    info(message: string, data?: unknown): void;
    warn(message: string, data?: unknown): void;
    error(message: string, data?: unknown): void;
  };
}
```

### ButtonComponent

```ts
export interface ButtonComponent {
  readonly buttonEl: HTMLButtonElement;
  setButtonText(t: string): this;
  setCta(): this;
  setWarning(): this;
  setDisabled(d: boolean): this;
  onClick(cb: () => void): this;
}
```

### ColorComponent

```ts
export interface ColorComponent {
  readonly colorEl: HTMLInputElement;
  /** `#rrggbb`. */
  setValue(v: string): this;
  getValue(): string;
  onChange(cb: (v: string) => void): this;
  setDisabled(d: boolean): this;
}
```

### CommandSpec

```ts
export interface CommandSpec {
  /** Unique within the extension. */
  id: string;
  name: string;
  /** `Ctrl+Shift+N`, `Alt+F2`. A shortcut needs Ctrl or Alt; Ctrl+K belongs to the command palette. */
  hotkey?: string;
  callback: () => void | Promise<void>;
}
```

### DialogInput

```ts
export interface DialogInput {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}
```

### DropdownComponent

```ts
export interface DropdownComponent {
  readonly selectEl: HTMLSelectElement;
  addOption(value: string, label: string): this;
  addOptions(options: Record<string, string>): this;
  setValue(v: string): this;
  getValue(): string;
  onChange(cb: (v: string) => void): this;
}
```

### EventRef

```ts
/** Something that can be switched off again (an event subscription, a watcher). */
export interface EventRef {
  off(): void;
}
```

### ExtensionManifestInfo

```ts
/** What `manifest.json` said, as the loader read it. */
export interface ExtensionManifestInfo {
  id: string;
  name: string;
  version: string;
  minAppVersion?: string;
  apiVersion?: string;
  description?: string;
  author?: string;
  [key: string]: unknown;
}
```

### ExtensionSummary

```ts
export interface ExtensionSummary {
  id: string;
  name: string;
  version: string;
  /** The other extension's own `api` property, if it exposes one. */
  api: unknown;
}
```

### ExtraButtonComponent

```ts
/** A small square button beside the other controls: a symbol or a short word, and a tooltip. */
export interface ExtraButtonComponent {
  readonly extraSettingsEl: HTMLButtonElement;
  setIcon(text: string): this;
  setTooltip(t: string): this;
  setDisabled(d: boolean): this;
  onClick(cb: () => void): this;
}
```

### FolderActionOptions

```ts
export interface FolderActionOptions extends Placement {
  label: string;
  icon?: string;
  when?: (folder: LibraryFolder) => boolean;
  run: (folder: LibraryFolder) => void | Promise<void>;
}
```

### Handle

```ts
/** Something you added and can remove again. */
export interface Handle {
  remove(): void;
}
```

### LineStream

```ts
/** A stream of lines from a program. Lines that arrived before `on` was called are replayed first. */
export interface LineStream {
  on(cb: (line: string) => void): Stoppable;
  /** Everything received so far (the last 5000 lines), joined by newlines. */
  text(): string;
}
```

### MatchRowActionOptions

```ts
export interface MatchRowActionOptions extends Placement {
  label: string;
  icon?: string;
  when?: (matchId: string) => boolean;
  run: (matchId: string) => void | Promise<void>;
}
```

### Mountable

```ts
/** UI is either `mount(el)` (any framework; return a cleanup or give `unmount`) or a React `component`. */
export interface Mountable {
  mount?: (el: HTMLElement) => void | (() => void);
  unmount?: (el: HTMLElement) => void;
  component?: ComponentType<Record<string, unknown>>;
}
```

### PanelOptions

```ts
export interface PanelOptions extends Placement, Mountable {
  title?: string;
}
```

### Placement

```ts
export interface Placement {
  /** Unique within the extension. */
  id: string;
  /** Lower first; ties by id. */
  order?: number;
}
```

### ProcessHandle

```ts
export interface ProcessHandle {
  readonly id: number;
  readonly stdout: LineStream;
  readonly stderr: LineStream;
  /** The exit code once it ended, otherwise undefined. */
  exitCode: number | null | undefined;
  readonly exited: boolean;
  /** Text for the program's standard input (add "\n" yourself). */
  write(text: string): Promise<void>;
  /** The program sees end of input. */
  closeStdin(): Promise<void>;
  kill(): Promise<boolean>;
  /** Resolves with the exit code after the last output line was delivered. */
  wait(): Promise<number | null>;
}
```

### ReplayActionOptions

```ts
export interface ReplayActionOptions extends Placement {
  label: string;
  icon?: string;
  slot?: "chip" | "primary" | "secondary";
  when?: (replay: LibraryReplay) => boolean;
  run: (replay: LibraryReplay) => void | Promise<void>;
}
```

### ReplayBadgeOptions

```ts
export interface ReplayBadgeOptions extends Placement {
  /** Short text for a chip on the tile, or null for none. */
  render: (replay: LibraryReplay) => string | null;
}
```

### RequestUrlOptions

```ts
export interface RequestUrlOptions {
  url: string;
  /** Default GET. */
  method?: string;
  headers?: Record<string, string>;
  /** A string, bytes, or any JSON value (sent as JSON with a Content-Type unless you set one). */
  body?: string | ArrayBuffer | Uint8Array | Record<string, unknown> | unknown[] | null;
  timeoutMs?: number;
  /** Only for 127.0.0.1, localhost and ::1. */
  allowSelfSigned?: boolean;
  /** Throw on a status of 400 or more (default true, like Obsidian). */
  throw?: boolean;
}
```

### RequestUrlResponse

```ts
export interface RequestUrlResponse {
  status: number;
  /** Lower-case names. */
  headers: Record<string, string>;
  text: string;
  /** The text parsed as JSON (throws if it is not JSON). */
  readonly json: any;
  readonly bytes: Uint8Array;
  /** The final address after redirects, without its query string. */
  url: string;
}
```

### RiotResponse

```ts
export interface RiotResponse {
  status: number;
  text: string;
  /** The body parsed as JSON (null when empty; throws when it is not JSON). */
  readonly json: any;
}
```

### SliderComponent

```ts
export interface SliderComponent {
  readonly sliderEl: HTMLInputElement;
  setLimits(min: number, max: number, step: number): this;
  setValue(v: number): this;
  getValue(): number;
  onChange(cb: (v: number) => void): this;
}
```

### SpawnOptions

```ts
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** No console window (default true). */
  hidden?: boolean;
  /** Keep running when the extension unloads or SOUP exits (default false). */
  detached?: boolean;
}
```

### Stoppable

```ts
export interface Stoppable {
  off(): void;
}
```

### TabOptions

```ts
export interface TabOptions extends Placement, Mountable {
  label: string;
  /** A lucide icon name (docs/05-ui.md lists them); default a puzzle piece. */
  icon?: string;
  keepMounted?: boolean;
}
```

### TextComponent

```ts
export interface TextComponent {
  readonly inputEl: HTMLInputElement | HTMLTextAreaElement;
  setValue(v: string): this;
  getValue(): string;
  setPlaceholder(p: string): this;
  onChange(cb: (v: string) => void): this;
  setDisabled(d: boolean): this;
}
```

### ToggleComponent

```ts
export interface ToggleComponent {
  readonly el: HTMLButtonElement;
  setValue(v: boolean): this;
  getValue(): boolean;
  onChange(cb: (v: boolean) => void): this;
  setDisabled(d: boolean): this;
}
```

### ToolbarActionOptions

```ts
export interface ToolbarActionOptions extends Placement {
  label: string;
  icon?: string;
  run: () => void | Promise<void>;
}
```

## Data types

### ClientEvent

```ts
// ---------------------------------------------------------------- data types (generated from SOUP's Rust types)
/**
 * A frame from the client's event socket: `[8, "OnJsonApiEvent", { "uri", "eventType", "data" }]`.
 */
export type ClientEvent = { uri: string, eventType: string | null, data: unknown, };
```

### ConnectionState

```ts
/**
 * What the UI shows in the header and what `get_connection` returns.
 */
export type ConnectionState = { connected: boolean, playerName: string | null, region: string | null, 
/**
 * The signed-in account's PUUID: what a profile is bound to (Settings > Profiles). Never logged.
 */
puuid: string | null, 
/**
 * True when the region came from the running client (for example Tournament Realm), not from
 * the user's choice.
 */
autoDetected: boolean, };
```

### FsEntry

```ts
export type FsEntry = { name: string, path: string, isDir: boolean, size: number, 
/**
 * Milliseconds since 1970 (0 when unknown).
 */
modifiedMs: number, };
```

### FsStat

```ts
export type FsStat = { exists: boolean, isDir: boolean, isFile: boolean, size: number, modifiedMs: number, };
```

### Identity

```ts
/**
 * The signed-in account, from what the connection watcher already knows.
 */
export type Identity = { name: string, tag: string | null, puuid: string, region: string, shard: string, };
```

### LibraryAgent

```ts
/**
 * One agent on a replay's roster, cached on the tile so the grid never opens a
 * file. `characterId` keys the valorant-api icon on the frontend.
 */
export type LibraryAgent = { 
/**
 * Riot content GUID; keys the valorant-api icon.
 */
characterId: string, 
/**
 * `Blue`, `Red` or empty.
 */
team: string, 
/**
 * The player's Riot ID game name.
 */
name: string | null, };
```

### LibraryFolder

```ts
export type LibraryFolder = { id: string, name: string, parentId: string | null, 
/**
 * Hex tint for the card swatch; `None` is the default accent.
 */
color: string | null, pinned: boolean, 
/**
 * Manual drag-reorder position (used by the "custom" sort).
 */
sortIndex: number, 
/**
 * Epoch ms.
 */
createdAt: number, };
```

### LibraryReplay

```ts
/**
 * A replay card as the UI sees it: the catalog row with absolute file paths and derived flags.
 */
export type LibraryReplay = { id: string, folderId: string | null, name: string, matchId: string | null, mode: string | null, 
/**
 * Display name.
 */
map: string | null, 
/**
 * `/Game/Maps/Ascent/Ascent`; keys valorant-api art.
 */
mapUrl: string | null, 
/**
 * Client patch; drives the injection compatibility check.
 */
gameVersion: string | null, 
/**
 * `13 - 7`.
 */
score: string | null, agents: Array<LibraryAgent>, hasVrf: boolean, hasJson: boolean, 
/**
 * Absolute path to the `.vrf` on disk (`None` until added).
 */
vrfPath: string | null, 
/**
 * Absolute path to the match `.json` on disk.
 */
jsonPath: string | null, sizeBytes: number, 
/**
 * Epoch ms when it was added to the library.
 */
importedAt: number, 
/**
 * Epoch ms when the match was played.
 */
startedAt: number | null, 
/**
 * Epoch ms; `None` until the first "View in Client".
 */
lastPlayedAt: number | null, pinned: boolean, sortIndex: number, };
```

### ProfileInfo

```ts
/**
 * One profile as the UI sees it.
 */
export type ProfileInfo = { id: string, name: string, kind: ProfileKind, color: string, icon: string | null, createdAt: string, updatedAt: string, riotBinding: RiotBinding | null, active: boolean, 
/**
 * `profile.json` could not be read: listed so it can be seen and removed, never used.
 */
damaged: boolean, 
/**
 * Where this profile's replays are saved (its library is `<this>\Library`).
 */
saveDirectory: string, };
```

### ProfileKind

```ts
export type ProfileKind = "personal" | "team";
```

### RawSession

```ts
/**
 * The session as Riot's remote services want it. Handing this to an extension is the point of the call; it is never logged
 * (the tokens are registered with the log redactor when the session is made, and no line here carries them).
 */
export type RawSession = { accessToken: string, entitlementsToken: string, puuid: string, clientVersion: string, clientPlatform: string, region: string, shard: string, };
```

### RiotBinding

```ts
/**
 * A profile bound to a Riot account (PROFILES_PLAN section 7).
 */
export type RiotBinding = { puuid: string, 
/**
 * `Name#TAG` as it was shown when the binding was made.
 */
name: string, 
/**
 * Switch to this profile when that account signs in, without asking.
 */
autoSwitch: boolean, };
```

### WatchEvent

```ts
export type WatchEvent = { "kind": "created", path: string, } | { "kind": "modified", path: string, } | { "kind": "removed", path: string, };
```
