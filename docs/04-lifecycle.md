# 4. Lifecycle

An extension is one class that extends `Plugin`. SOUP creates one instance, calls `onload()`, and calls `onunload()` when the extension is turned off.

```ts
import { Plugin } from "soup";

export default class Lifecycle extends Plugin {
  async onload() {
    this.app.log.info("loaded");
  }

  onunload() {
    this.app.log.info("unloading");
  }
}
```

## When it loads

SOUP loads an extension when all of this is true:

1. **Restricted mode** is off and this session was not started with Shift held.
2. The extension is **on** in the active profile.
3. Its `minAppVersion` and `apiVersion` fit this SOUP.
4. Every module in `requiresModules` is on.
5. Every extension in `dependencies` is installed, on, in range, and itself loaded.

Extensions load in dependency order: your dependencies are loaded, and their `onload` has finished, before yours starts. Two extensions that depend on each other (a cycle) are both marked Error. An extension that is blocked shows the reason on its row in Settings.

## What loads it

`main.js` is imported as an ES module from SOUP's own address for the extension (`http://soupext.localhost/<id>/main.js`). The default export must be a class that extends `Plugin`. `styles.css`, if there is one, is added to the page while the extension runs and removed with it.

## When it unloads

The extension unloads when it is turned off, removed or updated, when Restricted mode is turned on, when the person switches to a profile where it is off (the window reloads), and when SOUP exits. In this order:

1. `onunload()`.
2. Everything you registered with `register*`, in reverse order.
3. Everything you added with `add*` (tabs, actions, commands, setting tabs): removed.
4. Your child programs, file watchers, extra windows and Riot event subscriptions: stopped.
5. Your stylesheet: removed.

A throw in one cleanup does not stop the others. **Do not leave things running that SOUP cannot see.** Timers started with `setInterval` must be registered (`this.registerInterval(...)`), listeners on `window` or `document` too (`this.registerDomEvent(...)`).

```ts
import { Plugin } from "soup";

export default class Cleanup extends Plugin {
  async onload() {
    // Removed automatically on unload.
    this.registerInterval(window.setInterval(() => this.app.log.debug("tick"), 5000));
    this.registerDomEvent(window, "resize", () => this.app.log.debug("resized"));
    this.registerEvent(this.app.events.on("library/changed", () => this.app.log.debug("library changed")));

    // Anything else: register a function.
    const socket = new WebSocket("wss://example.com/live");
    this.register(() => socket.close());
  }
}
```

## Errors

If `onload` throws (or rejects), SOUP:

- marks the extension **Error** and shows the message and stack on its row,
- runs the cleanup for what you had registered so far, and removes what you had added,
- writes a WARN line `[ext-<id>] onload failed: ...` to the log,
- carries on: SOUP and the other extensions are not affected. Extensions that depend on yours are blocked.

Errors inside a command, a tab or a setting tab are caught, logged under your id, and shown as a notice. A promise you start and never await is yours to catch: an unhandled rejection is logged but nothing stops it.

## Reloading

Turning the extension off and on reloads it. With the Developer switch on and a [linked working folder](14-testing-and-debugging.md), SOUP reloads it whenever the folder's files change. Each load re-imports `main.js`, so module-level state starts fresh.

## Load time

An extension's load time is shown in the debug console's Extensions tab. Keep `onload` quick: it runs while SOUP starts. Defer slow work (`void this.refresh()` instead of `await this.refresh()`) unless the rest of your `onload` needs the result.
