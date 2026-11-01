# 11. Files and programs

## app.fs

The whole file system, any path. A **relative** path starts in your `dataDir` (see [settings and data](06-settings-and-data.md#files-datadir-machinedir-and-tempdir)).

```ts snippet
const dir = app.paths.dataDir;

await app.fs.write(`${dir}/notes.txt`, "first line\n"); // creates the folders it needs
await app.fs.append(`${dir}/notes.txt`, "second line\n");
const text = await app.fs.readText(`${dir}/notes.txt`);

const bytes = await app.fs.read(`${dir}/notes.txt`); // Uint8Array
await app.fs.write(`${dir}/copy.bin`, bytes);

for (const entry of await app.fs.list(dir)) {
  app.log.info(`${entry.isDir ? "dir " : "file"} ${entry.name} ${entry.size} bytes`);
}

const st = await app.fs.stat(`${dir}/notes.txt`); // { exists, isFile, isDir, size, modifiedMs }
if (await app.fs.exists(`${dir}/old`)) await app.fs.remove(`${dir}/old`, { recursive: true });

await app.fs.mkdir(`${dir}/a/b/c`);
await app.fs.copy(`${dir}/a`, `${dir}/a-copy`); // folders are copied with everything in them
await app.fs.rename(`${dir}/notes.txt`, `${dir}/archive/notes.txt`);
void [text, st];
```

Failures reject with the error code `fs_failed` (missing file, access denied, a folder that is not empty and no `recursive`).

### Watching

```ts snippet
const watcher = await app.fs.watch(app.paths.valorantDemos, (e) => {
  // e.kind is "created", "modified" or "removed"
  app.log.info(`${e.kind} ${e.path}`);
});
plugin.register(() => watcher.off());
```

SOUP checks the folder twice a second and reports files that were created, changed (size or time) or removed. It watches everything under the folder, up to 20 000 entries, so watch a narrow folder, not a whole drive. The watcher ends with `off()` or when your extension unloads.

### What SOUP logs

Writes, deletes and renames **outside your own folders** are logged at INFO (`[ext-<id>] writes outside its own folders: <path>`). Reads, and writes inside your own folders, are DEBUG lines. Nothing is blocked.

[`examples/auto-organizer`](../examples/auto-organizer/src/organizer.ts) uses `copy` for its backup: it makes the folder, never overwrites a file that is already there, and reports a folder that cannot be made as a normal failure.

## app.process

```ts snippet
// Run a program to the end and get what it printed.
const r = await app.process.exec("git", ["--version"]);
app.log.info(`exit ${r.code}: ${r.stdout}`);

// Start one and talk to it.
const child = await app.process.spawn("ping", ["-n", "3", "127.0.0.1"], { cwd: "C:/Windows", env: { MY_VAR: "1" } });
child.stdout.on((line) => app.log.info(line));
child.stderr.on((line) => app.log.warn(line));
const code = await child.wait();

await child.write("text for standard input\n");
await child.closeStdin();
await child.kill();
void code;

// Hand something to Windows' default program.
await app.process.openPath("C:/Users/me/Documents/report.pdf");
await app.process.openUrl("https://example.com");
```

- Programs start **hidden** (no console window) unless you pass `hidden: false`.
- Output arrives line by line. `child.stdout.on(cb)` first replays lines that arrived before you subscribed, so you do not miss the first lines of a fast program. `child.stdout.text()` gives everything so far (the last 5 000 lines).
- `wait()` resolves with the exit code after the last output line was delivered. A program that SOUP or you killed reports a non-zero code on Windows.
- **Non-detached programs are stopped when your extension unloads and when SOUP exits** (they are in a Windows job object, so even if SOUP is killed with End Task they go too). Pass `detached: true` for a program that should keep running; then it is your job to end it.
- Starting a program that does not exist rejects with `process_failed`.
- Every start is logged: `[ext-<id>] starts a process: <command> <args>`. Do not put secrets in arguments.

## Helper programs

When work is heavy, needs another language, or needs something a web page cannot do (a database, a socket, a native library), write a small program and talk to it over standard input and output. The common shape:

1. Ship the helper inside your extension: put `helper.exe` in the `static/` folder of the template and the build copies it next to `main.js`. That folder is `app.paths.codeDir`.
2. Start it with `app.process.spawn`.
3. One line = one message (JSON per line works well).
4. Read answers from `stdout`; log problems from `stderr`.

```ts
import { Plugin } from "soup";

export default class Helper extends Plugin {
  async onload() {
    const helper = await this.app.process.spawn(`${this.app.paths.codeDir}/helper.exe`, ["--mode", "stream"]);
    helper.stdout.on((line) => {
      const message = JSON.parse(line) as { kind: string };
      this.app.log.info(`helper says ${message.kind}`);
    });
    helper.stderr.on((line) => this.app.log.warn(`helper: ${line}`));
    await helper.write(JSON.stringify({ hello: "world" }) + "\n");
  }
}
```

A complete extension needs no helper of its own to try this: a PowerShell one-liner answers each line it reads with `echo:<line>`, so it runs on any Windows PC.

```ts
import { Notice, Plugin } from "soup";

export default class HelperProcess extends Plugin {
  async onload() {
    const script = "while (($l = [Console]::In.ReadLine()) -ne $null) { [Console]::Out.WriteLine('echo:' + $l) }";
    const helper = await this.app.process.spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);

    let heard = 0;
    helper.stdout.on((line) => {
      heard++;
      this.addStatusText(`heard ${heard} lines, last: ${line}`);
    });
    helper.stderr.on((line) => this.app.log.warn(`helper said on stderr: ${line}`));

    // The exit code arrives once the program ended (also when SOUP stopped it).
    void helper.wait().then((code) => this.app.log.info(`the helper ended with code ${code}`));

    this.addCommand({
      id: "say-hello",
      name: "Helper Process: send a line",
      callback: async () => {
        await helper.write("hello\n");
        new Notice("Sent hello to the helper");
      },
    });
  }
}
```

SOUP stops the program when the extension unloads or SOUP exits, so there is nothing to clean up. A helper that listens on a local port is also fine: reach it with `app.requestUrl("http://127.0.0.1:PORT/...")`.

## Opening files and folders

`app.dialog` shows the system pickers; `app.process.openPath` opens a path with its default program.

```ts snippet
const file = await app.dialog.openFile({ title: "Choose a replay", filters: [{ name: "Replays", extensions: ["vrf"] }] });
const many = await app.dialog.openFiles({ title: "Choose files" });
const folder = await app.dialog.openFolder({ title: "Choose a folder", defaultPath: app.paths.saveDir });
const target = await app.dialog.save({ title: "Save as", defaultPath: "report.csv", filters: [{ name: "CSV", extensions: ["csv"] }] });
void [file, many, folder, target]; // each is null (or an empty list) when the person cancels
```

## Clipboard

```ts snippet
await app.clipboard.writeText("copied");
const text = await app.clipboard.readText(); // null when the clipboard does not hold text
void text;
```

Reading and writing the clipboard is logged at INFO (not what is on it).
