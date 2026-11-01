// What Auto Organizer decides: templates, folder paths, names that do not clash, which modes, and the Discord facts. `npm run check:logic`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_RULES, cleanName, compactScore, fill, findFolder, folderPath, isDiscordWebhook, modeAllowed, newName, normalizeModes, pathOf, planFor, resultFor, topFragger, undoSteps, unknownTokens, type Facts, type FolderLite, type ReplayLite } from "../examples/auto-organizer/src/logic.ts";

const at = new Date(2026, 9, 27, 18, 5).getTime(); // local time, as the tokens are
const facts: Facts = { mode: "Competitive", map: "Icebox", startedAt: at, score: "13-8", result: "Win", matchId: "3f2a9c1e-5b7d-4e86-9a10-0c4d2b6e8f13" };

test("every token", () => {
  assert.equal(fill("{mode}/{map}", facts), "Competitive/Icebox");
  assert.equal(fill("{date} {map} {score} {result}", facts), "2026-10-27 Icebox 13-8 Win");
  assert.equal(fill("{date:YYYY-MM}", facts), "2026-10");
  assert.equal(fill("{date:DD.MM.YYYY HH:mm}", facts), "27.10.2026 18:05");
  assert.equal(fill("{time}", facts), "18-05");
  assert.equal(fill("{id}", facts), "3f2a9c1e");
  assert.equal(fill("{nonsense} {map}", facts), "{nonsense} Icebox", "an unknown token stays visible");
  assert.deepEqual(unknownTokens("{mode}/{typo}/{date:YYYY}/{other}"), ["typo", "other"]);
});

test("folder paths: one cleaned segment per slash, empty ones dropped", () => {
  assert.deepEqual(folderPath("{mode}/{map}", facts), ["Competitive", "Icebox"]);
  assert.deepEqual(folderPath("Scrims/{date:YYYY-MM}/{result}", { ...facts, result: "" }), ["Scrims", "2026-10"]);
  assert.deepEqual(folderPath("  /a:b/ /c?  ", facts), ["a-b", "c-"]);
  assert.deepEqual(folderPath("", facts), []);
});

test("names: Windows' forbidden characters go, an empty result keeps the old name", () => {
  assert.equal(cleanName('a<b>c:d"e/f\\g|h?i*j'), "a-b-c-d-e-f-g-h-i-j");
  assert.equal(cleanName("  ..name.. "), "name");
  assert.equal(cleanName("x".repeat(200)).length, 80);
  assert.equal(newName("{date} {map} {score}", facts, "old"), "2026-10-27 Icebox 13-8");
  assert.equal(newName("{result}", { ...facts, result: "" }, "old"), "old");
  assert.equal(newName("{map}   {score}", facts, "old"), "Icebox 13-8", "spaces collapse");
});

test("modes: a list in any case, empty means all", () => {
  assert.deepEqual(normalizeModes(" Custom, competitive;PREMIER,, custom"), ["custom", "competitive", "premier"]);
  assert.equal(modeAllowed([], "Swiftplay"), true);
  assert.equal(modeAllowed([], null), true);
  assert.equal(modeAllowed(["custom"], "Custom"), true);
  assert.equal(modeAllowed(["custom"], "Competitive"), false);
  assert.equal(modeAllowed(["custom"], null), false);
});

test("scores and results", () => {
  assert.equal(compactScore("13 - 8"), "13-8");
  assert.equal(compactScore(null), "");
  const file = { players: [{ subject: "me", teamId: "Blue", gameName: "Soup", tagLine: "N", stats: { kills: 20 } }, { subject: "x", teamId: "Red", gameName: "Ace", tagLine: "T", stats: { kills: 31 } }], teams: [{ teamId: "Blue", won: true }, { teamId: "Red", won: false }] };
  assert.equal(resultFor(file, "me"), "Win");
  assert.equal(resultFor(file, "x"), "Loss");
  assert.equal(resultFor({ ...file, teams: [{ teamId: "Blue", won: false }, { teamId: "Red", won: false }] }, "me"), "Draw");
  assert.equal(resultFor(file, "nobody"), "");
  assert.equal(resultFor(file, null), "");
  assert.deepEqual(topFragger(file), { name: "Ace#T", kills: 31 });
  assert.equal(topFragger({}), null);
});

const folders: FolderLite[] = [
  { id: "f1", name: "Competitive", parentId: null },
  { id: "f2", name: "Icebox", parentId: "f1" },
];
const replay = (id: string, over: Partial<ReplayLite> = {}): ReplayLite => ({ id, folderId: null, name: `Replay ${id}`, matchId: `${id}-0000-0000`, mode: "Competitive", map: "Icebox", score: "13 - 8", startedAt: at, importedAt: at + 1, ...over });

test("folders are found by path, without regard to case", () => {
  assert.deepEqual(findFolder(folders, ["competitive", "ICEBOX"]), { exists: true, id: "f2" });
  assert.deepEqual(findFolder(folders, ["Competitive", "Bind"]), { exists: false, id: null });
  assert.deepEqual(findFolder(folders, []), { exists: true, id: null });
  assert.deepEqual(pathOf(folders, "f2"), ["Competitive", "Icebox"]);
  assert.deepEqual(pathOf(folders, null), []);
});

test("a plan: where it goes, what it is called, and whether anything changes", () => {
  const r = replay("a");
  const p = planFor(r, DEFAULT_RULES, folders, [r], "");
  assert.deepEqual(p.to, { folderPath: ["Competitive", "Icebox"], folderId: "f2", folderExists: true, name: "2026-10-27 Icebox 13-8" });
  assert.deepEqual([p.move, p.rename], [true, true]);
  const bind = planFor(replay("b", { map: "Bind" }), DEFAULT_RULES, folders, [], "");
  assert.deepEqual([bind.to.folderExists, bind.to.folderId], [false, null], "a folder that has to be made");
  // Already in place and named: nothing to do.
  const done = replay("c", { folderId: "f2", name: "2026-10-27 Icebox 13-8" });
  const q = planFor(done, DEFAULT_RULES, folders, [done], "");
  assert.deepEqual([q.move, q.rename], [false, false]);
});

test("two matches never get the same name in one folder", () => {
  const first = replay("a", { folderId: "f2", name: "2026-10-27 Icebox 13-8" });
  const second = replay("b");
  assert.equal(planFor(second, DEFAULT_RULES, folders, [first, second], "").to.name, "2026-10-27 Icebox 13-8 (2)");
  const third = replay("c", { folderId: "f2", name: "2026-10-27 Icebox 13-8 (2)" });
  assert.equal(planFor(second, DEFAULT_RULES, folders, [first, second, third], "").to.name, "2026-10-27 Icebox 13-8 (3)");
});

test("an empty template leaves that part alone", () => {
  const r = replay("a", { folderId: "f2" });
  const keepFolder = planFor(r, { ...DEFAULT_RULES, folderTemplate: "" }, folders, [r], "");
  assert.deepEqual([keepFolder.move, keepFolder.to.folderPath], [false, ["Competitive", "Icebox"]]);
  const keepName = planFor(r, { ...DEFAULT_RULES, renameTemplate: "" }, folders, [r], "");
  assert.deepEqual([keepName.rename, keepName.to.name], [false, "Replay a"]);
});

test("only a Discord webhook address is accepted (https, discord.com or discordapp.com)", () => {
  assert.equal(isDiscordWebhook("https://discord.com/api/webhooks/123456/abc-DEF_9"), true);
  assert.equal(isDiscordWebhook("  https://discordapp.com/api/webhooks/123456/abc  "), true);
  assert.equal(isDiscordWebhook("https://ptb.discord.com/api/v10/webhooks/123456/abc"), true);
  assert.equal(isDiscordWebhook("http://discord.com/api/webhooks/123456/abc"), false, "plain http is refused");
  assert.equal(isDiscordWebhook("https://evil.example/api/webhooks/123456/abc"), false);
  assert.equal(isDiscordWebhook("https://discord.com.evil.example/api/webhooks/123456/abc"), false);
  assert.equal(isDiscordWebhook("https://discord.com@evil.example/api/webhooks/123456/abc"), false);
  assert.equal(isDiscordWebhook("https://discord.com/channels/123/456"), false);
  assert.equal(isDiscordWebhook("not a url"), false);
});

test("undo can be run again after it stopped half way", () => {
  const u = { from: { folderId: null, name: "Old" }, to: { folderId: "f2", name: "New" } };
  assert.deepEqual(undoSteps({ folderId: "f2", name: "New" }, u), { rename: true, move: true });
  assert.deepEqual(undoSteps({ folderId: "f2", name: "Old" }, u), { rename: false, move: true }, "renamed, the move failed: only the move is left");
  assert.deepEqual(undoSteps({ folderId: null, name: "New" }, u), { rename: true, move: false });
  assert.deepEqual(undoSteps({ folderId: null, name: "Old" }, u), { rename: false, move: false }, "already back");
  assert.equal(typeof undoSteps({ folderId: "f9", name: "New" }, u), "string", "someone moved it since");
  assert.equal(typeof undoSteps({ folderId: "f2", name: "Mine" }, u), "string", "someone renamed it since");
});
