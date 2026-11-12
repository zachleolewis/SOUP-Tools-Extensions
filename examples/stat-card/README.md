# Stat Card

A Boards card that shows one number from a column of the data it is given: the total, average, highest or lowest. It is the smallest useful card, written to be copied. The guide to cards is [docs/20-cards.md](../../docs/20-cards.md).

## What it does

- **Adds one card** to Boards' add menu, in the group **Tables and numbers**, named **Stat**.
- **Settings** (drawn by Boards from the card's `optionSpecs`): the number column, the measure (Total, Average, Highest, Lowest) and the decimals.
- **A new card picks the first number column** of its data (`autoOptions`).
- **Without a column** the card says so and has an **Open card settings** button.
- **Looks like SOUP**: its colours are the theme's CSS variables, so a custom palette recolours it.

## What it accesses

| | |
|---|---|
| Files | None. |
| Network | None. |
| Riot | None. |
| SOUP modules | Boards (`requiresModules`). |

## Settings

The card's settings live in the board file, per card, and are edited in the card's settings panel in Boards. The extension has no settings page of its own.

## How it is built

1. [`src/logic.ts`](src/logic.ts): picking a number column and measuring it. Plain functions, tested in [`tests/stat-card.test.ts`](../../tests/stat-card.test.ts).
2. [`src/main.tsx`](src/main.tsx): the card definition and the one `registerCard` call.

Build it from the repository root with `npm run build:example -- examples/stat-card`, then install `dist/stat-card` in SOUP with **Settings > Extensions > From a folder**, open a board and add **Stat** from the add menu.
