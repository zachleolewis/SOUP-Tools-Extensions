// Riot Party Tools: shows how many people are in your party, kept up to date by the Riot Client's own events.
//
// This extension only READS. It uses the signed-in account's tokens through SOUP (app.riot.remote adds them), so read
// docs/09-riot.md first: what an extension does with a Riot account is the account owner's responsibility.
import { Notice, Plugin } from "soup";

interface PartyPlayer {
  Subject: string;
}
interface PartyAnswer {
  CurrentPartyID?: string;
}
interface Party {
  Members?: PartyPlayer[];
  State?: string;
}

export default class RiotPartyTools extends Plugin {
  async onload() {
    this.addStatusText("waiting for the Riot Client");

    // Any event whose URI contains this text. The payload arrives as `e.data`.
    const sub = await this.app.riot.onLocalEvent("/parties/v1/parties/", () => void this.refresh());
    this.register(() => sub.off());

    // Also look when the Riot Client connects or the account changes.
    this.registerEvent(this.app.riot.onConnectionChanged(() => void this.refresh()));

    this.addCommand({
      id: "show-party",
      name: "Show my party",
      callback: async () => {
        const text = await this.refresh();
        new Notice(text);
      },
    });
    void this.refresh();
  }

  /** Ask Riot for the party and put the answer on this extension's row in Settings. */
  async refresh(): Promise<string> {
    let text: string;
    try {
      const me = await this.app.riot.identity();
      if (!me) {
        text = "not signed in";
      } else {
        const player = await this.app.riot.remote("GET", { service: "glz", path: `/parties/v1/players/${me.puuid}` });
        const partyId = player.status === 200 ? (player.json as PartyAnswer).CurrentPartyID : undefined;
        if (!partyId) {
          text = "not in a party";
        } else {
          const party = await this.app.riot.remote("GET", { service: "glz", path: `/parties/v1/parties/${partyId}` });
          const members = party.status === 200 ? ((party.json as Party).Members ?? []).length : 0;
          text = `party of ${members}`;
        }
      }
    } catch (e) {
      // client_not_running: the Riot Client is closed. Anything else is worth a log line.
      text = "no Riot Client";
      this.app.log.debug(`party lookup failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    this.addStatusText(text);
    return text;
  }
}
