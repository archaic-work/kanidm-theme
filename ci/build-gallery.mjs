import fs from "node:fs";
import path from "node:path";

const images = [];
const walk = (directory, kind) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename, kind);
    if (entry.isFile() && /\.png$/i.test(entry.name)) {
      images.push({
        path: filename.split(path.sep).join("/"),
        kind,
        name: entry.name.replace(/\.png$/i, ""),
      });
    }
  }
};
walk("screenshots", "capture");
walk("test-results", "test-result");
images.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  generated_at: new Date().toISOString(),
  kaniop_release: process.env.KANIOP_RELEASE ?? null,
  kanidm_version: process.env.KANIDM_VERSION ?? null,
  repository_ref: process.env.GITHUB_SHA ?? null,
  images,
};
fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[s]);

const gallery = images.map((item) =>
  '<article class="item"><a href="' + escapeHtml(item.path) + '">' +
  '<img src="' + escapeHtml(item.path) + '" loading="lazy" alt="' +
  escapeHtml(item.name) + '"></a>' +
  '<div class="meta"><strong>' + escapeHtml(item.name) + '</strong>' +
  '<span>' + escapeHtml(item.path) + '</span></div></article>'
).join("\n");

const html = [
  '<!doctype html><html lang="en"><head>',
  '<meta charset="utf-8"><meta name="viewport" content="width=device-width">',
  '<title>Kanidm UI visual inventory</title>',
  '<style>',
  ':root { color-scheme: light dark; font-family: system-ui, sans-serif; }',
  'body { max-width: 1400px; margin: 0 auto; padding: 2rem 1.2rem; }',
  'h1 { font-size: 1.6rem; } p { opacity: .7; }',
  '.grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,420px),1fr)); gap: 1.4rem; }',
  '.item { border: 1px solid #8797a448; border-radius: .7rem; overflow: hidden; }',
  '.item img { display: block; width: 100%; object-fit: contain; object-position: top; }',
  '.meta { display: flex; flex-direction: column; gap: .25rem; padding: .8rem 1rem; word-break: break-all; }',
  '.meta span { font-size: .75rem; opacity: .7; }',
  '</style></head><body><h1>Kanidm visual inventory</h1>',
  '<p>kaniop: ' + escapeHtml(manifest.kaniop_release ?? "unknown") +
    ' · Kanidm: ' + escapeHtml(manifest.kanidm_version ?? "unknown") +
    ' · ' + images.length + ' images</p>',
  '<div class="grid">' + (gallery || '<p>No screenshots produced.</p>') + '</div></body></html>',
].join("\n");
fs.writeFileSync("index.html", html);
console.log("Generated screenshot gallery with " + images.length + " images");
