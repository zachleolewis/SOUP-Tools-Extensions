# SOUP Extensions

Extensions add tabs, tools and automations to [SOUP](https://github.com/zachleolewis/SOUP-Tools-Releases), the Valorant match and replay tool. This repository has everything you need to write one: the documentation, the typings (`types/soup.d.ts`), a starter template and working examples.

> **Read this first.** An extension is code written by someone else that runs inside SOUP with the same access SOUP has. SOUP does **not** review, sandbox or limit extensions. An enabled extension can read and change your files, contact any website, start programs, and use your Riot account through the Riot Client, including actions Riot may ban accounts for. Install only extensions from people you trust. What an extension does is the responsibility of the person who wrote it and the person who installed it. [More in docs/17-responsibility.md](docs/17-responsibility.md).

## For people who install extensions

1. In SOUP open **Settings > Extensions**. **Restricted mode** is on: no extension code runs.
2. Install: **From GitHub** (`owner/name` of a repository with a release), **From a zip**, or **From a folder**. SOUP shows what it is about to install, with the warning above, before it installs anything.
3. Turn Restricted mode off (SOUP asks you to confirm the warning), then turn the extension on. Extensions are switched on or off per SOUP profile.
4. Something wrong? Hold **Shift** while SOUP starts: no extension loads that session. Or turn Restricted mode back on.

SOUP writes one log line for everything an extension does through SOUP (`[ext-<id>]` in the log, visible in the debug console with Ctrl+Shift+D). It cannot see what an extension does on its own.

## For people who write extensions

An extension is `manifest.json`, `main.js` and, if it has styles, `styles.css`. You write TypeScript against the typings, build it with the template, and publish it as a GitHub release.

```ts
import { Notice, Plugin } from "soup";

export default class HelloExtension extends Plugin {
  async onload() {
    this.addCommand({ id: "hello", name: "Say hello", callback: () => void new Notice("Hello from my extension") });
  }
}
```

### Quick start (about five minutes)

You need [Node.js](https://nodejs.org) 20 or newer and SOUP 2.3 or newer.

```
git clone https://github.com/zachleolewis/SOUP-Tools-Extensions
cd SOUP-Tools-Extensions/template
npm install
npm run build
```

`dist/` now holds a working extension (`manifest.json`, `main.js`). In SOUP: **Settings > Extensions**, turn **Restricted mode** off, turn **Developer** on, press **Link a working folder** and choose `dist/`. Open the command palette with **Ctrl+K** and run "My Extension: say hello". Edit `src/main.ts`, run `npm run build` again (or leave `npm run dev` running) and SOUP reloads the extension by itself.

To try a finished extension instead, build an example from the repository root:

```
npm install
npm run build:example -- examples/scrim-notes
```

`dist/scrim-notes/` is ready to install in SOUP ("From a folder"). All examples: `npm run build:examples`.

The full walkthrough is [docs/01-getting-started.md](docs/01-getting-started.md).

## What is here

| Folder | What |
|---|---|
| [`docs/`](docs/) | 18 short guides, from getting started to responsibility. [`docs/api/`](docs/api/README.md) is the reference generated from the typings |
| [`types/soup.d.ts`](types/soup.d.ts) | The typings for `import ... from "soup"`. Every TypeScript block in the docs is checked against this file in CI |
| [`template/`](template/) | A starter project: Vite and TypeScript, `soup` and React provided by SOUP, and a GitHub Action that builds a release when you push a tag |
| [`examples/`](examples/) | Finished extensions you can install and copy: `scrim-notes` (more are coming in the same folder) |

## Stability

The extension API has a version (`apiVersion`, currently 1.x). Additions are minor versions. A breaking change is a new major version, and the previous major keeps working for at least one SOUP release. Anything that is not in `types/soup.d.ts` (SOUP's screens, its CSS classes, its internals) is not part of the API and can change at any time. [docs/16-stability-and-versioning.md](docs/16-stability-and-versioning.md)

## Contributing

The typings are generated from SOUP's source and written into this repository on each SOUP release; do not edit `types/soup.d.ts` or `docs/api/` by hand. Fixes to the docs and the examples are welcome as pull requests. `npm run check` must pass.

Licence: MIT.
