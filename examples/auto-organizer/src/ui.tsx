// The Organizer tab (rules at a glance and the activity log with Undo) and the dialog of the Library's "Organize existing replays...",
// which shows what would change and changes nothing until Apply is pressed. React on SOUP's own React with SOUP's kit.

import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Modal, Notice, type Plugin } from "soup";
import { type Plan } from "./logic";
import type { LogEntry, Organizer, ReplayFull } from "./organizer";

export interface Ctx {
  plugin: Plugin;
  org: Organizer;
}
let ctx!: Ctx;
export const setCtx = (c: Ctx) => void (ctx = c);

const kit = () => ctx.plugin.app.ui.react.kit;
const useData = () => useSyncExternalStore(ctx.org.subscribe, ctx.org.get);

const stamp = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** A long path as its last two folders, with the whole path as the tooltip. */
const shortPath = (p: string) => {
  const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.length > 3 ? `.../${parts.slice(-2).join("/")}` : p;
};

const KIND: Record<LogEntry["kind"], string> = { organized: "Filed", backup: "Backup", webhook: "Discord", undo: "Undo", skipped: "Skipped", error: "Problem" };

// ---------------------------------------------------------------- the tab

export function OrganizerTab() {
  const { Button, EmptyState, Switch } = kit();
  const data = useData();
  const r = data.rules;
  const modes = r.modes.length ? r.modes.join(", ") : "every mode";

  return (
    <div className="ao-panel" data-testid="auto-organizer">
      <div className="ao-toolbar">
        <h2 className="ao-title">Auto Organizer</h2>
        <label className="ao-switch">
          <Switch checked={r.enabled} onChange={(enabled: boolean) => ctx.org.setRules({ enabled })} label="Automatic organizing" />
          <span>{r.enabled ? "Organizing new matches" : "Automatic organizing is off"}</span>
        </label>
        <div className="ao-grow" />
        <Button variant="forest" size="sm" onClick={() => openPreview()}>
          Organize existing replays...
        </Button>
      </div>

      <dl className="ao-rules" aria-label="The rules">
        <dt>Folders</dt>
        <dd>
          <code>{r.folderTemplate || "(not changed)"}</code>
        </dd>
        <dt>Names</dt>
        <dd>
          <code>{r.renameTemplate || "(not changed)"}</code>
        </dd>
        <dt>Modes</dt>
        <dd>{modes}</dd>
        <dt>Backup</dt>
        <dd title={r.backupDir || undefined}>{r.backupDir ? shortPath(r.backupDir) : "off"}</dd>
        <dt>Discord</dt>
        <dd>{r.webhookUrl ? "on (a summary after each match)" : "off"}</dd>
      </dl>
      <p className="ao-hint">Change the rules in Settings, under Auto Organizer.</p>

      <div className="ao-logbar">
        <h3 className="ao-subtitle">Activity</h3>
        <span className="ao-hint">the last {data.log.length} of 50</span>
        <div className="ao-grow" />
        {data.log.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => ctx.org.clearLog()}>
            Clear
          </Button>
        )}
      </div>
      {data.log.length === 0 ? (
        <EmptyState title="Nothing organized yet" hint="When SOUP saves a match it is filed by your rules and listed here, with an Undo. To tidy what is already in your Library, press Organize existing replays..." />
      ) : (
        <ul className="ao-log" aria-label="Activity">
          {data.log.map((e) => (
            <li key={e.id} className={`ao-entry ao-${e.kind}`} data-kind={e.kind}>
              <span className="ao-when">{stamp(e.at)}</span>
              <span className="ao-kind">{KIND[e.kind]}</span>
              <span className="ao-text">{e.text}</span>
              {e.undo && !e.undone && (
                <Button variant="outline" size="sm" onClick={() => void ctx.org.undo(e.id)}>
                  Undo
                </Button>
              )}
              {e.undone && <span className="ao-hint">undone</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- "Organize existing replays..."

type Row = { replay: ReplayFull; plan: Plan | null; skip: string | null };

function PreviewBody({ onClose }: { onClose: () => void }) {
  const { Button } = kit();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ done: number; failed: number } | null>(null);
  const backup = useData().rules.backupDir;

  useEffect(() => {
    ctx.org.preview().then(setRows, (e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const todo = (rows ?? []).filter((r) => r.plan);
  const apply = async () => {
    setApplying(true);
    try {
      const r = await ctx.org.applyPreview(todo.map((x) => x.replay.id));
      setResult(r);
      new Notice(`Auto Organizer: organized ${r.done} replay${r.done === 1 ? "" : "s"}${r.failed ? `, ${r.failed} failed` : ""}`);
    } finally {
      setApplying(false);
    }
  };

  if (error) {
    return (
      <div className="ao-dialog">
        <p className="ao-hint">{error}</p>
        <div className="soup-ext-buttons">
          <Button variant="forest" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }
  if (!rows) return <p className="ao-hint">Looking at your Library...</p>;

  return (
    <div className="ao-dialog">
      {result ? (
        <p className="ao-done" role="status">
          Done: {result.done} organized{result.failed ? `, ${result.failed} could not be (see Activity)` : ""}. Each one has an Undo in the Organizer tab.
        </p>
      ) : (
        <p className="ao-hint">
          {todo.length === 0 ? "Nothing to change: every replay already follows the rules." : `${todo.length} of ${rows.length} replay${rows.length === 1 ? "" : "s"} would change. Nothing has been changed yet.`}
          {backup && todo.length > 0 ? " Their files are also copied to the backup folder." : ""}
        </p>
      )}
      <ul className="ao-preview" aria-label="What would change">
        {rows.map(({ replay, plan, skip }) => (
          <li key={replay.id} className={plan ? "ao-change" : "ao-same"} data-replay={replay.id}>
            <span className="ao-from">{replay.name}</span>
            {plan ? (
              <span className="ao-to">
                {plan.move ? `to ${plan.to.folderPath.join("/") || "the top"}${plan.to.folderExists ? "" : " (new folder)"}` : ""}
                {plan.move && plan.rename ? ", " : ""}
                {plan.rename ? `renamed "${plan.to.name}"` : ""}
              </span>
            ) : (
              <span className="ao-hint">{skip}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="soup-ext-buttons">
        <Button variant="outline" size="sm" onClick={onClose}>
          {result ? "Close" : "Cancel"}
        </Button>
        {!result && (
          <Button variant="forest" size="sm" disabled={todo.length === 0 || applying} onClick={() => void apply()}>
            {applying ? "Organizing..." : `Apply to ${todo.length}`}
          </Button>
        )}
      </div>
    </div>
  );
}

class PreviewModal extends Modal {
  private root: Root | null = null;
  onOpen() {
    this.setTitle("Organize existing replays");
    this.root = createRoot(this.contentEl);
    this.root.render(<PreviewBody onClose={() => this.close()} />);
  }
  onClose() {
    this.root?.unmount();
    this.root = null;
  }
}

export function openPreview(): void {
  new PreviewModal().open();
}
