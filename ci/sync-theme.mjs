import { readFileSync, writeFileSync } from "node:fs";

// Extract the canonical palette, typography and spacing without loading Oat
// or imposing its page shell on Kanidm's Bootstrap templates.
const canonical = readFileSync("assets/archaic-theme.css", "utf8");
const root = canonical.match(/^:root \{\n([\s\S]*?)^\}/m);
if (!root) throw new Error("Canonical :root token block missing");
const tokens = root[1].split("\n").filter(line =>
  /^  (?:color-scheme:|--archaic-|--font-)/.test(line),
);
if (!tokens.length || !tokens.some(line => line.includes("--archaic-paper:"))) {
  throw new Error("Canonical Heritage tokens missing");
}

const path = "override.css";
const css = readFileSync(path, "utf8");
const start = "/* BEGIN GENERATED HERITAGE TOKENS */";
const end = "/* END GENERATED HERITAGE TOKENS */";
const from = css.indexOf(start);
const to = css.indexOf(end);
if (from < 0 || to <= from) throw new Error("Generated token markers missing");
const block = [start, ":root {", ...tokens, "}", end].join("\n");
const updated = css.slice(0, from) + block + css.slice(to + end.length);
if (process.argv.includes("--check")) {
  if (updated !== css) throw new Error("Heritage tokens are out of sync; run node ci/sync-theme.mjs");
  console.log("Heritage tokens match the canonical stylesheet");
} else if (updated !== css) {
  writeFileSync(path, updated);
}
