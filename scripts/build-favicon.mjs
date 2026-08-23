/*
  Generate the favicon from the glyph, rather than drawing it twice.

  A hand drawn favicon is a second copy of the mark that nobody remembers to update, and it
  drifts within a release or two. This compiles the same twelve by twelve grid the icon set
  and the wordmark use, so the tab icon is the mark by construction.

  Run: node scripts/build-favicon.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "apps/web/src/components/pixel/PixelIcon.tsx";
const OUT = "apps/web/public/favicon.svg";

const src = readFileSync(SOURCE, "utf8");
const match = src.match(/ {2}link: \[\n([\s\S]*?)\n {2}\],/);
if (!match) throw new Error("could not find the link glyph in PixelIcon.tsx");

const grid = match[1]
  .split("\n")
  .map((l) => l.trim().replace(/^"|",?$/g, ""))
  .filter((l) => l && !l.startsWith("/*"));

if (grid.length !== 12 || grid.some((r) => r.length !== 12)) {
  throw new Error(`the link glyph is not 12x12: ${grid.length} rows`);
}

const rects = [];
grid.forEach((row, y) => {
  let x = 0;
  while (x < row.length) {
    if (row[x] === "#") {
      let w = 0;
      while (x + w < row.length && row[x + w] === "#") w++;
      rects.push(`<rect x="${x}" y="${y}" width="${w}" height="1"/>`);
      x += w;
    } else x++;
  }
});

writeFileSync(
  OUT,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" shape-rendering="crispEdges">
<style>
  .m { fill: #7aa7ff; }
  @media (prefers-color-scheme: light) { .m { fill: #2f6fe0; } }
</style>
<g class="m">${rects.join("")}</g>
</svg>
`,
);
console.log(`favicon: ${rects.length} rects from the link glyph`);
