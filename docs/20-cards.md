# 20. Boards cards

An extension can add a card to Boards: a chart, a table or a number that appears in the add menu next to SOUP's own and works the same way on a board. A card is one definition handed to `registerCard`. This guide covers what a card is, what it is given, how its settings work, how it looks and what is checked. [`examples/stat-card`](../examples/stat-card) is a finished card you can copy; the types are in [the API reference](api/README.md#boardsapi).

Cards need the **Boards** module. Put `"requiresModules": ["boards"]` in your manifest ([guide 3](03-manifest.md)) so SOUP does not load the extension while Boards is off ([guide 8](08-modules.md)).

## What a card is

A card is a way to draw one table of values. It is general on purpose: a bar chart draws any two columns, and the person picks the data and the columns. The table is a `DataFrame`:

```ts snippet
// What every source, filter and card in Boards speaks.
const frame = { columns: ["Player", "Rounds"], rows: [["Aster", 210], ["Brook", 188]] };
app.log.info(`${frame.columns.length} columns, ${frame.rows.length} rows`);
```

`columns` are the names and each row is an array in the same order. Cells are `unknown`: check a cell's type before you use it.

## Registering a card

```ts snippet
import type { BoardsApi, CardDefinition } from "soup";

const card = {} as CardDefinition; // stands in for your definition, described below
const boards = app.modules.get<BoardsApi>("boards");
if (!boards) return; // the Boards module is not there
plugin.register(boards.registerCard(card));
```

`app.modules.get<BoardsApi>("boards")` is `undefined` when the module is off, so always check. `registerCard` returns a function that removes the card; pass it to `this.register(...)` in your `Plugin` and the card goes when the extension unloads.

`registerCardView` is the earlier shape (settings version 0, group `Other`, match data). It is deprecated and kept until it is removed: use `registerCard`.

## The definition

| Field | What |
|---|---|
| `id` | Stable, and namespaced with your extension's id by convention: `my-extension.chart`. Letters, digits and hyphens, a dot, then letters, digits, hyphens and dots (no underscores or spaces) |
| `label`, `description` | The name and the one line shown in the add menu |
| `icon` | A component that takes `{ className?: string }` and draws an icon at the size the class gives: a lucide icon or your own SVG |
| `group` | The add menu's group, fixed by SOUP: `Rounds`, `Duels`, `Economy`, `Maps`, `Players`, `Compare`, `Tables and numbers` or `Other` |
| `needs` | `{ tier: "match" }` for the saved match data every game has, or `{ tier: "replay" }` for decoded replays (greyed in the add menu until some exist) |
| `version`, `migrations` | The version of the card's settings, and the steps that bring old ones up to date (see below) |
| `defaultOptions` | The settings a new card starts with |
| `optionSpecs` | The settings the panel shows, in order (see below) |
| `defaultSize` | The size a new card starts at in pixels; a small card is about 240 x 160 |
| `component` | The React component that draws the card |
| `docs` | Optional: the card's help page as Markdown, shown from the add menu |
| `sample` | Optional: a tiny `DataFrame` the add menu's preview draws |
| `autoOptions`, `initialOptions` | Optional: sensible settings for new data, and the settings a new card starts with, kept in its board file |
| `statSlots`, `moveStats` | Optional: for a card that draws a set number of stats (a bar takes 1 to 4, a radar 3 to 8) |
| `echarts` | Optional: chart types and components from the ECharts copy SOUP itself draws with, loaded before the card's first chart. A card that bundles its own chart library does not set it |

## What the component is given

Boards renders `component` with these props (`CardViewProps<O>`):

| Prop | What |
|---|---|
| `frame` | The source's table after the board's filters and every incoming selection |
| `options` | The card's settings, an `O` |
| `setOptions(patch)` | Change some settings |
| `selected` | The card's own selection (to highlight), or `null` |
| `select(selection)` | Publish a selection to the cards wired to this one; an empty `values` clears it |
| `openSettings()` | Open the card's settings panel, for a "Pick ..." button in the card's own messages |
| `highlight` | Selections from wires set to Highlight: the frame keeps every row and the card emphasises the rows that match. Empty when no wire highlights. A card that cannot highlight shows all rows as usual |

A selection (`CardSelection`) is `{ field, values, labels? }`: the column it is about, the chosen values, and what to call each value on screen (a player's name for their PUUID key). The card that publishes a selection is never filtered by it.

Show a message, with a button to `openSettings`, when the card has nothing to draw yet (no column picked). Do not draw an empty chart.

## Settings

A card never builds its own settings panel. It describes each setting as data in `optionSpecs` and Boards draws the panel the same way for every card.

```ts snippet
import type { CardOptionSpec } from "soup";

const optionSpecs = [
  { key: "column", label: "Column", type: "column", kind: "number", auto: true },
  { key: "decimals", label: "Decimals", type: "number", min: 0, max: 3, step: 1, section: "Style" },
] satisfies CardOptionSpec[];
```

Every spec has a `key` (the name in `options`) and a `label`, and may have a `hint`, a `section` (`Show`, the default, or `Style`; any other name is a sub-heading under Show), a `group`, `half` (half the panel's width), `advanced`, `auto`, `when(options)` (shown only while it holds) and `problem(options)` (the reason a value cannot be used, in plain words, or `null`). The `type` picks the control:

| `type` | Control |
|---|---|
| `column` | One column of the card's data; `kind` limits it to `number`, `text`, `boolean` or `any`; `allowNone` lets it be empty |
| `columns` | Several columns |
| `select` | A choice from `choices: [value, label][]` |
| `number`, `range`, `bound` | A number (`bound` may be left empty for automatic and is then stored as `null`) |
| `boolean`, `text`, `color` | A switch, a text field, a colour |
| `custom` | The card draws this setting itself with `render` |

### Changing the settings later

`version` is the version the card's settings are written at, and a card stores the version its settings were saved at. When you rename or reshape a setting, raise `version` by one and add `migrations[n]`, which turns settings of version `n` into version `n + 1`. A migration runs once when a card is read.

```ts snippet
import type { CardDefinition } from "soup";

const migrations: CardDefinition["migrations"] = {
  // version 1 renamed "digits" to "decimals"
  0: ({ digits, ...rest }) => (digits === undefined ? rest : { ...rest, decimals: digits }),
};
```

A card starts at `version: 0` with no migrations.

## How a card looks

- Fill the box Boards gives the component; the card's size is the board's and the person can change it. A new card starts at `defaultSize`. Boards' own card box has a minimum of 200 x 140 pixels, so draw correctly down to that.
- The theme is a set of CSS variables on `<html>`: `background: hsl(var(--forest-900))`, `color: hsl(var(--forest-300))`. A card styled with them follows the person's palette ([guide 5](05-ui.md#looking-like-soup)). SOUP's CSS class names are not API: do not rely on them, and style the card with inline styles or your own `styles.css`.
- Keep text short and plain; no emoji.

## What is checked

`registerCard` throws an `Error` naming the card when:

- the `id` is not `<namespace>.<name>` in the characters above;
- the `id` is already registered;
- `version` is not a whole number of 0 or more;
- a migration is missing for any step below `version`, or a migration sits at or past `version`;
- `group` is not one of the groups above;
- `needs.tier` is not `match` or `replay`.

Catch this at development time: it means the definition is wrong, not that the data is.

## A small worked example

A card that shows the total of one number column:

```tsx
import { Plugin, type BoardsApi, type CardDefinition, type CardViewProps } from "soup";

interface Options {
  column: string | null;
}

function Icon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3h10L8 8l5 5H3" />
    </svg>
  );
}

function Total({ frame, options, openSettings }: CardViewProps<Options>) {
  const at = options.column ? frame.columns.indexOf(options.column) : -1;
  if (at < 0) return <button onClick={openSettings}>Choose the column to add up</button>;
  const total = frame.rows.reduce((sum, row) => sum + (typeof row[at] === "number" ? row[at] : 0), 0);
  return <p style={{ color: "hsl(var(--forest-300))", fontSize: 40 }}>{total}</p>;
}

const card: CardDefinition<Options> = {
  id: "my-extension.total",
  label: "Total",
  icon: Icon,
  description: "The total of one number column",
  group: "Tables and numbers",
  needs: { tier: "match" },
  version: 0,
  defaultOptions: { column: null },
  optionSpecs: [{ key: "column", label: "Column", type: "column", kind: "number", auto: true }],
  defaultSize: { width: 240, height: 160 },
  component: Total,
};

export default class MyExtension extends Plugin {
  onload() {
    const boards = this.app.modules.get<BoardsApi>("boards");
    if (boards) this.register(boards.registerCard(card));
  }
}
```

[`examples/stat-card`](../examples/stat-card) is the same idea with a measure to pick, decimals, a help page, a sample for the add menu and its logic in a file of its own that the tests cover.

## Next

- [The API reference](api/README.md#boardsapi): every field above, as typed.
- [Guide 5](05-ui.md): the theme and the look of SOUP.
- [Guide 16](16-stability-and-versioning.md): what may change.
