// The arithmetic of Session Tracker: the session window, win/loss from a match file, rating sums, the header text. `npm run check:logic`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMatch, chipText, parseTiers, parseUpdates, sessionStart, signed, startOfDay, tierLabel, totals, type SessionMatch } from "../examples/session-tracker/src/logic.ts";

const ME = "me-puuid";
const details = (over: { blueWon?: boolean; redWon?: boolean; blue?: number; red?: number; myTeam?: string } = {}) => ({
  matchInfo: { mapId: "/Game/Maps/Port/Port", gameStartMillis: 1000 },
  players: [
    { subject: ME, teamId: over.myTeam ?? "Blue", stats: { kills: 21, deaths: 14, assists: 5 } },
    { subject: "other", teamId: "Red", stats: { kills: 3, deaths: 3, assists: 3 } },
  ],
  teams: [
    { teamId: "Blue", won: over.blueWon ?? true, roundsWon: over.blue ?? 13 },
    { teamId: "Red", won: over.redWon ?? false, roundsWon: over.red ?? 8 },
  ],
});
const summary = { matchId: "m1", mode: "Competitive", startMillis: 999 };

test("a win, from the point of view of the signed-in account (whichever team it was on)", () => {
  const w = buildMatch(details(), ME, summary);
  assert.deepEqual([w.result, w.score, w.kills, w.deaths, w.assists, w.map], ["win", "13-8", 21, 14, 5, "Icebox"]);
  // The same file, seen from a Red player: that is a loss, and the score is theirs first.
  const l = buildMatch(details({ myTeam: "Red" }), ME, summary);
  assert.deepEqual([l.result, l.score], ["loss", "8-13"]);
});

test("a draw has no winner; a file without you is unknown, never a guess", () => {
  assert.equal(buildMatch(details({ blueWon: false, redWon: false, blue: 12, red: 12 }), ME, summary).result, "draw");
  const unknown = buildMatch(details(), "someone-else", summary);
  assert.deepEqual([unknown.result, unknown.score, unknown.kills], ["unknown", "", null]);
  assert.equal(buildMatch({}, ME, summary).result, "unknown");
});

test("the rating change is joined from the competitive update", () => {
  const m = buildMatch(details(), ME, summary, { matchId: "m1", mapUrl: "", startedAt: 1, tierAfter: 12, rrAfter: 40, rrEarned: 17 });
  assert.equal(m.rr, 17);
  assert.equal(buildMatch(details(), ME, summary).rr, null);
});

test("competitive updates are read, filtered and sorted newest first", () => {
  const u = parseUpdates({
    Matches: [
      { MatchID: "a", MapID: "/Game/Maps/Port/Port", MatchStartTime: 100, TierAfterUpdate: 12, RankedRatingAfterUpdate: 40, RankedRatingEarned: 17 },
      { MatchID: "b", MatchStartTime: 300, TierAfterUpdate: 12, RankedRatingAfterUpdate: 57, RankedRatingEarned: -9 },
      { MatchID: "broken", MatchStartTime: 200 },
      null,
    ],
  });
  assert.deepEqual(u.map((x) => x.matchId), ["b", "a"]);
  assert.deepEqual(parseUpdates(null), []);
  assert.deepEqual(parseUpdates({ Matches: "nope" }), []);
});

test("totals add up what is known and say whether any rating change was", () => {
  const m = (result: SessionMatch["result"], rr: number | null): SessionMatch => ({ matchId: "x", startedAt: 1, map: "", mode: "", result, score: "", kills: null, deaths: null, assists: null, rr });
  const t = totals([m("win", 20), m("win", 18), m("loss", -15), m("draw", 0), m("unknown", null), m("win", null)]);
  assert.deepEqual(t, { games: 6, wins: 3, losses: 1, draws: 1, rr: 23, hasRr: true });
  assert.deepEqual(totals([m("win", null)]), { games: 1, wins: 1, losses: 0, draws: 0, rr: 0, hasRr: false });
});

test("the header text", () => {
  const base = { games: 7, wins: 5, losses: 2, draws: 0, rr: 42, hasRr: true };
  assert.equal(chipText("today", base), "Today 5W 2L +42 RR");
  assert.equal(chipText("reset", { ...base, rr: -12 }), "Session 5W 2L -12 RR");
  assert.equal(chipText("today", { ...base, hasRr: false }), "Today 5W 2L");
  assert.equal(chipText("today", { ...base, draws: 1 }), "Today 5W 2L 1D +42 RR");
  assert.equal(chipText("today", { games: 0, wins: 0, losses: 0, draws: 0, rr: 0, hasRr: false }), "Today 0W 0L");
  assert.equal(signed(0), "0");
});

test("a session starts at the beginning of today, local time, or at a later reset", () => {
  const noon = new Date(2026, 10, 1, 12, 30).getTime();
  const midnight = new Date(2026, 10, 1, 0, 0).getTime();
  assert.equal(startOfDay(noon), midnight);
  assert.deepEqual(sessionStart(noon, null), { at: midnight, kind: "today" });
  assert.deepEqual(sessionStart(noon, midnight - 1000), { at: midnight, kind: "today" }, "a reset from yesterday does not shorten today");
  const nine = new Date(2026, 10, 1, 21, 0).getTime();
  assert.deepEqual(sessionStart(noon + 9 * 3_600_000, nine), { at: nine, kind: "reset" });
});

test("tier names come from the last episode; unknown and unused tiers have plain labels", () => {
  const names = parseTiers({
    data: [
      { tiers: [{ tier: 3, tierName: "IRON 1" }] },
      { tiers: [{ tier: 0, tierName: "UNRANKED" }, { tier: 1, tierName: "UNUSED1" }, { tier: 12, tierName: "GOLD 1" }, { tier: 24, tierName: "RADIANT" }] },
    ],
  });
  assert.equal(tierLabel(12, names), "Gold 1");
  assert.equal(tierLabel(24, names), "Radiant");
  assert.equal(tierLabel(0, names), "Unranked");
  assert.equal(tierLabel(1, names), "Unranked");
  assert.equal(tierLabel(17, names), "Rank 17");
  assert.equal(tierLabel(2, []), "Unranked");
  assert.deepEqual(parseTiers(null), []);
});
