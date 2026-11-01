# 13. Working with other extensions

Extensions can offer things to each other, in the way Obsidian plugins do: the provider exposes a public `api` property, and the consumer asks SOUP for the provider's instance.

## The provider

Give your `Plugin` a property named `api` and document it. This is the whole offer:

```ts
import { Plugin } from "soup";

export interface NotesApi {
  notesFor(matchId: string): string[];
  add(matchId: string, text: string): Promise<void>;
}

/** The payload of the `scrim-notes/changed` event. */
export interface NotesChanged {
  matchId: string;
  count: number;
}

export default class ScrimNotes extends Plugin {
  private notes: Record<string, string[]> = {};

  api: NotesApi = {
    notesFor: (matchId) => [...(this.notes[matchId] ?? [])],
    add: async (matchId, text) => {
      (this.notes[matchId] ??= []).push(text);
      await this.saveData({ notes: this.notes });
      // Tell listeners. The event name must start with this extension's id and a slash.
      this.app.events.emit("scrim-notes/changed", { matchId, count: this.notes[matchId].length } satisfies NotesChanged);
    },
  };

  async onload() {
    this.notes = (await this.loadData<{ notes?: Record<string, string[]> }>()).notes ?? {};
  }
}
```

Treat `api` like any public API: add to it, do not change what exists in a way that breaks callers, and bump your version (`^1.0` ranges in other manifests will keep matching minor versions). The real [`scrim-notes`](../examples/scrim-notes/src/main.tsx) does this with notes that have rounds and tags.

## The consumer

```ts
import { Plugin } from "soup";

// The provider's documented interface, copied into this project.
interface NotesApi {
  notesFor(matchId: string): string[];
}

export default class Heatmap extends Plugin {
  async onload() {
    const notes = (this.app.extensions.get("scrim-notes") as unknown as { api: NotesApi } | undefined)?.api;
    if (!notes) {
      this.app.log.info("scrim-notes is not installed: no links to notes"); // an optional dependency: carry on without it
      return;
    }
    this.app.log.info(`${notes.notesFor("some-match-id").length} notes on that match`);
    this.registerEvent(this.app.events.on("scrim-notes/changed", (e: { matchId: string; count: number }) => this.app.log.info(`${e.matchId} has ${e.count} notes`)));
  }
}
```

(Copy the provider's interface into your own project, as above, or publish it as a small types file next to the provider's releases. There is no shared package.) A consumer that cannot work without the provider throws instead of returning, and lists it under `dependencies` (next section).
## Declare the dependency

In the consumer's manifest:

```json
{
  "dependencies": { "scrim-notes": "^1.0" },
  "optionalDependencies": { "other-thing": "^2.0" }
}
```

- `dependencies`: the provider must be installed, on, and in that version range. SOUP loads it **first** and waits for its `onload` to finish, and does not load your extension without it (the row says "needs scrim-notes" or why). If the provider is turned off, your extension is unloaded and shown as blocked, with the reason on its row.
- `optionalDependencies`: if the extension is there it loads first, and `app.extensions.get` finds it; if not, yours loads anyway. Always check for `undefined`.
- Two extensions that depend on each other, directly or through others, are a cycle: both are marked Error.
- When the provider is updated or reloaded, extensions that depend on it are reloaded too, so the instance you hold is always the live one.

## What `app.extensions` offers

| | |
|---|---|
| `get(id)` | The loaded `Plugin` instance of another extension, or `undefined` |
| `isEnabled(id)` | Whether it is loaded |
| `list()` | `{ id, name, version, api }` of every loaded extension |

## A walkthrough

[`scrim-notes`](../examples/scrim-notes/src/main.tsx) is the provider: its `api` is declared in the class as `api: ScrimNotesApi` and offers `notesFor(matchId)`, `open(matchId)` and `exportMarkdown(path)`. [`heatmap`](../examples/heatmap/src/ui.tsx) is the consumer, and an optional one: its manifest says `"optionalDependencies": { "scrim-notes": "^1.0" }`, so SOUP loads Scrim Notes first when it is installed and on, and `notesApi()` there is `app.extensions.get("scrim-notes")?.api` with a copy of the interface it needs. Build both (`npm run build:examples`), install `dist/scrim-notes` and `dist/heatmap` ("From a folder"), turn them on, add a note to a replay from the Library, and open the Heatmap tab: that match has a **Notes 1** button that opens the note. Turn Scrim Notes off in Settings: Heatmap reloads without the button and keeps working, which is what "optional" means.

## Limits

Extensions cannot add new extension points for other extensions to use. Share data through `api` and events.
