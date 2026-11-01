# 2. How SOUP works

Knowing the shape of SOUP makes the rest of the API easy to guess.

## The pieces

```
+----------------------------------------------------------------------------------+
| SOUP window (one web page)                                                       |
|                                                                                  |
|   header  [profile switcher] [Riot connection] [extension header items]          |
|   tabs    Matches | Library | Custom Games | ... | [extension tabs]               |
|   settings sections, Library tiles and toolbars, 3D viewer panels, ...           |
|                          ^ extension points: addTab, addLibraryReplayAction, ...  |
+--------------------------|-------------------------------------------------------+
                           | calls and events
+--------------------------|-------------------------------------------------------+
| SOUP backend (Rust, the same process)                                            |
|   core: config, profiles, log, events, jobs                                      |
|   modules: library | riot-client | match-capture | custom-games | share |        |
|            view-in-client | replay-parser | asset-patches | replay-viewer-3d |   |
|            extensions                                                            |
+----------------------------------------------------------------------------------+
```

- **Core** is the shell: configuration, profiles, the log, the event bus.
- **Modules** are SOUP's own features. Each module has a backend (Rust) and a frontend. A module can be switched off, and a module that is off contributes nothing.
- **Extensions** are modules written by other people. They run in the web page next to SOUP's own code, and reach the backend only through `app` (see [the app object](#the-app-object)).

An extension never touches SOUP's source. It adds things by calling `add*` methods on its `Plugin` (a tab, a Library action, a command...) and SOUP removes them again when the extension unloads.

## Profiles

A profile is a complete setup: which modules and extensions are on, their settings, the Library folder and the theme. People keep a personal profile and one per team. Consequences for you:

- Whether your extension is **on** is per profile.
- `loadData()` and `saveData()` store per profile ([settings and data](06-settings-and-data.md)).
- Switching profile reloads SOUP's window. Your extension unloads (`onunload`) and loads again if it is on in the new profile.

## The app object

`this.app` (inside your `Plugin`) is the one way to reach SOUP:

| `app.` | What |
|---|---|
| `modules` | The built-in modules' own APIs ([guide 8](08-modules.md)) |
| `library`, `matches` | Shortcuts for the Library and match history |
| `riot` | The Riot account and the Riot Client ([guide 9](09-riot.md)) |
| `events` | SOUP's events and your own ([guide 7](07-events.md)) |
| `requestUrl` | HTTP from SOUP's side, no CORS ([guide 10](10-network.md)) |
| `fs`, `process`, `dialog`, `clipboard` | Files, programs, pickers ([guide 11](11-files-and-processes.md)) |
| `ui` | Confirm dialogs, navigation, extra windows, React, theme ([guides 5](05-ui.md) and [12](12-windows.md)) |
| `profiles`, `extensions` | Profiles and other extensions ([guide 13](13-working-with-other-extensions.md)) |
| `paths`, `log` | Folders and the log |

## Extension points

An extension adds to SOUP at fixed places. Each is a method of `Plugin` that returns a handle with `remove()`; everything is removed automatically on unload.

| Method | Where it shows |
|---|---|
| `addTab` | A tab in the navigation |
| `addHeaderItem` | A small item in the header |
| `addActivityBar` | A strip under the navigation on every tab |
| `addMatchesSidebarPanel` | A panel in the match history sidebar |
| `addViewer3dPanel` | A panel in the 3D replay viewer |
| `addSettingTab` | Your extension's settings page, opened from the cog on its row in Settings > Extensions |
| `addLibraryReplayAction`, `addLibraryReplayBadge` | A button and a chip on each replay tile |
| `addLibraryFolderAction`, `addLibraryToolbarAction` | A button on folders and in the Library toolbar |
| `addMatchRowAction` | A button on each match in the history |
| `addCommand` | A command in the palette (Ctrl+K) with an optional shortcut |
| `addStatusText` | Small text on your extension's row in Settings |

Extensions cannot add new extension points for other extensions to use; they share data through `api` objects and events ([guide 13](13-working-with-other-extensions.md)).

## What runs where

Your `main.js` runs in SOUP's web page. Anything slow or privileged (reading a file, a network request, starting a program) goes through `app` to the Rust backend and comes back as a promise. Work that must not block the page belongs in a helper program ([guide 11](11-files-and-processes.md)).
