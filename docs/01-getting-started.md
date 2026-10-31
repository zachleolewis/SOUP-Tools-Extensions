# 1. Getting started

This takes you from nothing to an extension running in SOUP, and then to a release other people can install.

## What you need

- SOUP 2.3 or newer (the first version with extensions).
- [Node.js](https://nodejs.org) 20 or newer.
- A text editor. Visual Studio Code gives you autocompletion from `types/soup.d.ts` out of the box.

## 1. Get the template

```
git clone https://github.com/zachleolewis/SOUP-Tools-Extensions
cp -r SOUP-Tools-Extensions/template my-extension
cd my-extension
npm install
```

(On Windows `xcopy /e /i SOUP-Tools-Extensions\template my-extension` does the same. You can also use the folder as a GitHub template for your own repository.)

The template holds:

| File | What it is |
|---|---|
| `manifest.json` | Who the extension is: id, name, version, what SOUP version it needs. [Every field](03-manifest.md) |
| `src/main.ts` | Your code. It exports one class that extends `Plugin` |
| `vite.config.ts`, `soup-externals.mjs` | The build. `soup` and React are not bundled: SOUP provides them, so you use the same React as SOUP |
| `types/soup.d.ts` | The typings. `npm run update-types` fetches the newest |
| `.github/workflows/release.yml` | Builds and publishes a release when you push a tag |

Edit `manifest.json`: change `id` (lowercase letters, digits and dashes), `name`, `description`, `author`, and the `repo` field (your GitHub `owner/name`, or delete it if the extension will not live on GitHub).

## 2. Build it

```
npm run build
```

`dist/` now holds `manifest.json` and `main.js` (and `styles.css` if you import CSS). That folder is the extension.

## 3. Run it in SOUP

1. Open **Settings > Extensions**. Read the warning. Turn **Restricted mode** off and confirm.
2. Turn **Developer** on. A **Link a working folder** button appears.
3. Press it and choose your project's `dist/` folder. SOUP installs the extension, turns it on for the current profile and marks it **DEV**.
4. Open the command palette with **Ctrl+K** and run "My Extension: say hello", or click the new **My Extension** tab.

From now on SOUP checks `dist/` once a second. Run `npm run dev` (it rebuilds on every save) and the extension reloads in SOUP whenever the build changes. The extension's row in Settings shows its last log lines (`this.app.log.info(...)` in your code) and any error from `onload`.

If your extension throws while loading, SOUP marks it **Error**, removes whatever it had added and keeps running; fix the code and rebuild. [Testing and debugging](14-testing-and-debugging.md) has the rest.

## 4. Make it do something

```ts
import { Notice, Plugin } from "soup";

export default class MyExtension extends Plugin {
  async onload() {
    // A tile action on every replay in the Library.
    this.addLibraryReplayAction({
      id: "shout",
      label: "Shout",
      run: (replay) => {
        new Notice(`${replay.name} is a ${replay.mode ?? "mystery"} on ${replay.map ?? "an unknown map"}`);
      },
    });
  }
}
```

[The UI guide](05-ui.md) lists every place you can add something. [The examples](../examples) are complete extensions you can read and copy.

## 5. Publish it

Commit, then tag: `git tag v1.0.0 && git push --tags`. The workflow in `.github/workflows/release.yml` builds the extension and attaches `manifest.json`, `main.js`, `styles.css` and `extension.zip` to a GitHub release. People install it in SOUP with **From GitHub** and your `owner/name`. [Publishing](15-publishing.md) has the rules (the tag must equal `version` in the manifest).

## If something does not work

- Nothing loads at all: Restricted mode is on, or you held Shift when SOUP started.
- "Blocked" on the row: the reason is written there (SOUP too old, a module the extension needs is off, a missing dependency).
- A white box where your tab should be: look at the debug console (Ctrl+Shift+D) and filter the log for `ext-<your id>`.
