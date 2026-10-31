# 14. Testing and debugging

## The development loop

1. **Settings > Extensions**: turn **Restricted mode** off and **Developer** on.
2. Build: `npm run build` (or `npm run dev`, which rebuilds on every save).
3. **Link a working folder** and choose your `dist/` folder. SOUP installs the extension from it, marks it **DEV**, and from then on checks the folder once a second. When a file in it changes, SOUP copies the folder over its installed copy and reloads the extension. A broken `manifest.json` or a missing `main.js` is not loaded (a WARN line in the log says why) and the working copy keeps running.
4. A **Reload from folder** button on the row does the same on demand. Turning the extension off and on reloads it too.

The extension's row shows its state (Running, Error with the message, Blocked with the reason), the text you set with `addStatusText`, and, for a linked folder, the folder and the last lines of its log.

A linked extension is a normal installed extension in every other way: it is on or off per profile, and **Remove** uninstalls it (your working folder is not touched).

## Logs

```ts snippet
app.log.debug("detail");
app.log.info("something happened", { id: 3 }); // an object after the message is added as JSON
app.log.warn("odd");
app.log.error("broke", { stack: new Error().stack });
```

Lines go into SOUP's log as `[ext-<your id>]`. Open the debug console with **Ctrl+Shift+D**: the **Logs** tab streams the log (search for `ext-`); the **Extensions** tab lists every installed extension with its state, load time and error, the programs and windows running, and the last raw Riot calls. `console.log` goes to the web page's own console, which a release build of SOUP does not show: use `app.log`.

Debug-level lines appear only when the log level allows it (debug console > Modules > Log level).

SOUP's own lines about your extension (`dev-demo reloaded from its working folder`, `onload failed`) are under the `extensions` module.

## Common errors

| What you see | Why |
|---|---|
| The row says "Restricted mode is on" | Turn Restricted mode off (Settings > Extensions) |
| The row says SOUP is too old, or the API version does not fit | The manifest asks for more than this SOUP offers: lower `minAppVersion` or widen `apiVersion` if you really support it |
| The row names a module (for example the Library) | A module in `requiresModules` is off. Turn it on in SOUP's settings |
| The row names another extension | A dependency is missing, off, in Error or the wrong version |
| `Error: onload failed: ...` | Your code threw in `onload`; the message and stack are on the row. Everything you had added is removed |
| `SOUP did not provide soup (globalThis.__soup.soup)` | The extension was not built with `soup-externals.mjs`, so it tries to import `soup` as a real module. Build with the template |
| A tab shows the error text instead of your view | `mount` threw |
| `client_not_running` | You called `app.riot.*` while the Riot Client is closed. Handle it ([Riot](09-riot.md)) |
| `invalid_input`, `fs_failed`, `request_failed`, `process_failed` | A bad argument, a failed file operation, request or program start. The error's `detail` says more |
| It works linked but not installed from GitHub | Your release is missing a file: check that `manifest.json` and `main.js` (or `extension.zip`) are attached and the tag equals `version` |

## Safe start

If an extension makes SOUP unusable, hold **Shift** while SOUP starts: no extension loads that session (the Settings page says so). Then turn the extension off or remove it. Or turn Restricted mode on.

## Testing without SOUP

`main.js` needs SOUP to run. To test logic on its own, keep it in plain functions that take what they need as arguments (the examples export `toCsv` and `csvField` for this) and test those with any test runner.

## Testing a release

Install it the way your users will: **From GitHub** on a SOUP that does not have it, **From a zip** with `extension.zip`. Then update: bump the version, tag, wait for the release, and use **Check for updates** on the row; try **Roll back** as well.
