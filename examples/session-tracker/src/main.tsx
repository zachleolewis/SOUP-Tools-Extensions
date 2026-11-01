// Session Tracker: today's wins, losses and rating change in SOUP's header, with the list of the session's matches in a tab.
//
//   logic.ts   the arithmetic: the session window, win or loss from a match file, rating sums, the header text (tested with node)
//   source.ts  everything that touches the Riot Client or the network, behind a small interface
//   store.ts   the session in memory, and the rules for when it is read
//   ui.tsx     the header chip and the Session tab
//
// READ ONLY, OWN ACCOUNT ONLY. It asks for your own match history and rating changes. It never looks up other players, their ranks, or
// anything Riot hides in a lobby; that is the line Riot draws. Every Riot call is logged by SOUP with this extension's id
// ("[ext-session-tracker] Riot remote call: GET pd /mmr/..."); open the debug console with Ctrl+Shift+D > Extensions to see them.
// It is polite: it reads when something happened, polls at most every two minutes, and never while a match is being played.

import { Plugin, debounce } from "soup";
import { riotSource, type DataSource } from "./source";
import { SessionStore } from "./store";
import { HeaderChip, SessionTab, TAB, headline, setCtx } from "./ui";
import "./styles.css";

export default class SessionTracker extends Plugin {
  store = new SessionStore(this, riotSource(this.app));

  /** Swap where the numbers come from (SOUP's self-test uses this to run without a Riot Client). */
  useSource(source: DataSource): void {
    this.store.source = source;
    void this.store.refresh("manual");
  }

  async onload() {
    await this.store.load();
    setCtx({ plugin: this, store: this.store });

    this.addHeaderItem({ id: "chip", order: 150, component: HeaderChip });
    this.addTab({ id: "session", label: "Session", icon: "Trophy", order: 210, component: SessionTab });

    // What makes the numbers change: a match saved, the Riot Client connecting or another account signing in.
    const soon = debounce(() => void this.store.refresh("event"), 3000); // the match details need a moment to be ready
    this.registerEvent(this.app.events.on("match-capture/auto-saved", soon));
    this.registerEvent(this.app.riot.onConnectionChanged(soon));
    // Otherwise a read every two minutes (it skips itself while a match is being played).
    this.registerInterval(window.setInterval(() => void this.store.refresh("poll"), 120_000));

    this.addCommand({ id: "refresh", name: "Session Tracker: read the session now", callback: () => this.store.refresh("manual") });
    this.addCommand({ id: "reset", name: "Session Tracker: reset the session", callback: () => this.store.setReset(Date.now()) });

    // The row in Settings > Extensions says what the chip says.
    this.registerEvent({ off: this.store.subscribe(() => this.addStatusText(headline(this.store.get()))) });

    void this.store.refresh("start");
    this.app.log.info("session-tracker loaded");
  }
}
