# 8. SOUP's modules

SOUP's features are modules. An extension can call a module the same way SOUP's own screens do, with `app.modules.get("<id>")`. It returns the module's frontend API object, or `undefined` when the module is off (the person can turn modules off).

```ts snippet
const library = app.modules.get<{ list(): Promise<{ replays: unknown[] }> }>("library");
if (!library) {
  app.log.warn("the Library module is off");
  return;
}
const snapshot = await library.list();
app.log.info(`${snapshot.replays.length} replays`);
```

`app.modules.isEnabled("library")` answers without fetching the API. List the modules you need in the manifest's `requiresModules` and SOUP will not load your extension while one is off.

> **Typing.** `app.modules.get` returns the type you give it: `types/soup.d.ts` does not describe each module's API object, because those objects change with SOUP's screens. The tables below show the calls that exist today; declare the part you use as an interface (as above) and check it after SOUP updates. Module APIs listed here are part of the extension API for as long as `apiVersion` is `1.x`: a breaking change to one of them bumps the major version or keeps a compatible wrapper.

`app.library` and `app.matches` are shortcuts for the two most used.

## library

Replays and folders on disk, per profile.

| Call | What |
|---|---|
| `list()` | `{ root, folders, replays }` (`LibraryFolder[]`, `LibraryReplay[]`) |
| `getRoot()` | The Library folder of the active profile |
| `onChanged(cb)` | `library/changed` |
| `createFolder(name, parentId, color)`, `updateFolder(id, name, color)`, `deleteFolder(id)` | Folders |
| `renameReplay(id, name)`, `deleteReplay(id)`, `moveItem(kind, id, folderId)`, `setPinned(kind, id, pinned)`, `reorder(kind, orderedIds)` | Replays and ordering (`kind` is `"replay"` or `"folder"`) |
| `revealPath(path)`, `openRoot()` | Show in Explorer |

## match-capture

Match history and live state, through the Riot Client.

| Call | What |
|---|---|
| `history()` | The recent matches, newest first |
| `details(matchId)` | Full details of one match (cached) |
| `liveState()` | `{ status, map, mode }` of the match being played |
| `saveReplay(matchId, mode, startMillis, folderId?)`, `saveMatchJson(...)` | Save into the Library |
| `onLiveChanged(cb)`, `onAutoSaved(cb)` | Events |

## riot-client

| Call | What |
|---|---|
| `getConnection(force?)` | `{ connected, playerName, region, puuid, autoDetected }` |
| `onConnectionChanged(cb)` | Event |
| `setRegion(region)` | Change the region SOUP uses (this is a setting of the person's profile; ask first) |

For anything the Riot Client can do, use `app.riot` instead ([guide 9](09-riot.md)).

## custom-games, share, view-in-client, replay-parser, asset-patches, replay-viewer-3d

| Module | Calls |
|---|---|
| `custom-games` | `refresh(prev)`, `gamePods()`, `toggleTracker(on)`, `apply(settings)`, `sendPartyChat(message)`, `onSettingsChanged(cb)` |
| `share` | `share({ folderId?, replayIds? })`, `shareFile(path)`, `downloadFile(url)`, `importLink(url)` |
| `view-in-client` | `listHosts(replayId)`, `start(replayId, hostMatchId)`, `stop()`, `pendingSwap()`, `restorePending()`, `onState(cb)` |
| `replay-parser` | `builds(paths)` |
| `asset-patches` | `status()`, `catalog()`, `plan(versions)`, ... |
| `replay-viewer-3d` | `status()`, `process(replayId, vrfPath)`, `processStatus(replayId)`, `open(replayId)`, `onProgress(cb)` |

Some of these change what the person sees or what happens in their VALORANT client (`custom-games.apply`, `view-in-client.start`). Calling them from an extension is allowed, and it is your responsibility; see [guide 17](17-responsibility.md).

## Modules that are not there

The 3D modules (`asset-patches`, `replay-viewer-3d`) exist only in builds that include them. Always handle `undefined`.
