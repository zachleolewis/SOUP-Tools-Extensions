# 7. Events

SOUP announces what happens with events. Subscribe with `app.events.on(name, callback)`. It returns a reference with `off()`; hand it to `registerEvent` and the subscription ends when your extension unloads.

```ts
import { Plugin } from "soup";

export default class Listener extends Plugin {
  async onload() {
    this.registerEvent(
      this.app.events.on("library/changed", (change: { reason: string; replayIds: string[]; folderIds: string[] }) => {
        this.app.log.info(`library: ${change.reason}, ${change.replayIds.length} replays`);
      }),
    );
  }
}
```

The callback's payload is typed `any` in `types/soup.d.ts`; the shapes below are what SOUP sends.

## Events SOUP sends

| Event | Payload | When |
|---|---|---|
| `library/changed` | `{ reason, replayIds, folderIds }` | Something in the Library was added, changed, moved or removed |
| `match-capture/auto-saved` | `{ matchId, name, replaySaved, replayStatus }` | SOUP saved a finished match by itself |
| `match-capture/live-changed` | `{ status, map, mode }` | The live match state changed |
| `riot-client/connection-changed` | `ConnectionState` | The Riot Client connected, disconnected, or the signed-in account changed |
| `riot-client/region-changed` | `{ region, autoDetected }` | The region SOUP uses changed |
| `custom-games/settings-changed` | `{ snapshot, changes }` | The custom game lobby's settings changed |
| `share/progress` | `{ op, stage, done, total }` | A share or download is running |
| `view-in-client/state` | `{ phase, message }` | A replay is being put into VALORANT |
| `replay-viewer-3d/process-progress` | `{ replayId, status }` | A 3D replay is being prepared |
| `asset-patches/activity` | object | The 3D asset patches changed |
| `core/profile-switching` | `{ from, to }` | A profile switch is starting |
| `core/profile-changed` | `{ profile, restartModules }` | A profile switch happened (the window reloads right after) |
| `core/profiles-changed` | the profile list | A profile was created, changed or removed |
| `core/modules-changed` | the module list | A built-in module was turned on or off |
| `extensions/state-changed` | `{ reason }` | An extension was installed, updated, turned on or off |
| `core/log` | a log record | Only while the debug console is open |

Event names and payloads are part of the API for events listed here; new events and new payload fields can appear in a minor version.

## Convenience wrappers

```ts snippet
app.library.onChanged((c) => app.log.debug(`library changed: ${JSON.stringify(c)}`));
app.riot.onConnectionChanged((c) => app.log.debug(c.connected ? `connected as ${c.playerName}` : "disconnected"));
app.profiles.onChange((p) => app.log.debug(`switching to ${p.name}`));
```

Each returns an `EventRef` (`off()`).

## Your own events

An extension can announce things to other extensions. The event name must start with your extension's id and a slash:

```ts snippet
// In the provider:
app.events.emit("scrim-notes/changed", { matchId: "3f2a9c1e", count: 2 });

// In a consumer:
const ref = app.events.on("scrim-notes/changed", (e: { matchId: string; count: number }) => app.log.debug(`${e.matchId}: ${e.count} notes`));
plugin.registerEvent(ref);
```

Emitting a name that does not start with `<your id>/` throws. Events stay inside SOUP's window; they are not sent anywhere.

[`examples/auto-organizer`](../examples/auto-organizer/src/main.tsx) reacts to `match-capture/auto-saved`: the payload names the match, and it finds the replay in the Library and files it. Events can be sent by hand while you develop (the self-test does it), so you never have to play a match to try a handler.

## Notes

- Events can arrive in bursts (`library/changed` after an import). Debounce your reaction (`debounce` from `soup`).
- Catch errors inside your listeners: a listener that throws is logged, but do not count on SOUP to keep going in every case.
- `core/profile-changed` is followed by a reload of SOUP's window, so your extension will be unloaded right after.
