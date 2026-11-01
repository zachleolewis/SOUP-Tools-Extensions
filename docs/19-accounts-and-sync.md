# 19. Accounts, secrets, transfers and backups

What an extension needs to sign in to a web service (Google Drive, Dropbox, your own server), keep the token safe, move large files and back up SOUP's settings. Declare `"accounts"` in your manifest's [`uses`](03-manifest.md) when you call `app.auth` or `app.secrets`, and `"network"` for `app.net`. They are statements, not permissions; the person installing the extension sees them.

Like everything else, these work only while Restricted mode is off and the extension is on in the profile ([guide 17](17-responsibility.md)).

## Signing in: `app.auth.oauthPkce`

SOUP does the sign-in the way [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) says a desktop app should: it opens the **system browser** on the service's authorization address, waits for the redirect on a one-shot listener on `127.0.0.1` (a random port, closed after one answer), checks `state`, and exchanges the code at the token address with **PKCE** (S256). The extension never sees the code, only the result.

```ts snippet
const t = await app.auth.oauthPkce({
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: "1234-example.apps.googleusercontent.com",
  clientSecret: "not-really-secret", // a desktop client's "secret" is public by design; PKCE is the protection
  scopes: ["https://www.googleapis.com/auth/drive.file", "openid", "email"],
  extraParams: { access_type: "offline", prompt: "consent" },
});
app.log.info(`signed in, token expires ${new Date(t.expiresAt).toISOString()}`);
```

It resolves with `{ accessToken, refreshToken?, expiresAt, scope, idToken?, extra }`. `expiresAt` is epoch milliseconds. `extra` has **every other query parameter of the redirect**, which is how a service hands back more than a code (Google's Picker returns `picked_file_ids` this way).

Rules:

- `authorizeUrl` and `tokenUrl` must be **https**. A user name or password in the address is refused.
- SOUP sets `response_type`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge` and `code_challenge_method` itself; `extraParams` cannot set them. Anything else in `extraParams` goes onto the authorization address.
- The sign-in waits **5 minutes** at most (`timeoutMs` can shorten it). A page that shows "You can close this tab and return to SOUP" answers the browser.
- Requests to the listener that are not the redirect (a favicon) or carry a wrong `state` are answered and ignored; they do not end the sign-in.

Errors have a `code`: `auth_denied` (the person or the service said no), `auth_timeout`, `auth_cancelled`, `auth_failed` (the token address refused; `detail` says why, never with a token in it), `invalid_input` (a bad address).

### Cancelling

Pass an `AbortSignal`; aborting while the browser is open ends the wait and rejects with `auth_cancelled`. SOUP also cancels a pending sign-in when the extension unloads.

```ts snippet
import { Notice } from "soup";

const controller = new AbortController();
new Notice("Signing in... check your browser");
const cancelButton = document.createElement("button");
cancelButton.onclick = () => controller.abort();
try {
  await app.auth.oauthPkce({ authorizeUrl: "https://example.com/auth", tokenUrl: "https://example.com/token", clientId: "abc", scopes: ["read"], signal: controller.signal });
} catch (e) {
  if ((e as { code?: string }).code === "auth_cancelled") return;
  throw e;
}
```

### Refreshing

```ts snippet
const fresh = await app.auth.refresh({
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: "1234-example.apps.googleusercontent.com",
  clientSecret: "not-really-secret",
  refreshToken: (await app.secrets.get("refresh-token")) ?? "",
});
// Most services send a new access token only: keep the refresh token you have.
const refreshToken = fresh.refreshToken ?? (await app.secrets.get("refresh-token"));
```

A refresh token that was revoked fails with `auth_failed`; ask the person to sign in again.

## Keeping the token: `app.secrets`

Small secrets (a refresh token, an API key) go in **Windows Credential Manager**, under `SOUP/ext/<your id>/<key>`, not in `saveData` and never in a profile export. They belong to the Windows user, are the same in every SOUP profile, and are deleted when the extension is removed together with its data.

```ts snippet
await app.secrets.set("refresh-token", "1//0g-example");
const token = await app.secrets.get("refresh-token"); // null when there is none
await app.secrets.delete("refresh-token"); // true when there was one
```

A key is 1 to 128 letters, digits, `.`, `-` and `_`. A value is at most **8 KB**; a longer one is `too_large`. Another extension cannot ask for yours through the API (every call carries your id), but this is the user's own account on their PC: SOUP is not a vault against other software that runs as them.

## Big files: `app.net.upload` and `app.net.download`

`requestUrl` holds a whole answer in memory and stops at 256 MB. For replays use `app.net`: SOUP streams between the file and the network, so nothing is held whole in memory and there is no 256 MB cap.

```ts snippet
// Resumable upload in 256 KiB chunks (what Google Drive's resumable protocol wants): offset and length pick the slice.
const file = `${app.paths.dataDir}/replay.vrf`;
const total = (await app.fs.stat(file)).size;
const session = "https://example.com/upload/session-1";
const step = 262144 * 8;
for (let offset = 0; offset < total; offset += step) {
  const length = Math.min(step, total - offset);
  const res = await app.net.upload({
    url: session,
    method: "PUT",
    file,
    offset,
    length,
    headers: { "Content-Range": `bytes ${offset}-${offset + length - 1}/${total}` },
    onProgress: (p) => app.log.debug(`${offset + p.done} of ${total}`),
  });
  if (res.status === 200 || res.status === 201) break; // complete
  if (res.status !== 308) throw new Error(`upload failed: ${res.status} ${res.text.slice(0, 100)}`);
}
```

`upload({ url, method?, headers?, file, offset?, length?, timeoutMs?, onProgress? })` resolves `{ status, headers, text }`. **The status is a value, not an error**: a resumable upload answers `308` until it is complete. `method` defaults to `PUT`. `file` is a path (a relative one starts in your data folder); the slice must lie inside the file. `onProgress` gets `{ done, total }` for the slice.

```ts snippet
const got = await app.net.download({
  url: "https://example.com/files/replay.vrf",
  headers: { Authorization: "Bearer abc" },
  to: `${app.paths.dataDir}/downloads/replay.vrf`,
  maxBytes: 2 * 1024 * 1024 * 1024,
  onProgress: (p) => app.log.debug(`${p.done} of ${p.total ?? "?"}`),
});
if (got.status !== 200) app.log.warn(`download refused: ${got.status} ${got.errorText ?? ""}`);
else app.log.info(`${got.size} bytes in ${got.path}`);
```

`download({ url, method?, headers?, to, maxBytes?, timeoutMs?, onProgress? })` resolves `{ status, headers, size, path, errorText }`.

- The file is written next to `to` as `<to>.soup-part` and renamed when it is complete, so a failure leaves nothing half written (and the old file is kept). An existing file is replaced.
- A status that is not 2xx writes **nothing** and gives `errorText` (the start of the answer, up to 16 KB). A `Range` header gets a `206` and writes just that slice.
- `maxBytes` defaults to 4 GiB and cannot exceed 100 GiB; a larger answer is `transfer_failed`.
- Both calls give up when no byte moves for 2 minutes, and after `timeoutMs` in all (default 30 minutes, at most 6 hours).
- Any path is allowed, like [`app.fs`](11-files-and-processes.md); the log says when a download writes outside your own folders.

Errors: `invalid_input` (a bad address, a slice outside the file, `to` is a folder), `transfer_failed` (could not connect, cut off, too large, disk error).

The log has the method, host and path, and the size, never the query string or a header.

## Backing up SOUP's settings: `app.profiles`

```ts snippet
const path = await app.profiles.exportTo("backup/active.soupprofile"); // the ACTIVE profile; relative paths start in dataDir
const preview = await app.profiles.previewImport(path); // what importing would do; nothing is created
app.log.info(`${preview.name}: ${preview.modulesOn.length} modules on, ${preview.dropped.length} settings left out`);
const made = await app.profiles.importFrom(path, { name: "Restored from backup" });
```

This is the same `.soupprofile` as Settings > Profiles > Export: settings, theme, which extensions the profile uses, with the paths of this PC left out. `importFrom` makes a **new** profile (nothing is overwritten and no extension is installed); the person switches to it when they want. Secrets are never in the file.

## Writing to the Library: `app.library`

```ts snippet
const folder = await app.library.createFolder("Backups restored");
const { imported, skipped } = await app.library.importFiles([`${app.paths.dataDir}/downloads/replay.vrf`, `${app.paths.dataDir}/downloads/replay.json`], folder.id);
// Files are paired like Library > Import pairs them: a .vrf with its match .json, attached to the card of the same match when there is one.
app.log.info(`${imported} added, ${skipped.length} skipped`);
```

`importFiles(paths, folderId?)`, `createFolder(name, parentId?, color?)`, `renameReplay(id, name)`, `moveItem("replay" | "folder", id, folderId | null)` and `deleteReplay(id)` (to the Library's trash: the files go to `.trash`, nothing is erased). They use the Library module's own logic, so the grid, the 3D viewer and other extensions (`app.library.onChanged`) see the change. Each one is logged.

## Good manners

- Ask for the narrowest scope the service has (`drive.file` rather than all of Drive).
- Say in your README which service you sign in to, which files you send, and where the token is kept.
- Show who is signed in and give the person a **Sign out** that deletes the secret (and revokes the token at the service).
- Never write a token to `saveData`, a file or the log. SOUP never logs one; your own `app.log` lines are yours to keep clean.
- Back off when the service says so (`429`, `Retry-After`), and keep going after a failed chunk instead of starting over.
