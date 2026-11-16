import { readFileSync } from "node:fs";

const svg = readFileSync("assets/bouncer-mask.svg", "utf8").trim();
const css = readFileSync("override.css", "utf8");
const embedded = "data:image/svg+xml," + encodeURIComponent(svg);

if (!css.includes(embedded)) {
  console.error("Bouncer mask in override.css is out of sync with assets/bouncer-mask.svg");
  process.exit(1);
}
console.log("Bouncer SVG mask matches CSS data URI");
