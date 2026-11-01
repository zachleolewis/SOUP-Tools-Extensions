// The logic of the Heatmap that needs no SOUP: reading match files, projecting a kill onto the minimap, filtering. `npm run check:logic`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { hexToRgb, hslToRgb, isFresh, normalizePrefs, mapChoices, nearest, parseMatch, playerChoices, pointsFor, project, type Filter, type MapInfo } from "../examples/heatmap/src/logic.ts";

const MAP: MapInfo = { uuid: "u", displayName: "Icebox", mapUrl: "/Game/Maps/Port/Port", displayIcon: "x", xMultiplier: 0.000072, yMultiplier: -0.000072, xScalarToAdd: 0.460214, yScalarToAdd: 0.304687 };

const players = [
  { subject: "me", gameName: "Soup", tagLine: "NODLE", teamId: "Blue" },
  { subject: "foe", gameName: "Grace", tagLine: "TEST", teamId: "Red" },
];
const kill = (round: number, killer: string, victim: string, k: [number, number], v: [number, number]) => ({
  round,
  killer,
  victim,
  victimLocation: { x: v[0], y: v[1] },
  playerLocations: [{ subject: killer, location: { x: k[0], y: k[1] } }],
  finishingDamage: { damageItem: "9C82E19D-4575-0200-1A81-3EACF00CF872", damageType: "Weapon" },
  roundTime: 12000,
});
// Round 0: Blue attacks and wins. Round 13: Blue defends and loses.
const roundResults = [
  { roundNum: 0, winningTeam: "Blue", winningTeamRole: "Attacker", playerStats: [] as unknown[] },
  { roundNum: 13, winningTeam: "Red", winningTeamRole: "Attacker", playerStats: [] as unknown[] },
];
const k0 = kill(0, "me", "foe", [-3500, -1800], [-3000, -200]);
const k13 = kill(13, "foe", "me", [-4900, -1900], [-3500, -1800]);
const file = (extra: object = {}) => ({ matchInfo: { matchId: "m1", mapId: "/Game/Maps/Port/Port", gameStartMillis: 5 }, players, roundResults, kills: [k0, k13], ...extra });
const meta = { replayId: "r1", source: "library" as const, name: "Scrim A" };

test("projection is valorant-api's formula: u from y, v from x", () => {
  const { u, v } = project(MAP, -3500, -1800);
  assert.ok(Math.abs(u - (-1800 * 0.000072 + 0.460214)) < 1e-12);
  assert.ok(Math.abs(v - (-3500 * -0.000072 + 0.304687)) < 1e-12);
  assert.ok(u > 0 && u < 1 && v > 0 && v < 1, "inside the picture");
});

test("a file with top-level kills: killer and victim places, sides from the round roles", () => {
  const m = parseMatch(file(), meta)!;
  assert.equal(m.id, "m1");
  assert.equal(m.kills.length, 2);
  const [a, b] = m.kills;
  assert.deepEqual(a.killerAt, { x: -3500, y: -1800 });
  assert.deepEqual(a.victimAt, { x: -3000, y: -200 });
  assert.deepEqual([a.killerSide, a.victimSide], ["attack", "defense"]);
  // Round 13: Red won as Attacker, so Blue (the victim, "me") defended and Red (the killer) attacked.
  assert.deepEqual([b.killerSide, b.victimSide], ["attack", "defense"]);
  assert.equal(a.weapon, "9c82e19d-4575-0200-1a81-3eacf00cf872");
  assert.equal(m.players.me.name, "Soup#NODLE");
});

test("a file with kills only under roundResults is read too, with the round taken from the round", () => {
  const nested = [
    { roundNum: 3, winningTeam: "Blue", winningTeamRole: "Defender", playerStats: [{ kills: [{ killer: "me", victim: "foe", victimLocation: { x: 1, y: 2 }, playerLocations: [{ subject: "me", location: { x: 3, y: 4 } }] }] }] },
  ];
  const m = parseMatch({ ...file({ roundResults: nested }), kills: undefined }, meta)!;
  assert.equal(m.kills.length, 1);
  assert.equal(m.kills[0].round, 3);
  assert.equal(m.kills[0].killerSide, "defense");
  assert.equal(m.kills[0].victimSide, "attack");
});

test("things that are not match files are refused without throwing", () => {
  assert.equal(parseMatch(null, meta), null);
  assert.equal(parseMatch({}, meta), null);
  assert.equal(parseMatch({ matchInfo: { matchId: "x" }, players }, meta), null);
  const m = parseMatch({ matchInfo: { mapId: "/Game/Maps/Port/Port" }, players, kills: [{ killer: 5 }, null, { killer: "me", victim: "foe" }] }, meta)!;
  assert.equal(m.kills.length, 1);
  assert.equal(m.kills[0].killerAt, null);
});

const all: Filter = { mapUrl: null, mode: "both", side: "both", who: "all", replayId: null };

test("filters: mode, player, side, map and replay", () => {
  const m = parseMatch(file(), meta)!;
  assert.equal(pointsFor([m], MAP, all).length, 4);
  assert.equal(pointsFor([m], MAP, { ...all, mode: "kills" }).length, 2);
  assert.equal(pointsFor([m], MAP, { ...all, mode: "deaths" }).length, 2);
  assert.equal(pointsFor([m], MAP, { ...all, who: "me", mode: "kills" }).length, 1);
  assert.equal(pointsFor([m], MAP, { ...all, who: "me" }).length, 2, "my kill and my death");
  // Attack side: round 0 killer (me) attacks; round 13 the killer (foe) attacks.
  assert.equal(pointsFor([m], MAP, { ...all, mode: "kills", side: "attack" }).length, 2);
  assert.equal(pointsFor([m], MAP, { ...all, mode: "kills", side: "defense" }).length, 0);
  assert.equal(pointsFor([m], MAP, { ...all, mapUrl: "/Game/Maps/Duality/Duality" }).length, 0);
  assert.equal(pointsFor([m], MAP, { ...all, replayId: "other" }).length, 0);
  assert.equal(pointsFor([m], MAP, { ...all, replayId: "r1" }).length, 4);
});

test("a kill whose killer's place is not in the file is not drawn as a kill, but its death is", () => {
  const m = parseMatch({ ...file(), kills: [{ ...k0, playerLocations: [] }] }, meta)!;
  assert.equal(pointsFor([m], MAP, { ...all, mode: "kills" }).length, 0);
  assert.equal(pointsFor([m], MAP, { ...all, mode: "deaths" }).length, 1);
});

test("nearest finds the closest point inside the radius", () => {
  const pts = pointsFor([parseMatch(file(), meta)!], MAP, { ...all, mode: "kills" });
  const p = pts[0];
  assert.equal(nearest(pts, p.u + 0.001, p.v, 0.01), p);
  assert.equal(nearest(pts, p.u + 0.2, p.v + 0.2, 0.01), null);
});

test("map and player choices count matches", () => {
  const a = parseMatch(file(), meta)!;
  const b = parseMatch({ ...file(), matchInfo: { matchId: "m2", mapId: "/Game/Maps/Duality/Duality" } }, { ...meta, replayId: "r2" })!;
  const c = parseMatch({ ...file(), matchInfo: { matchId: "m3", mapId: "/Game/Maps/Port/Port" } }, { ...meta, replayId: "r3" })!;
  assert.deepEqual(mapChoices([a, b, c]), [
    { mapUrl: "/Game/Maps/Port/Port", matches: 2 },
    { mapUrl: "/Game/Maps/Duality/Duality", matches: 1 },
  ]);
  assert.deepEqual(playerChoices([a, c]).map((p) => [p.name, p.matches]), [["Grace#TEST", 2], ["Soup#NODLE", 2]]);
});

test("the cache is fresh for a week, and not from the future", () => {
  const now = Date.now();
  assert.equal(isFresh(now - 1000, now), true);
  assert.equal(isFresh(now - 8 * 86_400_000, now), false);
  assert.equal(isFresh(undefined, now), false);
  assert.equal(isFresh(now + 3_600_000, now), false);
});

test("theme channels become rgb", () => {
  assert.deepEqual(hslToRgb("0 0% 0%"), [0, 0, 0]);
  assert.deepEqual(hslToRgb("0 100% 50%"), [255, 0, 0]);
  assert.deepEqual(hslToRgb("120 100% 50%"), [0, 255, 0]);
  assert.deepEqual(hslToRgb("nonsense"), [128, 128, 128]);
});

test("the settings page's choices: colours must be #rrggbb, an unknown start is the default, a colour is read back as numbers", () => {
  assert.deepEqual(normalizePrefs(undefined), { killColor: "", deathColor: "", startSource: "both" });
  assert.deepEqual(normalizePrefs({ killColor: "#FF4655", deathColor: "red", startSource: "library" }), { killColor: "#ff4655", deathColor: "", startSource: "library" });
  assert.deepEqual(normalizePrefs({ killColor: 5, startSource: "everything" }), { killColor: "", deathColor: "", startSource: "both" });
  assert.deepEqual(hexToRgb("#ff4655"), [255, 70, 85]);
});