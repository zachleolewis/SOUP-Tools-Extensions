// The part of the Stat Card that needs no SOUP: turning a column of a frame into one number. `npm run check:logic` tests it.

export type Measure = "total" | "average" | "highest" | "lowest";

export const MEASURES: [Measure, string][] = [
  ["total", "Total"],
  ["average", "Average"],
  ["highest", "Highest"],
  ["lowest", "Lowest"],
];

export interface Frame {
  columns: string[];
  rows: unknown[][];
}

/** Whether the first filled cell of column `at` is a number (what a "number column" means here). */
export function isNumberColumn(frame: Frame, at: number): boolean {
  return typeof frame.rows.find((r) => r[at] !== null && r[at] !== undefined)?.[at] === "number";
}

/** The first number column's name, or null: what a new card starts with. */
export function firstNumberColumn(frame: Frame): string | null {
  return frame.columns.find((_, i) => isNumberColumn(frame, i)) ?? null;
}

/** The measure of a column over every row; null when the column is missing or has no numbers. Cells that are not numbers are skipped. */
export function measure(frame: Frame, column: string | null, how: Measure): number | null {
  const at = column === null ? -1 : frame.columns.indexOf(column);
  if (at < 0) return null;
  const values = frame.rows.map((r) => r[at]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  if (how === "total") return values.reduce((a, b) => a + b, 0);
  if (how === "average") return values.reduce((a, b) => a + b, 0) / values.length;
  return how === "highest" ? Math.max(...values) : Math.min(...values);
}

/** A number with a fixed count of decimals, and a plain dash when there is none. */
export function show(value: number | null, decimals: number): string {
  return value === null ? "-" : value.toFixed(decimals);
}
