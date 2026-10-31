# 16. Stability and versioning

## The API version

The extension API has its own version, `apiVersion` (`import { apiVersion } from "soup"`). Your manifest says which versions you support (`"apiVersion": "^1.0"`); SOUP loads your extension only if its API version is in that range.

| Change | Version |
|---|---|
| A new method, option, event or field | Minor (1.1, 1.2...) |
| A fix that does not change what code can rely on | Patch |
| A removal, or a change of behaviour that can break an extension | **Major** (2.0). The previous major keeps working for at least one SOUP release, and an extension that uses it shows "Built for an older SOUP API" on its row |

So `^1.0` is safe: everything you wrote against 1.0 keeps working on 1.x.

## What counts as the API

**Public (stable within a major version):**

- everything in `types/soup.d.ts`: `Plugin` and its methods, `Notice`, `Modal`, `Setting`, `SettingTab`, `RequestError`, `debounce`, `normalizePath`, `apiVersion`, `Platform`, and the whole `App` object with its namespaces (`app.fs`, `app.riot`, ...);
- the events listed in [guide 7](07-events.md) and their payload fields;
- the calls listed in [guide 8](08-modules.md) for SOUP's built-in modules;
- `manifest.json` and its fields;
- the layout of a release (the files, the tag rule).

**Not public (can change in any release):**

- SOUP's screens, layout, CSS class names and design tokens' exact values (the token *names* in guide 5 are kept);
- the props of the components in `app.ui.react.kit`;
- anything not in `soup.d.ts`: SOUP's source, its Tauri commands, the shapes of files SOUP writes, the Riot Client's own API (Riot changes that without notice);
- the exact wording of log lines and error messages (error `code`s are stable);
- the order in which independent extensions load.

Reaching around the API (poking at SOUP's DOM, calling its internals) works until it does not. If you need something that is not in the API, open an issue in this repository.

## How the typings are made

`types/soup.d.ts` is generated from SOUP's source on each SOUP release, and checked against SOUP's implementation before it is published: the build fails if `app` has a method the typings do not describe, or the other way round. The data types in it (`LibraryReplay`, `ProfileInfo`...) are written out from SOUP's Rust types, so they match what SOUP sends. Run `npm run update-types` in your project to get the newest.

## When SOUP changes

- Keep `minAppVersion` honest: use the oldest SOUP you tested.
- Read the release notes of this repository when the major version changes.
- A new SOUP never breaks an extension for a reason on the not-public list *on purpose*, but it can; test after updates.
