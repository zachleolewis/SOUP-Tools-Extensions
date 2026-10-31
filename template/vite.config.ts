// Builds the extension into dist/: main.js (one ES module), styles.css (when you import CSS) and manifest.json. Everything in
// static/ (a page for app.ui.openWindow, images, a helper program) is copied into dist/ as it is.
//
// `soup`, `react`, `react/jsx-runtime` and `react-dom` are not bundled: soup-externals.mjs turns them into reads of what SOUP provides
// when it loads the extension, so your extension uses SOUP's own React (one copy, hooks work) and needs no import map.
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { soupExternals } from "./soup-externals.mjs";

export default defineConfig({
  plugins: [
    soupExternals(),
    react({ jsxRuntime: "automatic" }),
    {
      name: "copy-manifest-and-static",
      writeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync("manifest.json", "dist/manifest.json");
        if (existsSync("static")) cpSync("static", "dist", { recursive: true });
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    cssCodeSplit: false,
    lib: { entry: "src/main.ts", formats: ["es"], fileName: () => "main.js", cssFileName: "styles" },
  },
});
