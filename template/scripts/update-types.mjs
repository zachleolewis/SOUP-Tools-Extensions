// Downloads the newest typings for the `soup` module into types/soup.d.ts. Run `npm run update-types` after a SOUP update.
import { mkdirSync, writeFileSync } from "node:fs";

const url = "https://raw.githubusercontent.com/zachleolewis/SOUP-Tools-Extensions/main/types/soup.d.ts";
const res = await fetch(url);
if (!res.ok) {
  console.error(`Could not download ${url}: ${res.status}`);
  process.exit(1);
}
mkdirSync("types", { recursive: true });
writeFileSync("types/soup.d.ts", await res.text());
console.log("types/soup.d.ts updated");
