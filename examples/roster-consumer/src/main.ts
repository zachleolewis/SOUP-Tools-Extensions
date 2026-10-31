// Roster Consumer: the CONSUMER half. `dependencies` in manifest.json makes SOUP load team-roster first and refuse to load this
// extension without it, so `app.extensions.get("team-roster")` is there when onload runs.
import { Plugin } from "soup";
import type { RosterApi } from "../../team-roster/src/main";

export default class RosterConsumer extends Plugin {
  async onload() {
    const roster = (this.app.extensions.get("team-roster") as unknown as { api: RosterApi } | undefined)?.api;
    if (!roster) throw new Error("team-roster is not loaded");

    this.addTab({
      id: "roster",
      label: "Roster",
      icon: "Users",
      order: 320,
      mount: (el) => {
        const render = (names: string[]) => (el.textContent = names.length ? names.join(", ") : "Nobody on the roster yet");
        render(roster.list());
        // The provider announces changes with its own event; the subscription ends when this tab unmounts.
        const sub = this.app.events.on("team-roster/changed", (names: string[]) => render(names));
        return () => sub.off();
      },
    });
  }
}
