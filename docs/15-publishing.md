# 15. Publishing

An extension is published as a **GitHub release**. People install it from `owner/name`; SOUP finds the release itself.

## The release

A release of `your-name/your-extension` must carry:

| Asset | |
|---|---|
| `manifest.json` | Required |
| `main.js` | Required |
| `styles.css` | Only if you have styles |
| `extension.zip` | Optional: `manifest.json`, `main.js`, `styles.css` and any other files (images, a helper program, `panel.html`) in one zip. **If it is there, SOUP uses it and ignores the loose files**; if you ship extra files you must use it |

and a **tag that equals the manifest's `version`** (`v1.2.0` or `1.2.0` for version `1.2.0`). SOUP refuses a release whose tag and manifest disagree.

The template's `.github/workflows/release.yml` does all of it: push a tag and the release appears.

```
npm version minor        # or edit manifest.json by hand
git commit -am "1.1.0"
git tag v1.1.0
git push --follow-tags
```

(`package.json`'s version and `manifest.json`'s version are separate; the manifest is the one that counts. Keep them in step if you like.)

Rules of thumb:

- A release is **immutable** in practice. Do not replace the files of a tag people already installed; publish a new version.
- Write release notes: the install dialog shows the README, and people read the release page.
- Keep it small. SOUP refuses a zip that unpacks to more than 200 MB (or has more than 5 000 files) and a loose file over 50 MB; an extension of a few kilobytes loads instantly.

## Versions

Use [semantic versioning](https://semver.org): fix = patch, new feature = minor, a change that breaks saved data or an `api` others use = major. Add `minAppVersion` when you start using something from a newer SOUP.

`dependencies` ranges in other manifests are matched against your version, so a major bump is the way to say "this breaks people who depend on my api".

## The `repo` field

Put `"repo": "owner/name"` in the manifest. Extensions installed from GitHub always remember their repository; the field also lets SOUP check for updates when someone installs from a zip or folder first.

## Updates

SOUP looks for new releases of installed GitHub extensions when it starts and every six hours (one switch in Settings > Extensions turns that off). When one is newer than the installed version, the extension's row says **Update available** and an **Update** button opens the install dialog again ("Replaces Scrim Notes 1.0.0 by Author"). A person can switch **Update by itself** on for an extension; then SOUP installs the newer release without asking, keeping the extension on or off as it was.

SOUP keeps the previous version. **Roll back** on the row puts it back. Settings saved with `saveData` stay; if your new version changes their shape, read old shapes in `onload`.

## Changelog

SOUP does not show a changelog of its own. Put what changed in the GitHub release notes and your README.

## Getting known

There is no directory and no review: SOUP does not list or approve extensions. Tell people where it is: your repository's README, Discord, a post. The README should say what the extension does, which of the things in [guide 17](17-responsibility.md) it uses (Riot, files, network, programs), and how to install it:

```
In SOUP: Settings > Extensions > From GitHub > your-name/your-extension
```

## Checklist

- [ ] `id` is unique and stable (changing it makes a new extension)
- [ ] `version` bumped, tag equals it
- [ ] `minAppVersion` and `apiVersion` are right
- [ ] Release has `manifest.json` and `main.js` (and the zip if you need other files)
- [ ] The README says what it does and what it touches
- [ ] Installed from the release on a clean profile once
