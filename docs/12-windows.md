# 12. Windows

`app.ui.openWindow` opens a separate window for a page of your own: a dashboard on a second monitor, an overlay-style panel, a chart.

```ts snippet
const win = await app.ui.openWindow({
  url: "panel.html", // a file in your extension's folder (or an https address)
  title: "My dashboard",
  width: 480,
  height: 320,
  alwaysOnTop: false,
});
app.log.info(`opened ${win.label}`);
// later
await win.close();
```

## The page

`url` is either

- a **file of your extension** such as `panel.html` or `ui/index.html?mode=compact` (put it in `static/` in the template and the build copies it next to `main.js`), served from `http://soupext.localhost/<your id>/...`; or
- an `https://` address.

The page is an ordinary web page. It can load your other files (`panel.js`, images, CSS) from the same folder with relative paths.

## What the window can and cannot do

- It has **no access to SOUP's commands**: it is not SOUP's window, and SOUP gives it no permissions. `window.__TAURI__`-style calls are refused.
- It does not share JavaScript with your extension's `main.js` (they are different pages). To talk between them, use something both can reach:
  - the address: pass what the page needs in the query string or the hash (`panel.html?player=Ada`),
  - a small local server run by a [helper program](11-files-and-processes.md#helper-programs), reached with `fetch("http://127.0.0.1:PORT/...")` from the page and `app.requestUrl` from the extension,
  - files: the page reads a JSON file your extension writes in a folder you both know (your extension can serve it too: `http://soupext.localhost/<id>/state.json` is any file in your extension's folder).
- It closes when your extension unloads, and `win.close()` closes it earlier.

## Always on top

`alwaysOnTop: true` keeps the window above others, including VALORANT in windowed mode. SOUP does not stop an extension from doing this. Whether a window over the game is allowed is up to the game's rules, not SOUP's; see [guide 17](17-responsibility.md).

## Logged

`[ext-<id>] opens a window: http://soupext.localhost/<id>/panel.html` (the query string is not logged).
