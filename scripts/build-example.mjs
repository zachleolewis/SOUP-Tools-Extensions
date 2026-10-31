// Builds an example the way the template does: one ES module main.js that reads `soup` and React from SOUP (soup-externals.mjs),
// styles.css when the example has styles, and manifest.json next to them. The result is a folder SOUP can install ("From a folder").
//
//   node scripts/build-example.mjs examples/hello-world      -> dist/hello-world/
//   node scripts/build-example.mjs --all                     -> every folder under examples/

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { soupExternals } from "./soup-externals.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function buildExample(dir) {
  const src = path.resolve(root, dir);
  const entry = ["src/main.tsx", "src/main.ts"].map((f) => path.join(src, f)).find((f) => existsSync(f));
  if (!entry) throw new Error(`${dir} has no src/main.tsx or src/main.ts`);
  const name = path.basename(src);
  const out = path.join(root, "dist", name);
  const tmp = path.join(root, "dist", `.${name}-build`);
  rmSync(out, { recursive: true, force: true });
  await build({
    root: src,
    configFile: false,
    logLevel: "warn",
    plugins: [soupExternals(), react({ jsxRuntime: "automatic" })],
    build: { outDir: tmp, emptyOutDir: true, minify: false, cssCodeSplit: false, lib: { entry, formats: ["es"], fileName: () => "main.js", cssFileName: "styles" } },
  });
  mkdirSync(out, { recursive: true });
  cpSync(path.join(tmp, "main.js"), path.join(out, "main.js"));
  const css = readdirSync(tmp).find((f) => f.endsWith(".css"));
  if (css) cpSync(path.join(tmp, css), path.join(out, "styles.css"));
  cpSync(path.join(src, "manifest.json"), path.join(out, "manifest.json"));
  rmSync(tmp, { recursive: true, force: true });
  return out;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node scripts/build-example.mjs <examples/name> | --all");
  process.exit(2);
}
const dirs = args[0] === "--all" ? readdirSync(path.join(root, "examples"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => `examples/${e.name}`) : [args[0]];
for (const d of dirs) {
  const out = await buildExample(d);
  console.log(`built ${d} -> ${path.relative(root, out)}`);
}
