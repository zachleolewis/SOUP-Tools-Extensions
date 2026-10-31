import { Notice, Plugin } from "soup";

export default class MyExtension extends Plugin {
  async onload() {
    // A command in SOUP's command palette (Ctrl+K). Everything you add here is removed again when the extension unloads.
    this.addCommand({
      id: "say-hello",
      name: "My Extension: say hello",
      callback: () => {
        new Notice("Hello from my extension");
      },
    });

    // A tab in SOUP's navigation. `mount(el)` fills a plain element; use `component` for a React component instead.
    this.addTab({
      id: "main",
      label: "My Extension",
      mount: (el) => {
        el.textContent = "It works.";
      },
    });

    this.app.log.info("my-extension loaded");
  }

  onunload() {
    this.app.log.info("my-extension unloading");
  }
}
