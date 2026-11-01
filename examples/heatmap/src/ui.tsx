// The Heatmap tab, in React on SOUP's own React with SOUP's kit. The map is an <img> (the minimap from valorant-api.com, which SOUP's
// content policy allows) with a <canvas> of the same size on top; `draw.ts` paints the glow and the dots on the canvas.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Plugin } from "soup";
import type { Controller, Source } from "./controller";
import { draw, paletteFromTheme } from "./draw";
import { mapChoices, mapCode, nearest, playerChoices, pointsFor, type Filter, type MapInfo, type Mode, type Point, type SideFilter } from "./logic";

/** What `scrim-notes` offers (its documented `api`); copied here because there is no shared package. */
interface NotesApi {
  notesFor(matchId: string): unknown[];
  open(matchId: string): void;
}

export interface Ctx {
  plugin: Plugin;
  ctrl: Controller;
}
let ctx!: Ctx;
export const setCtx = (c: Ctx) => void (ctx = c);

const kit = () => ctx.plugin.app.ui.react.kit;
/** The other extension, if it is installed and on. `optionalDependencies` in the manifest makes SOUP load it first. */
const notesApi = (): NotesApi | null => (ctx.plugin.app.extensions.get("scrim-notes") as unknown as { api?: NotesApi } | undefined)?.api ?? null;

const SOURCES: Array<{ id: Source; label: string }> = [
  { id: "both", label: "Both" },
  { id: "library", label: "Library" },
  { id: "recent", label: "Recent" },
];

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<{ id: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <div className="hm-chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" className="hm-chip" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const date = (ms: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");

// ---------------------------------------------------------------- the map

function MapView({ map, points, glow, dots, weapons, names }: { map: MapInfo; points: Point[]; glow: boolean; dots: boolean; weapons: Record<string, string>; names: (p: Point, id: string) => string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [theme, setTheme] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [hover, setHover] = useState<{ p: Point; x: number; y: number } | null>(null);

  useEffect(() => setImageFailed(false), [map.displayIcon]);
  // Follow the width of the box (a square), and the person's palette.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    setSize(el.clientWidth);
    const themeRef = ctx.plugin.app.ui.theme.onChange(() => setTheme((t) => t + 1));
    return () => {
      ro.disconnect();
      themeRef.off();
    };
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c || size === 0) return;
    const px = Math.round(size * (window.devicePixelRatio || 1));
    if (c.width !== px) c.width = c.height = px;
    draw(c, points, { glow, dots, palette: paletteFromTheme() });
  }, [points, glow, dots, size, theme]);

  const onMove = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = nearest(points, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, 12 / r.width);
    setHover(p ? { p, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };

  const kills = points.filter((p) => p.kind === "kill").length;
  return (
    <div className="hm-map" ref={wrap} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {map.displayIcon && !imageFailed ? <img className="hm-art" src={map.displayIcon} alt={map.displayName} draggable={false} onError={() => setImageFailed(true)} /> : <div className="hm-art hm-art-missing">{imageFailed ? `The picture of ${map.displayName} could not be loaded` : map.displayName}</div>}
      <canvas ref={canvas} className="hm-canvas" data-testid="heatmap-canvas" data-map={map.displayName} data-points={points.length} data-kills={kills} data-deaths={points.length - kills} />
      {hover && (
        <>
          <span className="hm-ring" style={{ left: `${hover.p.u * 100}%`, top: `${hover.p.v * 100}%` }} />
          <div className="hm-tip" role="tooltip" style={{ left: Math.min(hover.x + 14, Math.max(0, size - 210)), top: Math.min(hover.y + 14, Math.max(0, size - 84)) }}>
            <strong>
              {names(hover.p, hover.p.event.killer)} killed {names(hover.p, hover.p.event.victim)}
            </strong>
            <span>
              Round {hover.p.event.round + 1}
              {hover.p.side ? `, ${hover.p.side === "attack" ? "attacking" : "defending"}` : ""} - {(hover.p.event.roundTimeMs / 1000).toFixed(0)}s
            </span>
            <span>{weapons[hover.p.event.weapon] ?? (hover.p.event.damageType || "Unknown weapon")}</span>
            <span className="hm-dim">{hover.p.match.name}</span>
          </div>
        </>
      )}
      {points.length === 0 && <div className="hm-none">Nothing to show with these filters.</div>}
    </div>
  );
}

// ---------------------------------------------------------------- the tab

export function HeatmapTab({ active }: { active?: boolean }) {
  const { Button, EmptyState, inputCls } = kit();
  const snap = useSyncExternalStore(ctx.ctrl.subscribe, ctx.ctrl.get);
  const { view } = snap;
  useEffect(() => {
    if (active !== false) ctx.ctrl.refreshIfStale();
  }, [active]);

  const visible = useMemo(() => snap.matches.filter((m) => (view.source === "both" ? true : view.source === m.source)), [snap.matches, view.source]);
  const maps = useMemo(() => mapChoices(visible), [visible]);
  const mapUrl = view.mapUrl && maps.some((m) => m.mapUrl === view.mapUrl) ? view.mapUrl : (maps[0]?.mapUrl ?? null);
  const onMap = useMemo(() => visible.filter((m) => m.mapUrl === mapUrl), [visible, mapUrl]);
  const mapInfo = snap.maps?.find((m) => m.mapUrl === mapUrl) ?? null;
  const players = useMemo(() => playerChoices(onMap), [onMap]);
  const who = view.who === "all" || players.some((p) => p.subject === view.who) ? view.who : "all";
  const me = snap.me && players.some((p) => p.subject === snap.me) ? snap.me : null;

  const filter: Filter = { mapUrl, mode: view.mode, side: view.side, who, replayId: view.replayId };
  const points = useMemo(() => (mapInfo ? pointsFor(onMap, mapInfo, filter) : []), [onMap, mapInfo, mapUrl, view.mode, view.side, who, view.replayId]);
  const kills = points.filter((p) => p.kind === "kill").length;
  const deaths = points.length - kills;
  const shownMatches = onMap.filter((m) => !view.replayId || m.replayId === view.replayId);
  const perMatch = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of points) n.set(p.match.id, (n.get(p.match.id) ?? 0) + 1);
    return n;
  }, [points]);
  const notes = notesApi();
  const filterName = view.replayId ? snap.matches.find((m) => m.replayId === view.replayId)?.name : null;
  const nameOf = (p: Point, id: string) => p.match.players[id]?.name ?? "Someone";

  const title = (
    <div className="hm-toolbar">
      <h2 className="hm-title">Heatmap</h2>
      <span className="hm-count" data-testid="heatmap-summary">
        {shownMatches.length} match{shownMatches.length === 1 ? "" : "es"} - {kills} kill{kills === 1 ? "" : "s"} - {deaths} death{deaths === 1 ? "" : "s"}
      </span>
      <div className="hm-grow" />
      {snap.loading && (
        <span className="hm-dim" role="status">
          Reading {snap.progress.done} of {snap.progress.total}...
        </span>
      )}
      <Button variant="outline" size="sm" disabled={snap.loading} onClick={() => void ctx.ctrl.reload()}>
        Refresh
      </Button>
    </div>
  );

  if (snap.matches.length === 0) {
    return (
      <div className="hm-panel" data-testid="heatmap">
        {title}
        {snap.loading ? (
          <EmptyState title="Reading your matches..." hint="The Library's match files are read once and kept in memory." />
        ) : (
          <EmptyState title="No match files yet" hint="Save matches to your Library (Matches tab, Match or Replay button) and they show up here. A Library replay needs its Match file (the Match chip on its tile)." />
        )}
        <Notes lines={snap.notes} />
      </div>
    );
  }

  return (
    <div className="hm-panel" data-testid="heatmap">
      {title}
      <div className="hm-split">
        <div className="hm-stage">
          {snap.mapError && !mapInfo ? (
            <div className="hm-error" role="alert">
              <strong>The map could not be drawn.</strong>
              <span>{snap.mapError}</span>
              <Button variant="forest" size="sm" onClick={() => void ctx.ctrl.reload()}>
                Retry
              </Button>
            </div>
          ) : mapInfo ? (
            <MapView map={mapInfo} points={points} glow={view.glow} dots={view.dots} weapons={snap.weapons} names={nameOf} />
          ) : (
            <div className="hm-loading">Loading the map...</div>
          )}
          {mapInfo && (
          <p className="hm-legend">
            <span className="hm-key hm-key-kill" /> kill, where the killer stood <span className="hm-key hm-key-death" /> death, where the player fell. Hover a dot for who, weapon and round.
          </p>
          )}
        </div>
        <aside className="hm-side" aria-label="Controls and matches">
      <div className="hm-controls">
        <div className="hm-field">
          <span>Map</span>
          <Chips<string>
            label="Map"
            value={mapUrl ?? ""}
            onChange={(m) => ctx.ctrl.setView({ mapUrl: m, replayId: null })}
            options={maps.map((m) => ({ id: m.mapUrl, label: `${snap.maps?.find((x) => x.mapUrl === m.mapUrl)?.displayName ?? mapCode(m.mapUrl)} ${m.matches}` }))}
          />
        </div>
        <div className="hm-field">
          <span>From</span>
          <Chips<Source> label="Source" value={view.source} onChange={(source) => ctx.ctrl.setView({ source })} options={SOURCES} />
        </div>        <label className="hm-field">
          <span>Player</span>
          <select className={`${inputCls} hm-select`} aria-label="Player" value={who} onChange={(e) => ctx.ctrl.setView({ who: e.target.value })}>
            <option value="all">Everyone</option>
            {me && <option value={me}>You ({players.find((p) => p.subject === me)?.name})</option>}
            {players
              .filter((p) => p.subject !== me)
              .map((p) => (
                <option key={p.subject} value={p.subject}>
                  {p.name} ({p.matches})
                </option>
              ))}
          </select>
        </label>
        <div className="hm-field">
          <span>Show</span>
          <Chips<Mode> label="Show" value={view.mode} onChange={(mode) => ctx.ctrl.setView({ mode })} options={[{ id: "both", label: "Both" }, { id: "kills", label: "Kills" }, { id: "deaths", label: "Deaths" }]} />
        </div>
        <div className="hm-field">
          <span>Side</span>
          <Chips<SideFilter> label="Side" value={view.side} onChange={(side) => ctx.ctrl.setView({ side })} options={[{ id: "both", label: "Any side" }, { id: "attack", label: "Attack" }, { id: "defense", label: "Defense" }]} />
        </div>
        <div className="hm-field">
          <span>Layers</span>
          <div className="hm-chips" role="group" aria-label="Layers">
          <button type="button" className="hm-chip" aria-pressed={view.glow} onClick={() => ctx.ctrl.setView({ glow: !view.glow })}>
            Glow
          </button>
          <button type="button" className="hm-chip" aria-pressed={view.dots} onClick={() => ctx.ctrl.setView({ dots: !view.dots })}>
            Dots
          </button>
          </div>
        </div>
      </div>
      {view.replayId && (
        <div className="hm-filterbar">
          Only <strong>{filterName ?? "one replay"}</strong>
          <Button variant="outline" size="sm" onClick={() => ctx.ctrl.setView({ replayId: null })}>
            Show all
          </Button>
        </div>
      )}
          <h3 className="hm-sidetitle">Matches</h3>
          <ul className="hm-matches">
            {shownMatches.map((m) => {
              const nNotes = notes?.notesFor(m.id).length ?? 0;
              return (
                <li key={`${m.source}:${m.id}`} className="hm-match" data-match={m.id}>
                  <div className="hm-grow">
                    <p className="hm-matchname">{m.name}</p>
                    <p className="hm-dim">
                      {date(m.startedAt)} - {perMatch.get(m.id) ?? 0} dot{(perMatch.get(m.id) ?? 0) === 1 ? "" : "s"}
                      {m.source === "recent" ? " - recent" : ""}
                    </p>
                  </div>
                  {notes && nNotes > 0 && (
                    <Button variant="outline" size="sm" title="Open these notes in Scrim Notes" onClick={() => notes.open(m.id)}>
                      Notes {nNotes}
                    </Button>
                  )}
                  {m.replayId && !view.replayId && (
                    <Button variant="outline" size="sm" onClick={() => ctx.ctrl.setView({ replayId: m.replayId })}>
                      Only
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          <Notes lines={snap.notes} />
        </aside>
      </div>
    </div>
  );
}

function Notes({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="hm-notes" aria-label="Things to know">
      {lines.slice(0, 4).map((l, i) => (
        <li key={i}>{l}</li>
      ))}
      {lines.length > 4 && <li>...and {lines.length - 4} more (see the log).</li>}
    </ul>
  );
}
