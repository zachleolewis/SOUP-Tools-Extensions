# 3. The manifest

`manifest.json` sits next to `main.js`. SOUP reads it before it runs any code, and reports every problem at once (each one names the field), so you can fix them in one go.

```json
{
  "id": "heatmap",
  "name": "Heatmap",
  "version": "1.2.0",
  "minAppVersion": "2.3.0",
  "apiVersion": "^1.0",
  "description": "Kill heatmaps on the real minimap.",
  "author": "Your name",
  "authorUrl": "https://example.com",
  "fundingUrl": "https://example.com/sponsor",
  "repo": "your-github-name/heatmap",
  "links": [{ "label": "Documentation", "url": "https://example.com/heatmap/docs" }, { "label": "Support", "url": "https://example.com/heatmap/support" }],
  "dependencies": { "scrim-notes": "^1.0" },
  "optionalDependencies": {},
  "requiresModules": ["library"],
  "uses": ["filesystem"]
}
```

## Fields

| Field | Required | Rules |
|---|---|---|
| `id` | yes | 1 to 40 lowercase letters, digits and dashes; no leading or trailing dash. Not the id of a built-in module (`library`, `riot-client`, ...) and not starting with `soup`. It names your folders, your log lines and your events (`<id>/...`) |
| `name` | yes | At most 60 characters |
| `version` | yes | A version like `1.2.0` ([semver](https://semver.org)). A release tag must equal it |
| `minAppVersion` | yes | The oldest SOUP that can run it. A SOUP older than this shows the extension as blocked instead of loading it |
| `apiVersion` | yes | A range of the extension API versions you support, such as `^1.0`. The API version of SOUP must fall inside it ([versioning](16-stability-and-versioning.md)) |
| `description` | yes | At most 500 characters |
| `author` | yes | Shown in the install dialog and on the row |
| `authorUrl`, `fundingUrl` | no | `https://` links |
| `repo` | no | `owner/name` on GitHub. With it SOUP can look for updates ([publishing](15-publishing.md)) |
| `links` | no | Up to 6 links shown on the extension's Info page and in the install dialog, for your documentation, support or community: `[{ "label": "Documentation", "url": "https://..." }]`. A label is 1 to 40 characters and the `url` must be `https://`. A bad entry is reported like any other manifest problem. `authorUrl`, `repo` and `fundingUrl` ("Support the author") are shown there too |
| `dependencies` | no | Other extensions that must be on, with a version range. They load first; yours does not load without them |
| `optionalDependencies` | no | Other extensions to load first *if* they are installed and on |
| `requiresModules` | no | Built-in modules that must be on, for example `["library"]`. If one is off the extension is blocked, with the reason on its row |
| `uses` | no | Tags saying what you use: `riot`, `network`, `filesystem`, `processes`, `windows`, `clipboard`, `accounts` (sign-in and stored secrets, see [guide 19](19-accounts-and-sync.md)). They are shown to the person installing it. They are a statement, not a permission: SOUP does not enforce them. An extension that says `riot` gets an extra warning line in the install dialog |

Unknown fields are kept and ignored, so you can add your own.

## Version ranges

`^1.0` means 1.0.0 up to (not including) 2.0.0, `~1.2` means 1.2.x, `>=1.0 <2`, `1.x` and exact versions work too.

## A bad manifest

For example:

```
id: "My Extension" must be 1 to 40 lowercase letters, digits and dashes (no leading or trailing dash)
apiVersion: "latest" is not a version range like ^1.0
dependencies.scrim-notes: not a version range (use for example "^1.0")
```

SOUP refuses to install it, and nothing is left behind.
