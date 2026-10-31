// Helper Process: start a program next to SOUP, send it lines, read lines back. SOUP stops the program when the extension unloads or
// SOUP exits, so there is nothing to clean up.
//
// A real helper would be your own program shipped inside the extension (put the .exe in the extension's folder and start
// it from there, see docs/11-files-and-processes.md). To keep this example self-contained the helper here is a PowerShell
// one-liner that answers each line it reads with `echo:<line>`.
import { Notice, Plugin } from "soup";

export default class HelperProcess extends Plugin {
  async onload() {
    const script = "while (($l = [Console]::In.ReadLine()) -ne $null) { [Console]::Out.WriteLine('echo:' + $l) }";
    const helper = await this.app.process.spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);

    let heard = 0;
    helper.stdout.on((line) => {
      heard++;
      this.addStatusText(`heard ${heard} lines, last: ${line}`);
    });
    helper.stderr.on((line) => this.app.log.warn(`helper said on stderr: ${line}`));

    // The exit code arrives once the program ended (also when SOUP stopped it).
    void helper.wait().then((code) => this.app.log.info(`the helper ended with code ${code}`));

    this.addCommand({
      id: "say-hello",
      name: "Helper Process: send a line",
      callback: async () => {
        await helper.write("hello\n");
        new Notice("Sent hello to the helper");
      },
    });
  }
}
