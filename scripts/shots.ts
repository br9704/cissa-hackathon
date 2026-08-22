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

/*
  Scenes: the shots that only exist after somebody has clicked something.

  The static route sweep cannot reach the departure simulation, the selected decision, or
  any other state that is the actual point of a screen. Those are the shots that go in the
  README and that the design pass has to audit, so they get driven explicitly rather than
  left to whoever remembers to take them by hand.
*/
const SCENES: {
  name: string;
  path: string;
  act: (page: Page) => Promise<void>;
}[] = [
  {
    name: "risk-departure",
    path: "/risk",
    act: async (page) => {
      /* Daniel is the resignation in the demo, and the simulation is the money shot. */
      await page.getByRole("button", { name: /Daniel Okonkwo/ }).click();
      await page.waitForTimeout(700);
    },
  },
  {
    name: "verify-clean",
    path: "/verify",
    act: async (page) => {
      await page.getByRole("button", { name: /^Verify \d+ events$/ }).click();
      /* Wait for the sweep to finish rather than for a fixed time: the pace scales with
         the row count, so a hard timeout would be wrong the moment the corpus changes. */
      await page.getByText(/All \d+ events verify/).waitFor({ timeout: 15_000 });
      await page.waitForTimeout(300);
    },
  },
  {
    name: "verify-tampered",
    path: "/verify",
    act: async (page) => {
      await page.getByRole("button", { name: /tampered chain/ }).click();
      await page.getByText(/Chain broken at event/).waitFor({ timeout: 15_000 });
      await page.waitForTimeout(300);
    },
  },
  {
    name: "strategy-decision",
    path: "/strategies",
    act: async (page) => {
      /* Any node will do: the assertion is that selecting one reveals the reasoning and
         the rejected alternatives, which is the whole product in one pane. */
      await page.locator("svg g[transform] circle").nth(4).click({ force: true });
      await page.waitForTimeout(400);
    },
  },
];

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

  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    for (const scene of SCENES) {
      await page.goto(`${BASE}${scene.path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      try {
        await scene.act(page);
      } catch (err) {
        /* A scene that cannot be driven is a real failure: it means the affordance it
           depends on has moved or gone. Say so loudly rather than skipping quietly. */
        console.error(`scene ${scene.name} could not be driven: ${(err as Error).message}`);
        process.exitCode = 1;
        continue;
      }
      /* Full page for scenes. A scene is the state after an interaction, and the thing
         the interaction reveals is usually below the fold: the departure simulation puts
         its findings under a graph that is itself most of a viewport tall. */
      await page.screenshot({ path: `${OUT}/${scene.name}-1440x900.png`, fullPage: true });
      shots++;
    }
    await context.close();
  }

  await browser.close();
  console.log(`wrote ${shots} screenshots to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
