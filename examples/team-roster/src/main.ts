// Team Roster: the PROVIDER half of two extensions working together (see examples/roster-consumer for the other half).
// It keeps a list of names in its saved data and offers it to other extensions through the public `api` property, and it
// announces changes with an event named after itself.
import { Notice, Plugin } from "soup";

export interface RosterApi {
  /** Everyone on the roster, in the order they were added. */
  list(): string[];
  add(name: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export default class TeamRoster extends Plugin {
  private names: string[] = [];

  /** What other extensions get from `app.extensions.get("team-roster")?.api`. */
  api: RosterApi = {
    list: () => [...this.names],
    add: async (name) => {
      const clean = name.trim();
      if (!clean || this.names.includes(clean)) return;
      this.names.push(clean);
      await this.changed();
    },
    remove: async (name) => {
      this.names = this.names.filter((n) => n !== name);
      await this.changed();
    },
  };

  async onload() {
    this.names = (await this.loadData<{ names?: string[] }>()).names ?? [];
    this.addStatusText(`${this.names.length} on the roster`);
    this.addCommand({
      id: "add-me",
      name: "Add the signed-in player to the roster",
      callback: async () => {
        const me = await this.app.riot.identity();
        if (!me) {
          new Notice("Not signed in to the Riot Client");
          return;
        }
        await this.api.add(me.name);
      },
    });
  }

  private async changed() {
    await this.saveData({ names: this.names });
    this.addStatusText(`${this.names.length} on the roster`);
    // Event names must start with this extension's id and a slash.
    this.app.events.emit("team-roster/changed", this.api.list());
  }
}
