# My SOUP extension

A starter for a [SOUP](https://github.com/zachleolewis/SOUP-Tools-Extensions) extension: TypeScript, Vite, and a GitHub Action that publishes releases.

```
npm install
npm run build        # dist/manifest.json, dist/main.js (and dist/styles.css if you import CSS)
npm run dev          # rebuilds on every save
npm run typecheck
npm run update-types # fetch the newest types/soup.d.ts
```

## Try it

In SOUP: Settings > Extensions, turn Restricted mode off, turn Developer on, **Link a working folder**, choose `dist/`. Open the command palette (Ctrl+K) and run "My Extension: say hello". Edit `src/main.ts` and rebuild: SOUP reloads the extension.

## Make it yours

1. Edit `manifest.json`: `id` (lowercase letters, digits, dashes), `name`, `description`, `author`, `repo`.
2. Write your code in `src/main.ts` (rename it `src/main.tsx` and change `lib.entry` in `vite.config.ts` to use JSX).
3. Files in `static/` (a page for `app.ui.openWindow`, images, a helper program) are copied into `dist/` as they are. Read them at run time from `this.app.paths.codeDir`.
4. Import CSS (`import "./styles.css"`) and it ends up in `dist/styles.css`.

## Release

Commit, then `git tag v1.0.0 && git push --tags`. `.github/workflows/release.yml` builds the extension and attaches `manifest.json`, `main.js`, `styles.css` and `extension.zip` to a GitHub release. The tag must equal `version` in `manifest.json`. People install it with **Settings > Extensions > From GitHub > owner/name**.

Documentation: the [SOUP extension docs](https://github.com/zachleolewis/SOUP-Tools-Extensions/tree/main/docs). Before you publish, read [Responsibility](https://github.com/zachleolewis/SOUP-Tools-Extensions/blob/main/docs/17-responsibility.md).
