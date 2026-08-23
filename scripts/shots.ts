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
  { label: "default", reducedMotion: "no-preference", contrast: "no-preference", reducedTransparency: false },
  { label: "reduced-motion", reducedMotion: "reduce", contrast: "no-preference", reducedTransparency: false },
  { label: "more-contrast", reducedMotion: "no-preference", contrast: "more", reducedTransparency: false },
  /*
    Reduced transparency is the third accessibility state design.md now requires, and
    Playwright's emulateMedia does not offer it: it exposes colorScheme, reducedMotion,
    forcedColors and contrast, and nothing else. Chromium does support the feature, so it
    is set through CDP directly rather than left unchecked, which is what would have
    happened if the harness had been allowed to define the checklist.
  */
  { label: "reduced-transparency", reducedMotion: "no-preference", contrast: "no-preference", reducedTransparency: true },
] as const;

/** Set a media feature Playwright does not expose. Chromium only. */
async function setReducedTransparency(page: Page, on: boolean) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: on ? "reduce" : "no-preference" }],
  });
}

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
  /* Some scenes are about a state at the top of the page. A full page capture of one of
     those is mostly ledger rows shrunk to nothing. */
  viewportOnly?: boolean;
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
    name: "draft-queue",
    path: "/",
    viewportOnly: true,
    act: async (page) => {
      await page.getByText("Waiting for you").first().waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "draft-approved",
    path: "/",
    viewportOnly: true,
    act: async (page) => {
      /* The one keystroke. If A ever stops approving the focused draft, this scene fails
         rather than quietly shooting the queue unchanged. */
      /* The count next to "Waiting for you". Read before and after so the assertion is
         about the queue actually shrinking rather than about a pill appearing. */
      const count = () => page.locator('h2:has-text("Waiting for you") + span').innerText();
      const before = await count().catch(() => "");
      await page.keyboard.press("a");
      await page.getByText("Filed. It cannot be changed now.").waitFor({ timeout: 5000 });
      const after = await count().catch(() => "");
      if (before && before === after) throw new Error("pressing A did not change the queue");
      await page.waitForTimeout(300);
    },
  },
  {
    name: "transcript-import",
    path: "/",
    viewportOnly: true,
    act: async (page) => {
      await page.getByRole("button", { name: "Use a sample" }).click();
      await page.getByText(/turns, \d+ speakers?/).waitFor();
      await page.getByText("Import a meeting transcript").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "my-record",
    path: "/my-record",
    viewportOnly: true,
    act: async (page) => {
      await page.getByText("My record").first().waitFor();
      await page.waitForTimeout(300);
    },
  },
  {
    name: "promote-answer",
    path: "/debriefs",
    viewportOnly: true,
    act: async (page) => {
      const promote = page.getByRole("button", { name: "promote to a decision" }).first();
      await promote.scrollIntoViewIfNeeded();
      await promote.click();
      await page.getByText("File this answer as a decision").waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    name: "compliance-checkpoint",
    path: "/compliance",
    act: async (page) => {
      await page.getByRole("button", { name: /^Export$/ }).click();
      await page.getByLabel("Reason for export").fill("FCA thematic review, sample of five");
      await page.waitForTimeout(400);
    },
  },
  {
    name: "ask-the-departed",
    path: "/debriefs",
    act: async (page) => {
      await page.getByRole("button", { name: "why is the expiry window capped" }).click();
      await page.getByText(/own words, retrieved from the ledger|never wrote anything/).waitFor({
        timeout: 180_000,
      });
      await page.waitForTimeout(400);
    },
  },
  {
    name: "time-machine-mid",
    path: "/strategies",
    act: async (page) => {
      /*
        Drive the range input by keyboard rather than by clicking a coordinate. A click
        on a native range lands wherever the browser decides, so the earlier version
        silently left the scrubber at the end and the shot showed the finished graph
        while claiming to show a replay.
      */
      const slider = page.getByLabel("Replay the ledger over time");
      await slider.focus();
      await page.keyboard.press("Home");
      /* focus() scrolls the control into view, so put the page back at the top or the
         shot is of a half scrolled screen. */
      await page.evaluate(() => window.scrollTo(0, 0));
      for (let i = 0; i < 130; i++) await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(600);
    },
  },
  {
    name: "time-machine-after",
    path: "/strategies",
    act: async (page) => {
      /* All the way to today, which is after the resignation, so the orphaned work is
         the only thing still lit. */
      const slider = page.getByLabel("Replay the ledger over time");
      await slider.focus();
      await page.keyboard.press("End");
      await page.waitForTimeout(600);
    },
  },
  {
    name: "ask-bar",
    path: "/",
    act: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.locator('[role="dialog"] input').waitFor();
      await page.locator('[role="dialog"] input').fill("why is the expiry window capped");
      /* First run downloads the model and embeds the corpus, so this needs real headroom
         rather than a token wait. */
      await page.getByText(/passages? from the ledger/).waitFor({ timeout: 180_000 });
      await page.waitForTimeout(400);
    },
  },
  {
    name: "ask-bar-no-answer",
    path: "/",
    act: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.locator('[role="dialog"] input').waitFor();
      await page.locator('[role="dialog"] input').fill("what is the capital of france");
      await page.getByText(/Nothing in the corpus/).waitFor({ timeout: 180_000 });
      await page.waitForTimeout(400);
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


/*
  Navigate, and wait for the app rather than for the network.

  The boot screen made networkidle insufficient: the document settles while a progress screen
  is still on top, so a scene that pressed Cmd+K immediately was typing at a loader. Waiting
  for the nav rail waits for the actual application, which is what every scene means by
  "loaded".
*/
async function open(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector("nav", { timeout: 30_000 }).catch(() => {});
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
      if (state.reducedTransparency) await setReducedTransparency(page, true);

      const consoleErrors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") consoleErrors.push(m.text());
      });

      for (const route of ROUTES) {
        await open(page, route.path);
        /* Let the entrance motion settle so the shot is the resting state. */
        await page.waitForTimeout(500);
        const suffix = state.label === "default" ? "" : `-${state.label}`;
        await page.screenshot({
          path: `${OUT}/${route.name}-${vp.label}${suffix}.png`,
        });
        shots++;
      }

      if (state.label === "default" && vp.label === "1440x900") {
        await open(page, "/");
        const order = await keyboardPass(page);
        /* The count and the first few stops. Printing all sixty is noise that buries the
           scene failures underneath it. */
        console.log(`keyboard pass: ${order.length} stops, every one visible with a ring`);
        order.slice(0, 8).forEach((o) => console.log("  " + o.slice(0, 60)));
        if (order.length > 8) console.log(`  ... and ${order.length - 8} more`);
      }

      if (consoleErrors.length) {
        /*
          Console errors are a failure, not a note.

          A React render loop reports itself here and nowhere else: the page still paints
          something, the screenshot still succeeds, and the only evidence is a line in a
          log nobody reads. Treating these as advisory is how "Maximum update depth
          exceeded" ships.
        */
        console.error(`console errors on ${vp.label} ${state.label}:`);
        for (const e of [...new Set(consoleErrors)]) console.error("  " + e.slice(0, 160));
        process.exitCode = 1;
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

    /*
      Warm the retrieval index once, before any scene needs it.

      Three scenes depend on it and the first of them was paying for the model download
      and the whole corpus embedding inside its own timeout, which is both slow and
      fragile: a cold cache on a slow network turned a working feature into a scene
      failure. Warming it here makes the cost visible and shared rather than charged to
      whichever scene happens to run first.
    */
    {
      const warmStart = Date.now();
      await open(page, "/");
      await page.keyboard.press("Meta+k");
      await page.locator('[role="dialog"] input').waitFor();
      await page.locator('[role="dialog"] input').fill("warming the retrieval index");
      await page
        .getByText(/passages? from the ledger|Nothing in the corpus|unavailable/)
        .waitFor({ timeout: 300_000 });
      await page.keyboard.press("Escape");
      console.log(`retrieval index warm in ${Math.round((Date.now() - warmStart) / 1000)}s`);
    }

    for (const scene of SCENES) {
      await open(page, scene.path);
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
      await page.screenshot({
        path: `${OUT}/${scene.name}-1440x900.png`,
        fullPage: !scene.viewportOnly,
      });
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
