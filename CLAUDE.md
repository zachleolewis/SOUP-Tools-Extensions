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

## Documentation is part of the work

The SOUP Tools owner's rule (2026-11-02) for every agent and contributor in every SOUP Tools repository: keep the documentation
excellent, tidy and current, so the next person or agent can continue the work cold.

1. **Read before you work**: this repository's handover, index and decisions; do not re-derive or re-ask what is written down.
2. **Write as you go**: findings, measurements (with the command, data and machine), decisions (with the reason and who decided),
   dead ends and why, gotchas, and what you could not verify, in the document that owns the topic.
3. **One home per fact**: other documents link to it. Adding, moving or removing a document updates the index that lists it in the
   same commit.
4. **The owner's words are kept word for word**, then turned into numbered decisions; a decision changes by a new entry that
   supersedes the old one.
5. **Status lines and absolute dates** on every plan and spec; superseded documents are archived with a pointer.
6. **Close every session**: update the handover or progress notes, record what you noticed and left, say plainly what was not verified.
7. **A change that touches another SOUP Tools repository** updates that repository's documentation too.
8. **Tidy**: no stale TODOs, no docs or comments describing code that changed, ASCII text.
