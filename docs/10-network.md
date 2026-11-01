# 10. The network: requestUrl

A web page cannot call most websites (CORS) and cannot accept certificates it does not know. `app.requestUrl` makes the request from SOUP's side, in Rust, so neither is a problem. It is modelled on Obsidian's `requestUrl`.

```ts snippet
// GET
const res = await app.requestUrl("https://api.github.com/repos/zachleolewis/SOUP-Tools-Extensions");
app.log.info(`${res.status} ${res.json.full_name}`);

// POST JSON (an object body is sent as JSON with a Content-Type)
const created = await app.requestUrl({ url: "https://example.com/api/notes", method: "POST", body: { text: "hello" }, headers: { Authorization: "Bearer abc" } });

// Bytes in and out
const png = await app.requestUrl("https://example.com/logo.png");
await app.fs.write(`${app.paths.dataDir}/logo.png`, png.bytes);
```

## Options

| Option | |
|---|---|
| `url` | `http` or `https` only |
| `method` | Default `GET` |
| `headers` | An object. SOUP adds `User-Agent: SOUP/<version> (extension <id>)` unless you set one |
| `body` | A string, bytes (`Uint8Array`, `ArrayBuffer`), or any JSON value (sent as JSON) |
| `timeoutMs` | Default 30 000, at most 600 000 |
| `allowSelfSigned` | Accept a self-signed certificate. **Only** for `127.0.0.1`, `localhost` and `::1` (a helper program of your own listening on this PC); anything else is refused |
| `throw` | Throw on a status of 400 or more (default `true`, like Obsidian). Pass `false` to look at the status yourself |

## The answer

| | |
|---|---|
| `status` | The HTTP status |
| `headers` | Lower-case names; repeated headers are joined with `, ` |
| `text` | The body as text |
| `json` | The text parsed as JSON (throws if it is not JSON) |
| `bytes` | The body as a `Uint8Array` |
| `url` | The final address after redirects, without its query string |

## Errors

```ts snippet
import { RequestError } from "soup";

try {
  await app.requestUrl("https://example.com/missing");
} catch (e) {
  if (e instanceof RequestError) {
    app.log.warn(`server said ${e.status}: ${e.response.text.slice(0, 100)}`);
  } else {
    // A SOUP error: e.code is "request_failed" (could not connect, timed out, answer too large) or "invalid_input" (a bad address or method).
    app.log.warn(String(e));
  }
}
```

- A response larger than 256 MB is an error.
- Redirects are followed (up to 10).
- There are no cookies: each request stands alone.
- The query string is never written to SOUP's log. The line for a request says `[ext-<id>] requests GET https://host/path`.

## Good manners

- Say in your README which hosts you contact and why.
- Never send a person's data (their PUUID, their replays, their tokens) to a server without saying so first and letting them choose.
- Cache. Check `res.headers["etag"]` or save the time of the last fetch in `saveData`.
- Handle being offline: a network error is a normal thing, not a crash.

[`examples/heatmap/src/mapdata.ts`](../examples/heatmap/src/mapdata.ts) is all four in one file: it fetches valorant-api.com with `requestUrl`, keeps the answer in a JSON file in the extension's data folder for a week, uses an older copy when the network is down, and only reports an error when it has nothing at all.

## WebSockets and other protocols

`requestUrl` is HTTP(S) only. For anything else (a WebSocket, a raw socket), use the browser's `WebSocket` for `wss://` servers that allow it, or run a [helper program](11-files-and-processes.md#helper-programs) that does the networking and talks to your extension over standard input and output.
