// The header chip and the Session tab, in React on SOUP's own React with SOUP's kit.

import { useEffect, useSyncExternalStore } from "react";
import type { Plugin } from "soup";
import { chipText, signed, type SessionMatch } from "./logic";
import type { SessionStore } from "./store";

export interface Ctx {
  plugin: Plugin;
  store: SessionStore;
}
let ctx!: Ctx;
export const setCtx = (c: Ctx) => void (ctx = c);

const kit = () => ctx.plugin.app.ui.react.kit;
const useSession = () => useSyncExternalStore(ctx.store.subscribe, ctx.store.get);
export const TAB = "session-tracker.session";

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** What the chip says: the totals, or why there are none. */
export function headline(s: ReturnType<SessionStore["get"]>): string {
  if (s.status === "signed-out") return "Not signed in";
  if (s.status === "starting") return "Session...";
  if (s.status === "error" && s.matches.length === 0) return "Session unavailable";
  return chipText(s.since.kind, s.totals);
}

/** A small item in the header, beside the connection pill. Clicking it opens the tab. */
export function HeaderChip() {
  const s = useSession();
  const tone = s.status === "ready" ? (s.totals.rr > 0 || s.totals.wins > s.totals.losses ? "up" : s.totals.rr < 0 || s.totals.losses > s.totals.wins ? "down" : "even") : "off";
  return (
    <button type="button" className="st-chip" data-testid="session-chip" data-state={s.status} title="Open the Session tab" onClick={() => ctx.plugin.app.ui.navigate(TAB)}>
      <span className="st-dot" data-tone={tone} />
      {headline(s)}
    </button>
  );
}

function ResultCell({ m }: { m: SessionMatch }) {
  const label = m.result === "win" ? "Win" : m.result === "loss" ? "Loss" : m.result === "draw" ? "Draw" : "?";
  return <span className={`st-result st-${m.result}`}>{label}</span>;
}

export function SessionTab({ active }: { active?: boolean }) {
  const { Button, EmptyState } = kit();
  const s = useSession();
  useEffect(() => {
    if (active !== false) ctx.store.refreshIfStale();
  }, [active]);

  const since = `${s.since.kind === "today" ? "today" : "your reset"}, ${clock(s.since.at)}`;
  const t = s.totals;
  const toolbar = (
    <div className="st-toolbar">
      <h2 className="st-title">Session</h2>
      {s.who && <span className="st-pill">{s.who}</span>}
      <div className="st-grow" />
      {s.refreshing && (
        <span className="st-dim" role="status">
          Reading...
        </span>
      )}
      <Button variant="outline" size="sm" disabled={s.refreshing} onClick={() => void ctx.store.refresh("manual")}>
        Refresh
      </Button>
      {s.since.kind === "reset" && (
        <Button variant="outline" size="sm" onClick={() => void ctx.store.setReset(null)}>
          Back to today
        </Button>
      )}
      <Button variant="forest" size="sm" disabled={s.status === "signed-out"} onClick={() => void ctx.store.setReset(Date.now())}>
        Reset session
      </Button>
    </div>
  );

  let body;
  if (s.status === "signed-out") {
    body = <EmptyState title="Not signed in" hint="Start the Riot Client and sign in. This tab fills in by itself a moment after you do; nothing is asked of you." />;
  } else if (s.status === "starting") {
    body = <EmptyState title="Reading your session..." hint="One look at your match history and your rating." />;
  } else if (s.status === "error" && s.matches.length === 0) {
    body = (
      <EmptyState
        title="The session could not be read"
        hint={s.error ?? "Something went wrong."}
        action={
          <Button variant="forest" size="sm" onClick={() => void ctx.store.refresh("manual")}>
            Try again
          </Button>
        }
      />
    );
  } else {
    body = (
      <>
        <div className="st-summary">
          <div className="st-card" data-testid="session-record">
            <span className="st-label">Record since {since}</span>
            <strong className="st-big">
              {t.wins}W {t.losses}L{t.draws ? ` ${t.draws}D` : ""}
            </strong>
            <span className="st-dim">{t.games} game{t.games === 1 ? "" : "s"}</span>
          </div>
          <div className="st-card" data-testid="session-rr">
            <span className="st-label">Rating change</span>
            <strong className="st-big">{t.hasRr ? `${signed(t.rr)} RR` : "-"}</strong>
            <span className="st-dim">{t.hasRr ? "from ranked games in this session" : "no ranked games yet"}</span>
          </div>
          <div className="st-card" data-testid="session-rank">
            <span className="st-label">Rank</span>
            <strong className="st-big">{s.rank ? s.rank.label : "-"}</strong>
            <span className="st-dim">{s.rank ? `${s.rank.rr} RR` : "play a ranked game"}</span>
          </div>
        </div>
        {s.matches.length === 0 ? (
          <EmptyState title="No games yet" hint={`Nothing played since ${since}. A game shows up here when it ends; custom games and every queue count, only ranked ones change your rating.`} />
        ) : (
          <table className="st-table" aria-label="Matches in this session">
            <thead>
              <tr>
                <th>Time</th>
                <th>Map</th>
                <th>Mode</th>
                <th>Result</th>
                <th>Score</th>
                <th>K / D / A</th>
                <th className="st-num">RR</th>
              </tr>
            </thead>
            <tbody>
              {s.matches.map((m) => (
                <tr key={m.matchId} data-match={m.matchId}>
                  <td>{clock(m.startedAt)}</td>
                  <td>{m.map || "-"}</td>
                  <td>{m.mode}</td>
                  <td>
                    <ResultCell m={m} />
                  </td>
                  <td>{m.score || "-"}</td>
                  <td>{m.kills === null ? "-" : `${m.kills} / ${m.deaths} / ${m.assists}`}</td>
                  <td className="st-num">{m.rr === null ? (m.mode === "Competitive" ? "..." : "-") : signed(m.rr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {s.status === "error" && <p className="st-warn">The last read failed: {s.error} Showing what was read before.</p>}
        {s.notes.length > 0 && (
          <ul className="st-notes" aria-label="Things to know">
            {s.notes.slice(0, 3).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        {s.inMatch && <p className="st-dim st-foot">A match is being played: no reads until it ends.</p>}
      </>
    );
  }

  return (
    <div className="st-panel" data-testid="session-tab">
      {toolbar}
      {body}
      <p className="st-foot st-dim">Read only: your own matches and rating, through the Riot Client. Updated {s.updatedAt ? clock(s.updatedAt) : "never"}.</p>
    </div>
  );
}
