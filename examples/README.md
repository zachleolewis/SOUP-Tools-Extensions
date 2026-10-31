# Examples

Complete extensions. Build one with `npm run build:example -- examples/<name>` (or all with `npm run build:examples`); the result is in `dist/<name>/`. In SOUP: Settings > Extensions > From a folder (or link it with the Developer switch).

| Example | Shows |
|---|---|
| [`hello-world`](hello-world/src/main.tsx) | A tab written in React, a stylesheet, the signed-in player, an `api` for other extensions |
| [`scrim-notes`](scrim-notes/src/main.ts) | A tab, a settings section, a Library action and badge, a command with a shortcut, an event, saved data per profile, status text |
| [`match-exporter`](match-exporter/src/main.ts) | A Library folder action: the Library module's API, a save dialog, `app.fs.write` |
| [`riot-party-tools`](riot-party-tools/src/main.ts) | `app.riot.remote` and `onLocalEvent` (read only). Read [guide 9](../docs/09-riot.md) first |
| [`team-roster`](team-roster/src/main.ts) and [`roster-consumer`](roster-consumer/src/main.ts) | Two extensions working together: a public `api`, an event, `dependencies` |
| [`helper-process`](helper-process/src/main.ts) | Starting a program, talking to it over standard input and output |

Each example is checked in CI: it type-checks against `types/soup.d.ts` and builds.
