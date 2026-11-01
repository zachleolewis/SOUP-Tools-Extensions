// Heatmap: where your kills and deaths happened, drawn on the real minimap, from the match files in your Library and your recent matches.
//
//   logic.ts       reading a match file, the coordinates, the filters (plain functions, tested with node)
//   mapdata.ts     map art and coordinates from valorant-api.com through app.requestUrl, cached for 7 days in the data folder
//   controller.ts  the state and the loading
//   draw.ts        the glow and the dots on a canvas
//   ui.tsx         the tab
//
// What it accesses: match files from your Library (read only), your match history through the Riot Client's own cache in SOUP (match
// details of your recent games), valorant-api.com (map pictures and weapon names, nothing about you is sent), and its own data folder.
//
// It works with Scrim Notes when that is installed (`optionalDependencies` in the manifest): a match that has notes gets a Notes button
// that opens them. That is the example for docs/13-working-with-other-extensions.md.

import { Plugin, debounce } from "soup";
import { Controller } from "./controller";
import { HeatmapTab, setCtx } from "./ui";
import "./styles.css";

export default class Heatmap extends Plugin {
  ctrl = new Controller(this);

  async onload() {
    setCtx({ plugin: this, ctrl: this.ctrl });

    this.addTab({ id: "heatmap", label: "Heatmap", icon: "Crosshair", order: 230, component: HeatmapTab });

    // The Library: a Heatmap button on each replay that has a match file. It opens the tab filtered to that one replay.
    this.addLibraryReplayAction({
      id: "heatmap",
      label: "Heatmap",
      icon: "Crosshair",
      slot: "chip",
      when: (replay) => replay.hasJson,
      run: (replay) => {
        this.ctrl.focusReplay(replay);
        this.app.ui.navigate(`${this.manifest.id}.heatmap`);
      },
    });

    this.addCommand({ id: "refresh", name: "Heatmap: read matches again", callback: () => void this.ctrl.reload() });

    // The Library changes in bursts (an import adds several replays): read once, a moment after the last change.
    this.registerEvent(this.app.library.onChanged(debounce(() => void this.ctrl.reload(), 800)));

    // The row in Settings > Extensions says what the tab is showing.
    this.registerEvent({
      off: this.ctrl.subscribe(() => {
        const s = this.ctrl.get();
        this.addStatusText(s.loading ? "Reading matches..." : `${s.matches.length} match${s.matches.length === 1 ? "" : "es"} read`);
      }),
    });

    // Do not make SOUP wait for the reading: the tab shows its progress.
    void this.ctrl.reload();
    this.app.log.info("heatmap loaded");
  }
}
