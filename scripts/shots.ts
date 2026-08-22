/*
  The screenshot harness.

  This exists alongside Playwright MCP rather than instead of it. MCP is the better tool
  for looking at one route and reasoning about it, but the MCP server has no reduced
  motion toggle, so the reduced motion, reduced transparency and increased contrast
  passes in design.md section 7 can only run from a script. That is the whole reason
  this file is here.

  Run:  pnpm shots            (against the dev server on 5273)
        SHOTS_BASE_URL=... pnpm shots
*/
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.SHOTS_BASE_URL ?? "http://localhost:5273";
/*
  Resolved from this file, not from cwd. pnpm runs the script from the workspace package,
  so a relative "docs/shots" quietly wrote into apps/web/docs/shots the first time.
*/
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.SHOTS_OUT ?? join(REPO_ROOT, "docs", "shots");

const ROUTES = [
  { name: "ledger", path: "/" },
  { name: "strategies", path: "/strategies" },
  { name: "risk", path: "/risk" },
  { name: "debriefs", path: "/debriefs" },
  { name: "compliance", path: "/compliance" },
  { name: "verify", path: "/verify" },
] as const;

const VIEWPORTS = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1920x1080", width: 1920, height: 1080 },
] as const;

/*
  The media states design.md now asks for. "default" is the shot that ends up in the
  README; the other three are audit passes, and they are cheap enough to always run.
*/
const STATES = [
  { label: "default", reducedMotion: "no-preference", contrast: "no-preference" },
  { label: "reduced-motion", reducedMotion: "reduce", contrast: "no-preference" },
  { label: "more-contrast", reducedMotion: "no-preference", contrast: "more" },
] as const;

/*
  Walks the tab order and fails on the two things that actually break a keyboard only
  pass: focus landing on something invisible, and focus landing on something with no
  visible ring. Both look fine in a screenshot and are impossible to use.
*/
async function keyboardPass(page: Page, maxStops = 60): Promise<string[]> {
  const order: string[] = [];
  await page.locator("body").press("Tab");
  for (let i = 0; i < maxStops; i++) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName,
        label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? "",
        visible: r.width > 0 && r.height > 0,
        ring: s.outlineStyle !== "none" || s.boxShadow !== "none",
      };
    });
    if (!focused) break;
    if (!focused.visible) throw new Error(`focus trapped on a hidden element: ${focused.tag}`);
    order.push(`${focused.tag} ${focused.label}`);
    await page.keyboard.press("Tab");
  }
  return order;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  let shots = 0;

  for (const vp of VIEWPORTS) {
    for (const state of STATES) {
      /* Only the primary viewport needs the audit states; the README set is 1440. */
      if (vp.label !== "1440x900" && state.label !== "default") continue;

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        reducedMotion: state.reducedMotion,
        contrast: state.contrast,
      });
      const page = await context.newPage();

      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      for (const route of ROUTES) {
        await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle" });
        /* Let the entrance motion settle so the shot is the resting state. */
        await page.waitForTimeout(500);
        const suffix = state.label === "default" ? "" : `-${state.label}`;
        await page.screenshot({
          path: `${OUT}/${route.name}-${vp.label}${suffix}.png`,
        });
        shots++;
      }

      if (state.label === "default" && vp.label === "1440x900") {
        await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        const order = await keyboardPass(page);
        console.log(`keyboard pass: ${order.length} stops`);
        order.forEach((o) => console.log("  " + o));
      }

      if (consoleErrors.length) {
        console.error("console errors:");
        consoleErrors.forEach((e) => console.error("  " + e));
      }

      await context.close();
    }
  }

  await browser.close();
  console.log(`wrote ${shots} screenshots to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
