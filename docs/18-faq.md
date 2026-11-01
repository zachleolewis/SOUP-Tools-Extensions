# 18. FAQ

**Is it safe to install extensions?** Only as safe as the person who wrote it. SOUP does not review or sandbox extensions ([guide 17](17-responsibility.md)). Install only from people you trust.

**Why is nothing loading?** Restricted mode is on (the default), or SOUP was started with Shift held. Settings > Extensions.

**Can an extension use my Riot account?** Yes, if it is enabled: through SOUP it can read the account's tokens and call Riot's services as the account. Extensions that say they use the account get an extra warning when you install them. Riot's rules apply to whatever they do.

**How do I write one?** [Getting started](01-getting-started.md). You write TypeScript, build with the template, and link the `dist/` folder in SOUP.

**Do I have to use TypeScript or React?** No. `main.js` is a plain ES module; the template uses TypeScript and Vite because they give you the typings. Use `mount(el)` with any framework you bundle yourself, or no framework.

**Can I use npm packages?** Yes: they are bundled into `main.js` by the build. Do not bundle React yourself: import `react` and SOUP's copy is used (the template does this). Keep the bundle small.

**Is there a store or a list of extensions?** No. People find extensions on GitHub and in the community. A community list may come later.

**Can I sell an extension, or ask for donations?** Yes. `fundingUrl` in the manifest is shown on the extension's Info page and in the install dialog. SOUP takes no part in payments.

**Can an extension add a new window or overlay?** A separate window, yes ([guide 12](12-windows.md)). It cannot draw inside VALORANT.

**Can I change how SOUP's own screens look?** Add to them through the extension points ([guide 5](05-ui.md)). Changing SOUP's own components or CSS is unsupported and will break.

**Can I call the Riot Client's local API directly from my web page?** No (CORS and certificates); use `app.riot.local` or `app.requestUrl` with `allowSelfSigned` for a local server of your own.

**An update broke my extension.** Check [guide 16](16-stability-and-versioning.md): are you using something that is not in `soup.d.ts`? If it is in the typings, open an issue. Users can **Roll back** to the previous version of your extension.

**Where is my extension's data?** `app.paths.dataDir` (per profile) and `app.paths.machineDir` (every profile). Removing the extension asks whether to delete them.

**Does it work on macOS or Linux?** SOUP is a Windows app. Parts of the API (`openPath`, programs, the clipboard) are Windows-only.

**The install dialog says "unknown author".** The `author` field of the manifest is whatever the author wrote. SOUP does not verify it; the source (the repository) is what to check.

**How do I get the newest typings?** `npm run update-types` in your project.

**How do I report a bug in SOUP or in these docs?** Open an issue in this repository.
