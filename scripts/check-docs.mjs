// Type-checks every ```ts / ```tsx block in README.md and docs/*.md against types/soup.d.ts, and checks that relative links point at files.
//
// A block is compiled as its own module. Two kinds:
//   ```ts            a complete file: it imports what it uses and is compiled as written.
//   ```ts snippet    a fragment: its import lines are kept at the top and the rest is wrapped in
//                    `async function snippet(app: App, plugin: Plugin) { ... }`, so `app` and `plugin` can be used freely.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = path.join(root, ".doccheck");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const exampleReadmes = readdirSync(path.join(root, "examples"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(path.join(root, "examples", e.name, "README.md")))
  .map((e) => `examples/${e.name}/README.md`);
const files = ["README.md", "template/README.md", "examples/README.md", ...exampleReadmes, ...readdirSync(path.join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];
const origin = new Map(); // generated file -> [md file, first line of the block]
const generated = [];
const problems = [];

for (const rel of files) {
  const text = readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(tsx?)(?:\s+(snippet))?\s*$/.exec(lines[i]);
    if (!open) continue;
    const start = i + 1;
    const body = [];
    for (i = start; i < lines.length && !/^```\s*$/.test(lines[i]); i++) body.push(lines[i]);
    n++;
    let code = body.join("\n");
    if (open[2]) {
      const imports = body.filter((l) => /^\s*import\s/.test(l));
      const rest = body.filter((l) => !/^\s*import\s/.test(l));
      code = [`import type { App, Plugin } from "soup";`, ...imports, `export async function snippet(app: App, plugin: Plugin) {`, ...rest, `}`, `void snippet;`].join("\n");
    } else {
      code = `${code}\nexport {};`;
    }
    const name = `${rel.replace(/[\\/]/g, "_")}-${n}.${open[1]}`;
    const file = path.join(work, name);
    writeFileSync(file, code);
    origin.set(file, { md: rel, line: start, snippet: !!open[2], body });
    generated.push(file);
  }
  // Relative links must exist.
  for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const target = path.resolve(path.dirname(path.join(root, rel)), decodeURIComponent(m[1]));
    if (!existsSync(target)) problems.push(`${rel}: the link ${m[1]} points at nothing`);
  }
}

const options = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  baseUrl: root,
  paths: { soup: ["types/soup.d.ts"] },
  types: [],
};
const program = ts.createProgram([...generated, path.join(root, "types", "soup.d.ts")], options);
for (const d of ts.getPreEmitDiagnostics(program)) {
  if (!d.file || !origin.has(path.normalize(d.file.fileName))) {
    if (d.file && !d.file.fileName.endsWith("soup.d.ts") && !d.file.fileName.includes("node_modules")) problems.push(ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    continue;
  }
  const o = origin.get(path.normalize(d.file.fileName));
  const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
  const mdLine = o.snippet ? o.line + Math.max(0, line - 1 - o.body.filter((l) => /^\s*import\s/.test(l)).length) : o.line + line;
  problems.push(`${o.md}:${mdLine}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
}

rmSync(work, { recursive: true, force: true });
if (problems.length) {
  console.error(`check:docs found ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`check:docs: ${generated.length} code blocks type-check, links are fine (${files.length} files)`);
