// Auto Organizer: files each new match into folders, renames it, backs it up and tells Discord, by rules you set. Everything it does is
// listed in its tab with an Undo.
//
//   logic.ts      the templates, the plan, which modes (plain functions, tested with node)
//   organizer.ts  the work: the Library module's own calls, app.fs.copy, requestUrl, the activity log, undo
//   settings.ts   the rules in Settings
//   ui.tsx        the tab and the preview dialog of "Organize existing replays..."
//
// What it touches: the Library (it moves and renames replays through the Library module's own API, the same calls SOUP's screens use),
// the backup folder you choose (it copies the replay and match file there), the Discord webhook address you paste (one POST per match), and,
// for {result}, the match files in your Library (read only) and the signed-in account's name from SOUP.
// A failure never throws out of an event handler: it is a Notice, a log line and a line in the tab, and the next match still works.

import { Plugin } from "soup";
import { Organizer } from "./organizer";
import { OrganizerSettings } from "./settings";
import { OrganizerTab, openPreview, setCtx } from "./ui";
import "./styles.css";

export default class AutoOrganizer extends Plugin {
  org = new Organizer(this);

  async onload() {
    // Cleanups run in reverse order, so this first one runs last: the line says every listener is gone (a test waits for it).
    this.register(() => this.app.log.info("auto-organizer unloaded: it no longer listens for saved matches"));
    await this.org.load();
    setCtx({ plugin: this, org: this.org });

    this.addTab({ id: "organizer", label: "Organizer", icon: "Archive", order: 240, component: OrganizerTab });
    this.addSettingTab(new OrganizerSettings(this.app, this, this.org));

    // The trigger: SOUP saved a finished match. The payload names the match; the organizer finds its replay in the Library.
    this.registerEvent(this.app.events.on("match-capture/auto-saved", (saved: { matchId: string }) => void this.org.onAutoSaved(saved.matchId)));

    // The Library's Import menu gets "Organize existing replays...": a preview first, nothing moves until Apply.
    this.addLibraryToolbarAction({ id: "organize", label: "Organize existing replays...", icon: "Archive", run: () => openPreview() });
    this.addCommand({ id: "organize", name: "Auto Organizer: organize existing replays...", callback: () => openPreview() });

    // The row in Settings > Extensions says what it is doing.
    const status = () => {
      const d = this.org.get();
      this.addStatusText(d.rules.enabled ? `On: ${d.rules.folderTemplate || "folders unchanged"}` : "Automatic organizing is off");
    };
    status();
    this.registerEvent({ off: this.org.subscribe(status) });
    this.register(() => this.org.dispose()); // queued moves and the wait for the Library to catch up stop here
    this.register(() => void this.org.flush()); // whatever was typed last is saved when the extension is turned off
    this.app.log.info("auto-organizer loaded");
  }
}
