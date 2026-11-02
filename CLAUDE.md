# SOUP-Tools-Extensions - notes for maintainers and agents

Public docs, typings, starter template and four example extensions for SOUP Tools extensions. The README is the public entry
point; `docs/` are the guides (numbered), `docs/api/README.md` is the generated reference.

## Commands

```
npm ci
npm run check            typecheck + logic tests + docs check + build every example (what CI runs)
npm run check:docs       type-checks every ts/tsx block in README.md and docs/*.md against types/soup.d.ts, and relative links
npm run build:example -- <name>
```

A docs code block is a complete file (```` ```ts ````) or a fragment (```` ```ts snippet ````, wrapped so `app` and `plugin`
exist); see the top of `scripts/check-docs.mjs`.

## Generated files: do not edit by hand

`types/soup.d.ts`, `template/types/soup.d.ts`, `template/soup-externals.mjs`, `scripts/soup-externals.mjs` and
`docs/api/README.md` are written by SOUP's `pnpm extension-api:publish` (in the private SOUP source repository) from SOUP's own
typings. To change the API or its comments, change SOUP and publish again. The Drive Sync extension keeps a copy of
`types/soup.d.ts`; refresh it when this one changes.

## Rules

- The docs describe what SOUP really does at the API version in `types/soup.d.ts`. When the API gains something, add it to the
  right guide in the same change, with a checked example.
- API version policy: additions are minor; a breaking change is a new major and the old major keeps working for one SOUP
  release (`docs/16-stability-and-versioning.md`).
- The examples are installed and driven by SOUP's own self-test (`pnpm selftest:examples`): keep their ids, settings and
  commands stable, or change the self-test in the same change.
- The list of approved extensions is not here: it is `zachleolewis/SOUP-Tools-Community-Extensions`
  (`docs/15-publishing.md` explains it).
- `docs/17-responsibility.md` (Riot's rules, user trust) is part of the listing rules; keep it in step with that repository's README.
- No private paths, tokens or secrets in this public repository. ASCII text.
