/*
  The pixel icon system.

  Glyphs are authored as twelve strings of twelve characters, where '#' is a filled cell and
  anything else is empty, so the source reads like the picture it draws. That is the whole
  reason for the format: an SVG path for a twelve by twelve mark is unreadable and therefore
  uneditable, and an icon set nobody can edit stops matching the product within a month.

  Rendering merges each row's horizontal runs into one <rect height={1}>, which is both
  fewer nodes and the reason the shapes stay crisp: with shapeRendering="crispEdges" and an
  integer grid there is no antialiasing to soften a cell edge. fill="currentColor" means a
  glyph takes the colour of whatever it sits in, so there are no per icon colour props and
  nothing here can fork the design tokens.

  The grids are checked by PixelIcon.test.ts: exactly twelve rows of exactly twelve
  characters. A malformed grid renders as a smear rather than throwing, and a smear is the
  kind of defect that survives until somebody looks at a screenshot.
*/

export type GlyphName =
  | "record"
  | "graph"
  | "clock"
  | "chat"
  | "seal"
  | "shield"
  | "person"
  | "people"
  | "mic"
  | "waveform"
  | "inbox"
  | "upload"
  | "repo"
  | "note"
  | "chip"
  | "search"
  | "academy"
  | "rewind"
  | "link"
  | "book"
  | "spark"
  | "database";

const GLYPHS: Record<GlyphName, string[]> = {
  /* The ledger: a bound record, ruled. */
  record: [
    ".##########.",
    ".#........#.",
    ".#.######.#.",
    ".#........#.",
    ".#.######.#.",
    ".#........#.",
    ".#.####...#.",
    ".#........#.",
    ".#.######.#.",
    ".#........#.",
    ".##########.",
    "............",
  ],
  /* Genealogy: one decision, and the two that came out of it. */
  graph: [
    "....####....",
    "....####....",
    "......#.....",
    "..######....",
    "..#....#....",
    "..#....#....",
    "..#....#....",
    ".###..###...",
    ".###..###...",
    "............",
    "............",
    "............",
  ],
  /* Knowledge risk is a question of time: how long before the reasoning is gone. */
  clock: [
    "...######...",
    ".##......##.",
    "##...##...##",
    "#....##....#",
    "#....##....#",
    "#....#####.#",
    "#..........#",
    "#..........#",
    "##........##",
    ".##......##.",
    "...######...",
    "............",
  ],
  chat: [
    "############",
    "#..........#",
    "#.########.#",
    "#..........#",
    "#.######...#",
    "#..........#",
    "#.####.....#",
    "#..........#",
    "##.........#",
    ".##########.",
    "..##........",
    "...#........",
  ],
  /* Compliance: a seal, not another page. A page next to the ledger glyph reads as a
     duplicate at 20px, which is the size that actually ships. */
  seal: [
    "....####....",
    "..########..",
    ".##########.",
    "###......###",
    "##..####..##",
    "##..####..##",
    "##..####..##",
    "###......###",
    ".##########.",
    "..########..",
    "...#....#...",
    "..##....##..",
  ],
  shield: [
    "...######...",
    ".##########.",
    "############",
    "##........##",
    "##......#.##",
    "##.....##.##",
    "##.#..##..##",
    "##.##.#...##",
    ".##.###...##",
    "..##.#....#.",
    "...######...",
    ".....##.....",
  ],
  person: [
    "....####....",
    "...######...",
    "...######...",
    "....####....",
    "............",
    "..########..",
    ".##########.",
    "############",
    "##........##",
    "##........##",
    "##........##",
    "##........##",
  ],
  people: [
    "..##....##..",
    ".####..####.",
    ".####..####.",
    "..##....##..",
    "............",
    "#####..#####",
    "######..####",
    "###########.",
    "##.........#",
    "##.........#",
    "##.........#",
    "##.........#",
  ],
  mic: [
    "....####....",
    "...##..##...",
    "...##..##...",
    "...##..##...",
    "...##..##...",
    "...##..##...",
    ".#.##..##.#.",
    ".#........#.",
    ".##......##.",
    "..########..",
    ".....##.....",
    "...######...",
  ],
  waveform: [
    "............",
    ".....##.....",
    ".....##.....",
    "..#..##..#..",
    "..#..##..#..",
    "#.#.####.#.#",
    "#.#.####.#.#",
    "#.#.####.#.#",
    "..#..##..#..",
    "..#..##..#..",
    ".....##.....",
    "............",
  ],
  inbox: [
    "#..........#",
    "#..........#",
    "#..........#",
    "#..........#",
    "#...####...#",
    "####....####",
    "#..........#",
    "#..........#",
    "#..........#",
    "############",
    "............",
    "............",
  ],
  upload: [
    ".....##.....",
    "....####....",
    "...######...",
    "..########..",
    ".##..##..##.",
    ".....##.....",
    ".....##.....",
    "............",
    "#..........#",
    "#..........#",
    "############",
    "............",
  ],
  /* A repository: a branch leaving the trunk and coming back. */
  repo: [
    "..####......",
    "..####......",
    "...##.......",
    "...##.......",
    "...##..####.",
    "...##..####.",
    "...#####....",
    "...##.......",
    "...##.......",
    "..####......",
    "..####......",
    "............",
  ],
  note: [
    ".........###",
    "........####",
    ".......#####",
    "......###.##",
    ".....###..#.",
    "....###.....",
    "...###......",
    "..###.......",
    ".###........",
    "####........",
    "###.........",
    "#...........",
  ],
  /* The on-prem model. A chip, because it runs on a machine in the building. */
  chip: [
    "...#....#...",
    "...#....#...",
    ".##########.",
    ".#........#.",
    "##..####..##",
    ".#..#..#..#.",
    ".#..#..#..#.",
    "##..####..##",
    ".#........#.",
    ".##########.",
    "...#....#...",
    "...#....#...",
  ],
  search: [
    "..#####.....",
    ".##...##....",
    "##.....##...",
    "##.....##...",
    "##.....##...",
    ".##...##....",
    "..#####.....",
    "....####....",
    ".....####...",
    "......####..",
    ".......###..",
    "............",
  ],
  /* Academy: the institution inside the firm. */
  academy: [
    ".....##.....",
    "...######...",
    ".##########.",
    "############",
    ".##########.",
    "...######...",
    ".....##.....",
    "..#......#..",
    "..#......#..",
    "..#......#..",
    "..########..",
    "............",
  ],
  rewind: [
    "............",
    "......#..#..",
    ".....##.##..",
    "....###.###.",
    "...####.####",
    "..#####.####",
    "...####.####",
    "....###.###.",
    ".....##.##..",
    "......#..#..",
    "............",
    "............",
  ],
  /* Two links holding. The product in one glyph, and the logo. */
  link: [
    "............",
    "..#####.....",
    ".##...##....",
    "##.....##...",
    "##...#####..",
    "##...##..##.",
    ".##..##..##.",
    "..#####..##.",
    ".....##..##.",
    ".....##...##",
    "......#####.",
    "............",
  ],
  book: [
    "..##########",
    ".###.......#",
    "####.......#",
    "####.......#",
    "####.......#",
    "####.......#",
    "####.......#",
    "####.......#",
    "####.......#",
    ".###.......#",
    "..##########",
    "............",
  ],
  /* The spine. Stacked platters, which is the one shape everybody reads as a datastore. */
  database: [
    "..########..",
    ".##########.",
    "############",
    ".##########.",
    "..########..",
    "..#......#..",
    "..########..",
    ".##########.",
    "..########..",
    "..#......#..",
    "..########..",
    "..########..",
  ],
  spark: [
    ".....##.....",
    ".....##.....",
    "..#..##..#..",
    "...#.##.#...",
    "....####....",
    "##############".slice(0, 12),
    "....####....",
    "...#.##.#...",
    "..#..##..#..",
    ".....##.....",
    ".....##.....",
    "............",
  ],
};

export type Run = { x: number; y: number; w: number };

/* Merge each row's consecutive filled cells into a single rect. Computed once at module
   load, because the grids never change at runtime and a per render pass over 144 cells per
   icon adds up across a nav rail. */
function toRuns(grid: string[]): Run[] {
  const runs: Run[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] === "#") {
        let w = 0;
        while (x + w < row.length && row[x + w] === "#") w++;
        runs.push({ x, y, w });
        x += w;
      } else x++;
    }
  });
  return runs;
}

const RUNS: Record<GlyphName, Run[]> = Object.fromEntries(
  (Object.keys(GLYPHS) as GlyphName[]).map((k) => [k, toRuns(GLYPHS[k])]),
) as Record<GlyphName, Run[]>;

export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];
export function glyphGrid(name: GlyphName): string[] {
  return GLYPHS[name];
}
export function pixelRuns(name: GlyphName): Run[] {
  return RUNS[name];
}

export function PixelIcon({
  name,
  size = 20,
  title,
  className,
}: {
  name: GlyphName;
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      fill="currentColor"
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {RUNS[name].map((r) => (
        <rect key={`${r.x}-${r.y}-${r.w}`} x={r.x} y={r.y} width={r.w} height={1} />
      ))}
    </svg>
  );
}
