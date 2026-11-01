// The Heatmap's settings page (the cog on its row in Settings > Extensions): the colours of kills and deaths and where the tab starts.
// Every change is drawn at once and saved with `saveData`, so it belongs to the active profile. It shows the page builders a settings
// page usually needs: headings that group rows, a colour picker, an "extra button" that resets one row, a dropdown, and `redraw()`.

import { Setting, SettingTab } from "soup";
import type { Controller } from "./controller";
import type { Prefs } from "./logic";

const SOURCES: Record<Prefs["startSource"], string> = { both: "Library and recent matches", library: "Library only", recent: "Recent matches only" };

export class HeatmapSettings extends SettingTab {
  constructor(
    app: unknown,
    private ctrl: Controller,
  ) {
    super(app);
    this.name = "Heatmap";
  }

  display() {
    const el = this.containerEl;
    const prefs = () => this.ctrl.get().prefs;
    const set = (patch: Partial<Prefs>) => this.ctrl.setPrefs(patch);

    new Setting(el).setName("Colours").setHeading();
    const colour = (label: string, key: "killColor" | "deathColor", fallback: string, what: string) => {
      const row = new Setting(el).setName(label);
      const describe = () => row.setDesc(prefs()[key] ? `${what} Reset to use the theme's colour again.` : `${what} Now: the theme's colour.`);
      let reset: HTMLButtonElement | null = null;
      row
        .addColorPicker((c) => {
          // Dragging fires `input` many times a second: the tab is redrawn live, the profile is saved once when the picker is let go (`change`).
          c.setValue(prefs()[key] || fallback).onChange((v) => {
            this.ctrl.setPrefs({ [key]: v } as Partial<Prefs>, false);
            describe();
            if (reset) reset.disabled = false;
          });
          c.colorEl.addEventListener("change", () => this.ctrl.savePrefs());
          c.colorEl.setAttribute("aria-label", label);
        })
        .addExtraButton((b) => {
          reset = b.extraSettingsEl;
          b.setIcon("Reset")
            .setTooltip(`${label}: use the theme's colour`)
            .setDisabled(!prefs()[key])
            .onClick(() => {
              set({ [key]: "" } as Partial<Prefs>);
              this.redraw(); // the picker goes back to the theme's colour
            });
        });
      describe();
    };
    const theme = getComputedStyle(document.documentElement);
    const hex = (cssVar: string) => {
      // The picker needs #rrggbb: draw the theme colour on a 1x1 canvas and read it back.
      const c = document.createElement("canvas").getContext("2d")!;
      c.fillStyle = `hsl(${theme.getPropertyValue(cssVar).trim().replace(/ /g, ", ")})`;
      return c.fillStyle.startsWith("#") ? c.fillStyle : "#4ec98a";
    };
    colour("Kill colour", "killColor", hex("--forest-300"), "The glow and the round dots of kills.");
    colour("Death colour", "deathColor", hex("--warning"), "The glow and the diamonds of deaths.");

    new Setting(el).setName("When the tab opens").setHeading();
    new Setting(el)
      .setName("Start with")
      .setDesc("The matches the tab shows first. The chips at the top of the tab still change it while you look.")
      .addDropdown((d) => {
        d.addOptions(SOURCES).setValue(prefs().startSource).onChange((v) => {
          set({ startSource: v as Prefs["startSource"] });
          this.ctrl.setView({ source: v as Prefs["startSource"] });
        });
        d.selectEl.setAttribute("aria-label", "Start with");
      });
    new Setting(el)
      .setName("Read the matches again")
      .setDesc("The Library and your recent matches are read when they change; this reads them now.")
      .addButton((b) => b.setButtonText("Read again").onClick(() => void this.ctrl.reload()));
  }
}
