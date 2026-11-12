// The logic of the Stat Card that needs no SOUP: picking a number column and measuring it. `npm run check:logic` runs it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { firstNumberColumn, measure, show } from "../examples/stat-card/src/logic.ts";

const frame = {
  columns: ["Player", "Rounds", "Note"],
  rows: [
    ["Aster", 210, null],
    ["Brook", 188, "x"],
    ["Cinder", 240, null],
    ["Dune", 96, null],
  ],
};

test("the first number column is found, text columns are skipped", () => {
  assert.equal(firstNumberColumn(frame), "Rounds");
  assert.equal(firstNumberColumn({ columns: ["A"], rows: [["x"]] }), null);
});

test("each measure", () => {
  assert.equal(measure(frame, "Rounds", "total"), 734);
  assert.equal(measure(frame, "Rounds", "average"), 183.5);
  assert.equal(measure(frame, "Rounds", "highest"), 240);
  assert.equal(measure(frame, "Rounds", "lowest"), 96);
});

test("a missing or text column gives nothing, and non-numbers are skipped", () => {
  assert.equal(measure(frame, null, "total"), null);
  assert.equal(measure(frame, "Nope", "total"), null);
  assert.equal(measure(frame, "Player", "total"), null);
  assert.equal(measure({ columns: ["V"], rows: [[1], [null], ["a"], [3]] }, "V", "average"), 2);
});

test("show rounds to the decimals and dashes an empty value", () => {
  assert.equal(show(183.5, 0), "184");
  assert.equal(show(183.456, 2), "183.46");
  assert.equal(show(null, 1), "-");
});
