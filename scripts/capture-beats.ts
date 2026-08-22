/*
  Screen captures for every product beat in videoscript.md.

    pnpm --filter @continuity/web exec tsx ../../scripts/capture-beats.ts

  Separate from scripts/shots.ts, which audits the design. This one exists for the edit:
  1440p, UI at 125 percent, pointer hidden, keyboard driven, one file per beat named after
  the scene it belongs to.

  Every beat ASSERTS what it is capturing before it captures it. A screen take of a state
  that never arrived is worse than a missing one, because it looks finished and gets cut
  into the video before anybody notices the number is wrong.
*/
import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env["SHOTS_BASE_URL"] ?? "http://localhost:5273";
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "docs", "beats");

/* What the freeze says the screen should be showing. */
const freeze = JSON.parse(
  readFileSync(join(REPO, "docs", "demo-freeze.json"), "utf8"),
) as { events: number; decisions: number; seed: number };

type Beat = {
  scene: string;
  name: string;
  path: string;
  /* Drive the state, then assert it arrived. Throwing here fails the run. */
  act: (page: Page) => Promise<void>;
  fullPage?: boolean;
};

const BEATS: Beat[] = [
  {
    scene: "1",
    name: "draft-card-waiting",
    path: "/",
    act: async (page) => {
      await page.getByText("Waiting for you").first().waitFor();
      const filed = await page.getByText(`${freeze.events} records`).first().isVisible();
      if (!filed) throw new Error("the ledger is not showing the frozen record count");
      await page.waitForTimeout(500);
    },
  },
  {
    scene: "1",
    name: "approve-keystroke",
    path: "/",
    act: async (page) => {
      /* The count next to "Waiting for you". Read before and after so the assertion is
         about the queue actually shrinking rather than about a pill appearing. */
      const count = () => page.locator('h2:has-text("Waiting for you") + span').innerText();
      const before = await count().catch(() => "");
      await page.keyboard.press("a");
      await page.getByText("Filed. It cannot be changed now.").waitFor({ timeout: 5000 });
      const after = await count().catch(() => "");
      if (before && before === after) throw new Error("pressing A did not change the queue");
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "1",
    name: "transcript-lands",
    path: "/",
    act: async (page) => {
      await page.getByRole("button", { name: "Use a sample" }).click();
      await page.getByText(/turns, \d+ speakers?/).waitFor();
      await page.getByText("Import a meeting transcript").scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "2",
    name: "departure-simulation",
    path: "/risk",
    fullPage: true,
    act: async (page) => {
      await page.getByRole("button", { name: /Daniel Okonkwo/ }).click();
      /* The money shot. If the exposure figure is not on screen the take is worthless. */
      await page.getByText(/of attributed annual revenue/).waitFor({ timeout: 10_000 });
      await page.getByText(/decisions only Daniel Okonkwo has recorded/).waitFor();
      await page.waitForTimeout(800);
    },
  },
  {
    scene: "2",
    name: "risk-board-cold",
    path: "/risk",
    act: async (page) => {
      await page.getByText("Firm knowledge risk").waitFor();
      await page.waitForTimeout(600);
    },
  },
  {
    scene: "3",
    name: "exit-debrief",
    path: "/debriefs",
    fullPage: true,
    act: async (page) => {
      await page.getByText("exit debrief").first().waitFor();
      await page.getByText(/grounded in a recorded meeting|grounded in a captured artifact/)
        .first()
        .waitFor();
      await page.waitForTimeout(500);
    },
  },
  {
    scene: "3",
    name: "promote-to-decision",
    path: "/debriefs",
    act: async (page) => {
      const promote = page.getByRole("button", { name: "promote to a decision" }).first();
      await promote.scrollIntoViewIfNeeded();
      await promote.click();
      await page.getByText("File this answer as a decision").waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "3",
    name: "ask-the-departed",
    path: "/debriefs",
    fullPage: true,
    act: async (page) => {
      await page.getByRole("button", { name: "why is the expiry window capped" }).click();
      await page
        .getByText(/own words, retrieved from the ledger|never wrote anything/)
        .waitFor({ timeout: 180_000 });
      await page.waitForTimeout(600);
    },
  },
  {
    scene: "3",
    name: "handover-pack",
    path: "/compliance",
    fullPage: true,
    act: async (page) => {
      await page.getByRole("button", { name: /Daniel Okonkwo/ }).click();
      await page.getByText("Handover pack: Daniel Okonkwo").waitFor();
      await page.getByText("bus factor of one").waitFor();
      await page.waitForTimeout(500);
    },
  },
  {
    scene: "3",
    name: "ask-bar-cited",
    path: "/",
    act: async (page) => {
      await page.keyboard.press("Meta+k");
      await page.locator('[role="dialog"] input').waitFor();
      await page.locator('[role="dialog"] input').fill("why is the expiry window capped");
      await page.getByText(/passages? from the ledger/).waitFor({ timeout: 180_000 });
      await page.waitForTimeout(500);
    },
  },
  {
    scene: "4",
    name: "verify-sweep-clean",
    path: "/verify",
    act: async (page) => {
      await page.getByRole("button", { name: /^Verify \d+ events$/ }).click();
      await page.getByText(new RegExp(`All ${freeze.events} events verify`)).waitFor({
        timeout: 20_000,
      });
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "4",
    name: "verify-tamper-halt",
    path: "/verify",
    act: async (page) => {
      await page.getByRole("button", { name: /tampered chain/ }).click();
      await page.getByText(/Chain broken at event/).waitFor({ timeout: 20_000 });
      await page.waitForTimeout(500);
    },
  },
  {
    scene: "4",
    name: "anchor-receipt",
    path: "/verify",
    fullPage: true,
    act: async (page) => {
      await page.getByText("Anchor receipt").waitFor();
      /*
        first(), because "Merkle root" appears both as the field label and in the
        paragraph explaining why a root is anchored rather than each event. Playwright's
        strict mode refused the ambiguous selector, which is the correct behaviour and is
        how this beat failed loudly instead of capturing whichever element it felt like.
      */
      await page.getByText(/Merkle root/).first().waitFor();
      /* And assert the receipt itself is on screen, not just the heading. */
      await page.getByText(/bytes$/).first().waitFor();
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "4",
    name: "compliance-checkpoint",
    path: "/compliance",
    act: async (page) => {
      await page.getByRole("button", { name: /^Export$/ }).click();
      await page.getByLabel("Reason for export").fill("FCA thematic review, sample of five");
      await page.waitForTimeout(400);
    },
  },
  {
    scene: "4",
    name: "my-record",
    path: "/my-record",
    act: async (page) => {
      await page.getByText("My record").first().waitFor();
      await page.waitForTimeout(400);
    },
  },
];

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    /* 1440p at 125 percent, per the script. deviceScaleFactor gives the retina capture;
       the zoom is what makes text readable when the video is watched on a phone. */
    viewport: { width: 1152, height: 720 },
    deviceScaleFactor: 2.5,
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  /* Warm the retrieval index once so no single beat pays for it inside its own timeout. */
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.keyboard.press("Meta+k");
  await page.locator('[role="dialog"] input').waitFor();
  await page.locator('[role="dialog"] input').fill("warming the retrieval index");
  await page
    .getByText(/passages? from the ledger|Nothing in the corpus|unavailable/)
    .waitFor({ timeout: 300_000 });
  await page.keyboard.press("Escape");

  const captured: { scene: string; name: string; file: string }[] = [];
  const failed: string[] = [];

  for (const beat of BEATS) {
    await page.goto(`${BASE}${beat.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const file = `scene${beat.scene}-${beat.name}.png`;
    try {
      await beat.act(page);
    } catch (err) {
      /* A beat that cannot be driven is a beat the video cannot use, and saying so is the
         whole reason each one asserts before it captures. */
      failed.push(`scene ${beat.scene} ${beat.name}: ${(err as Error).message.split("\n")[0]}`);
      continue;
    }
    await page.screenshot({ path: join(OUT, file), fullPage: beat.fullPage ?? false });
    captured.push({ scene: beat.scene, name: beat.name, file });
    console.log(`  scene ${beat.scene}  ${beat.name}`);
  }

  await context.close();
  await browser.close();

  await writeFile(
    join(OUT, "manifest.json"),
    JSON.stringify(
      {
        captured_at: new Date().toISOString(),
        seed: freeze.seed,
        frozen_events: freeze.events,
        viewport: "1152x720 at 2.5x, which is 1440p at 125 percent",
        beats: captured,
        failed,
      },
      null,
      2,
    ) + "\n",
  );

  console.log("");
  console.log(`${captured.length} of ${BEATS.length} beats captured to docs/beats/`);

  if (errors.length) {
    console.error("console errors during capture:");
    for (const e of [...new Set(errors)]) console.error("  " + e.slice(0, 160));
    process.exitCode = 1;
  }
  if (failed.length) {
    console.error("");
    for (const f of failed) console.error("  BEAT NOT CAPTURED  " + f);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
