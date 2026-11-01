// Settings > Auto Organizer: the rules. `Setting` builds rows that look like the rest of SOUP's settings; every change is saved for the
// active profile (a team profile keeps the team's rules).

import { Notice, Setting, SettingTab } from "soup";
import { DEFAULT_RULES, factsOf, folderPath, newName, normalizeModes, unknownTokens, type Facts } from "./logic";
import type { Organizer } from "./organizer";
import type { Plugin } from "soup";

/** A made-up match, so the preview under a template field shows something even with an empty Library. */
const SAMPLE: Facts = { mode: "Competitive", map: "Icebox", startedAt: new Date(2026, 9, 27, 18, 5).getTime(), score: "13-8", result: "Win", matchId: "3f2a9c1e-5b7d-4e86-9a10-0c4d2b6e8f13" };

export class OrganizerSettings extends SettingTab {
  constructor(
    app: unknown,
    private plugin: Plugin,
    private org: Organizer,
  ) {
    super(app);
    this.name = "Auto Organizer";
  }

  display() {
    const { org, plugin } = this;
    const el = this.containerEl;
    const rules = () => org.get().rules;

    new Setting(el)
      .setName("Organize new matches automatically")
      .setDesc("When SOUP saves a finished match, file it by these rules. The Library's Import menu has Organize existing replays... either way.")
      .addToggle((t) => t.setValue(rules().enabled).onChange((enabled) => org.setRules({ enabled })));

    const folders = new Setting(el).setName("Folder template").addText((t) => {
      t.setValue(rules().folderTemplate).setPlaceholder(DEFAULT_RULES.folderTemplate).onChange((v) => org.setRules({ folderTemplate: v }));
      t.inputEl.setAttribute("aria-label", "Folder template");
    });
    const names = new Setting(el).setName("Rename template").addText((t) => {
      t.setValue(rules().renameTemplate).setPlaceholder(DEFAULT_RULES.renameTemplate).onChange((v) => org.setRules({ renameTemplate: v }));
      t.inputEl.setAttribute("aria-label", "Rename template");
    });
    // The description under each field shows what the template makes of a sample match, and says when a token is not known.
    const describe = () => {
      const r = rules();
      const bad = [...unknownTokens(r.folderTemplate), ...unknownTokens(r.renameTemplate)];
      folders.setDesc(`Tokens: {mode} {map} {date} {date:YYYY-MM} {time} {score} {result} {id}. A / makes sub-folders. Example: ${folderPath(r.folderTemplate, SAMPLE).join("/") || "(the top of the Library)"}`);
      names.setDesc(`Example: ${r.renameTemplate.trim() ? newName(r.renameTemplate, factsOf({ id: "x", folderId: null, name: "x", matchId: SAMPLE.matchId, mode: SAMPLE.mode, map: SAMPLE.map, score: "13 - 8", startedAt: SAMPLE.startedAt, importedAt: 0 }, SAMPLE.result), "") : "(names are not changed)"}${bad.length ? `. Not a token: ${bad.map((b) => `{${b}}`).join(" ")}` : ""}`);
    };
    describe();
    const sub = org.subscribe(describe);

    new Setting(el)
      .setName("Only these modes")
      .setDesc("Comma separated, for example: custom, competitive, premier. Empty means every mode.")
      .addText((t) => {
        t.setValue(rules().modes.join(", ")).setPlaceholder("every mode").onChange((v) => org.setRules({ modes: normalizeModes(v) }));
        t.inputEl.setAttribute("aria-label", "Only these modes");
      });

    let backupInput: HTMLInputElement | HTMLTextAreaElement | null = null;
    new Setting(el)
      .setName("Backup folder")
      .setDesc("The replay and match file are copied here after they are filed. Never overwritten. Empty for no backup.")
      .addText((t) => {
        backupInput = t.inputEl;
        t.setValue(rules().backupDir).setPlaceholder("no backup").onChange((v) => org.setRules({ backupDir: v }));
        t.inputEl.setAttribute("aria-label", "Backup folder");
      })
      .addButton((b) =>
        b.setButtonText("Choose...").onClick(async () => {
          const picked = await plugin.app.dialog.openFolder({ title: "Choose the backup folder" });
          if (!picked) return;
          org.setRules({ backupDir: picked });
          if (backupInput) backupInput.value = picked;
        }),
      );

    new Setting(el)
      .setName("Discord webhook")
      .setDesc("After each new match a short summary (map, score, top fragger, no links) is posted to this channel. Keep the address private: SOUP's log lists the addresses an extension requests.")
      .addText((t) => {
        t.setValue(rules().webhookUrl).setPlaceholder("https://discord.com/api/webhooks/...").onChange((v) => org.setRules({ webhookUrl: v }));
        t.inputEl.setAttribute("aria-label", "Discord webhook");
      })
      .addButton((b) =>
        b.setButtonText("Send a test message").onClick(async () => {
          await org.flush();
          if (!rules().webhookUrl.trim()) return void new Notice("Auto Organizer: paste a webhook address first");
          await org.sendTest();
        }),
      );

    this.cleanup = sub;
  }

  private cleanup: (() => void) | null = null;
  hide() {
    this.cleanup?.();
    this.cleanup = null;
    void this.org.flush();
  }
}
