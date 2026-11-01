# 9. Riot access

> **Your users' Riot accounts are at stake.** Riot's rules apply to everything done with an account, whoever wrote the code. Riot may ban accounts for automation, for showing hidden information, or for using its services in ways it does not allow. SOUP does not stop an extension from doing any of that. Read [Riot's policies](https://www.riotgames.com/en/terms-of-service) and the [developer policies](https://developer.riotgames.com/policies/general) before you write an extension that uses `app.riot`, and say plainly in your README what yours does. [Guide 17](17-responsibility.md) lists what users are told.

SOUP is connected to the Riot Client that is running on the PC. `app.riot` gives you that connection.

## Who is signed in

```ts snippet
const me = await app.riot.identity();
if (me) {
  app.log.info(`${me.name}#${me.tag} on ${me.region} (shard ${me.shard})`);
} else {
  app.log.info("no Riot Client, or nobody is signed in");
}

const c = await app.riot.connection(); // { connected, playerName, region, puuid, autoDetected }
app.riot.onConnectionChanged((now) => app.log.info(now.connected ? "connected" : "disconnected"));
```

`identity()` needs no network and never throws; it answers `null` when there is no signed-in account. The PUUID in it is the account's permanent id: it is private information, do not log it or send it anywhere without telling the person.

## Tokens

```ts snippet
const t = await app.riot.tokens();
// { accessToken, entitlementsToken, puuid, clientVersion, clientPlatform, region, shard }
```

These are what Riot's own services use to recognise the account. **Treat them like a password.** SOUP never writes them to its log (it scrubs them if you log them yourself), but anything that receives them can act as the account until they expire (about an hour). Do not store them, do not send them to your own server, do not put them in a URL.

If the Riot Client is not running, `tokens()` rejects with the error code `client_not_running`.

## The Riot Client's local API

```ts snippet
const r = await app.riot.local("GET", "/riotclient/region-locale");
if (r.status === 200) app.log.info(JSON.stringify(r.json));
```

`local(method, path, body?)` calls the Riot Client's own API on this PC. SOUP finds the client and logs in to it for you (the lockfile and the client's certificate are handled). The answer is `{ status, text, json }`; a 404 is a result, not an error.

## Riot's remote services

```ts snippet
const mmr = await app.riot.remote("GET", { service: "pd", path: "/mmr/v1/players/" + (await app.riot.tokens()).puuid });
app.log.info(`status ${mmr.status}`);

// Or a full https address, with a body and extra headers:
await app.riot.remote("POST", { url: "https://example-riot-service.invalid/x" }, { hello: "world" }, { "X-Test": "1" });
```

`remote(method, target, body?, headers?)` adds the account's tokens and the headers Riot expects. `target` is either `{ service, path }` with `service` one of `"pd"`, `"glz"` or `"shared"` (SOUP builds the host from the account's region), or `{ url }` (https only). A body is sent as JSON. The answer is `{ status, text, json }`.

Calls go through SOUP's own request pipeline: a rejected session is renewed once, reads that get a 429 wait and retry, and all extensions share one limiter (two requests at a time, 150 ms between them), so one busy extension cannot starve the others or SOUP itself. Do not poll: ask no more often than you need to, and prefer events.

## Events from the Riot Client

```ts snippet
const sub = await app.riot.onLocalEvent("/parties/v1/parties/", (e) => {
  app.log.debug(`${e.eventType} ${e.uri}`);
  const data = e.data; // the payload Riot sent, as JSON
  void data;
});
plugin.register(() => sub.off());
```

`onLocalEvent(uri, cb)` calls you for every event of the Riot Client whose URI contains `uri` (an empty string means every event). One connection to the client serves SOUP and every extension. It ends with `off()` or when your extension unloads.

## When the Riot Client is not running

Every call except `identity()` fails with an error whose `code` is `client_not_running`. That is a normal state, not a bug:

```ts snippet
try {
  await app.riot.tokens();
} catch (e) {
  const code = (e as { code?: string }).code;
  if (code === "client_not_running") return; // wait for onConnectionChanged
  throw e;
}
```

## An example that stays inside the line

[`examples/session-tracker`](../examples/session-tracker/src/source.ts) is the pattern to copy: it asks only for the signed-in account's own match history and rating changes (`GET` calls through `app.riot.remote`), never looks up other players or anything Riot hides, reads when something happened and at most every two minutes, never while a match is being played, and treats a missing Riot Client as a normal state (the header says `Not signed in`). Its Riot access is in one file behind a small interface, so everything else can be tested without a Riot Client.

## What SOUP logs

Each call writes one line to SOUP's log under your extension's id, for example `[ext-my-extension] Riot remote call: GET pd /mmr/v1/players/<puuid>`: the method, the service and the path, never the query string, the headers, the body or a token. The debug console's Extensions tab (Ctrl+Shift+D) lists the last 50.

## What SOUP itself will not do

SOUP's own features keep to strict limits (they read, they do not automate the game, they do not show hidden information). Those limits bind SOUP's code, **not extensions**. That is why the responsibility is yours.
