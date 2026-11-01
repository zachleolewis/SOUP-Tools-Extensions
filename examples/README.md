# Examples

Four finished extensions, the kind a team would install: each is useful on its own, looks like SOUP, and teaches a different part of the API. Copy whatever you need; the source is commented the way the guides teach.

| Example | What it does | What it teaches |
|---|---|---|
| [`scrim-notes`](scrim-notes) | Notes on any match: per round, tagged, searchable, exported to Markdown | A React UI with SOUP's kit, data saved per profile, the Library (action and badge), the Matches tab, a command with a shortcut, a settings section, an `api` for other extensions ([guide 5](../docs/05-ui.md), [6](../docs/06-settings-and-data.md)) |

Build one with `npm run build:example -- examples/<name>` (or all of them with `npm run build:examples`); the result is in `dist/<name>/`. In SOUP: **Settings > Extensions > From a folder**, pick `dist/<name>`. Each example's README says what it touches (files, network, Riot) and how its source is laid out.

CI type-checks each example against `types/soup.d.ts`, builds it, and runs the logic tests in [`tests/`](../tests). SOUP's own self-test installs all four from `dist/` and drives them with real clicks and typing.
