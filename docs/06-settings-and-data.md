# 6. Settings and data

An extension has two places to keep things: saved settings (`loadData` / `saveData`) and folders for files.

## loadData and saveData: per profile

```ts
import { Plugin } from "soup";

interface Data {
  greeting: string;
  runs: number;
}

export default class Saved extends Plugin {
  data: Data = { greeting: "Hello", runs: 0 };

  async onload() {
    // {} the first time, otherwise what saveData() stored for the ACTIVE profile.
    this.data = { ...this.data, ...(await this.loadData<Partial<Data>>()) };
    this.data.runs++;
    await this.saveData(this.data);
  }
}
```

- The data is any JSON object, at most 1 MB. It is stored in the profile's `config.json` under your extension's id, so it is exported with the profile (`.soupprofile`) and a duplicated profile starts with a copy.
- Each profile has its own. A person who plays with two teams gets two sets of settings.
- It is saved when you call `saveData`. Call it after each change, not on a timer.
- Save only what you need: a settings object, not a cache of everything you ever fetched.
- If you add fields in a new version, merge with defaults as above (`{ ...defaults, ...saved }`); old saved data will not have them.

## Files: dataDir, machineDir and tempDir

```ts snippet
const where = {
  perProfile: app.paths.dataDir, // %LOCALAPPDATA%\SOUP\profiles\<profile>\extensions\<id>
  perPC: app.paths.machineDir, // %LOCALAPPDATA%\SOUP\extensions-data\<id>
  scratch: app.paths.tempDir, // %LOCALAPPDATA%\SOUP\extensions-temp\<id>
};
await app.fs.write(`${where.perProfile}/notes.txt`, "hello");
```

| Folder | Use for |
|---|---|
| `dataDir` | Files that belong with the profile's settings: notes, caches that depend on the profile. **Relative paths in `app.fs` start here** |
| `machineDir` | Files that are the same for every profile: downloaded data, a model, a database |
| `tempDir` | Scratch files you can delete at any time |
| `codeDir` | Your extension's own folder, where `main.js` is. Read your bundled files from here (a helper program, a data file); do not write here, an update replaces the folder |

The first three are created for you. When the person removes your extension they are asked whether to delete its data too; if they say yes, `dataDir` of every profile and `machineDir` and `tempDir` go.

Other well-known folders: `app.paths.saveDir` (where the profile saves replays), `libraryRoot` (the profile's Library), `valorantDemos` (VALORANT's own Demos folder) and `vr3dDir` (3D assets).

## Settings UI

Show your settings with a [`SettingTab`](05-ui.md#settings), and save in each `onChange`.

## What not to do

- Do not write into SOUP's own folders (`%LOCALAPPDATA%\SOUP\config.json`, the `profiles` folder outside your own id): SOUP rewrites them and an extension that edits them can break a profile.
- Do not keep secrets (Riot tokens, someone's password) in `saveData` or in files. Tokens are short-lived and belong to the Riot Client; ask for them again when you need them ([Riot](09-riot.md)).
