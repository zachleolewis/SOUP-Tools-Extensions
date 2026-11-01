// The logic of Scrim Notes that needs no SOUP: reading saved data, searching, Markdown. `npm run check:logic`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyData, mapName, matchKey, normalize, searchMatches, toMarkdown, type NotesData } from "../examples/scrim-notes/src/model.ts";

const sample = (): NotesData => ({
  version: 1,
  settings: { defaultTag: "review", showBadge: true },
  notes: {
    m1: {
      title: "Scrim A",
      map: "Icebox",
      startedAt: Date.UTC(2026, 9, 27, 12),
      entries: [
        { id: "a", round: 7, tag: "bad", text: "Lost mid control", createdAt: 10, updatedAt: 10 },
        { id: "b", tag: "strat", text: "Try B default", createdAt: 20, updatedAt: 30 },
      ],
    },
    m2: { title: "Scrim B", map: "Bind", startedAt: Date.UTC(2026, 9, 28, 12), entries: [{ id: "c", round: 2, tag: "good", text: "Nice retake", createdAt: 40, updatedAt: 40 }] },
  },
});

test("the first run and broken data give an empty, well-formed value", () => {
  assert.deepEqual(normalize({}), emptyData());
  assert.deepEqual(normalize(null), emptyData());
  assert.deepEqual(normalize("nonsense"), emptyData());
});

test("normalize keeps good notes, repairs a bad tag, and drops what cannot be read", () => {
  const data = normalize({
    notes: {
      ok: { title: "T", map: "Bind", startedAt: 5, entries: [{ id: "1", tag: "nope", text: "x", createdAt: 1, round: 3.9 }, { text: "no id" }, null] },
      empty: { title: "E", entries: [] },
      junk: 12,
    },
    settings: { defaultTag: "bad", showBadge: false },
  });
  assert.deepEqual(Object.keys(data.notes), ["ok"]);
  assert.equal(data.notes.ok.entries.length, 1);
  assert.equal(data.notes.ok.entries[0].tag, "other");
  assert.equal(data.notes.ok.entries[0].round, 3);
  assert.equal(data.notes.ok.entries[0].updatedAt, 1);
  assert.deepEqual(data.settings, { defaultTag: "bad", showBadge: false });
});

test("a match is filed under its id, or under its replay id when it has none", () => {
  assert.equal(matchKey({ matchId: "abc", id: "r1" }), "abc");
  assert.equal(matchKey({ matchId: null, id: "r1" }), "replay:r1");
});

test("search matches note text, tag, round, title and map; newest edit first", () => {
  const d = sample();
  assert.deepEqual(searchMatches(d, "", "all"), ["m2", "m1"]);
  assert.deepEqual(searchMatches(d, "mid", "all"), ["m1"]);
  assert.deepEqual(searchMatches(d, "bind", "all"), ["m2"]);
  assert.deepEqual(searchMatches(d, "round 7", "all"), ["m1"]);
  assert.deepEqual(searchMatches(d, "", "good"), ["m2"]);
  assert.deepEqual(searchMatches(d, "retake", "bad"), []);
  assert.deepEqual(searchMatches(d, "nothing like this", "all"), []);
});

test("Markdown has a heading per match, notes by round, and says when there are none", () => {
  const md = toMarkdown(sample(), ["m1", "m2"]);
  assert.match(md, /^# Scrim notes/);
  assert.ok(md.indexOf("## Scrim B - 2026-10-28") < md.indexOf("## Scrim A - 2026-10-27"), "newest match first");
  assert.match(md, /- Try B default|- \[Strat\] Try B default/);
  assert.match(md, /- Round 7: \[Bad\] Lost mid control/);
  assert.match(toMarkdown(sample(), []), /No notes\./);
});

test("a multi-line note stays inside its bullet", () => {
  const d = sample();
  d.notes.m1.entries[0].text = "line one\nline two";
  assert.match(toMarkdown(d, ["m1"]), /\[Bad\] line one\n {2}line two/);
});

test("map names", () => {
  assert.equal(mapName("/Game/Maps/Port/Port"), "Icebox");
  assert.equal(mapName("/Game/Maps/Duality/Duality"), "Bind");
  assert.equal(mapName("/Game/Maps/Mystery/Mystery"), "Mystery");
  assert.equal(mapName(null), "");
});
