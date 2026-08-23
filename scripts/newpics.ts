/*
  A fresh set of screenshots for the repository, after the layout pass.

  Uses demo mode rather than credentials, so anybody can regenerate these without a database
  and get the same pictures a visitor sees.
*/
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "http://localhost:5273";
/*
  Anchored to the repository root, not to the working directory. pnpm --filter runs this with
  apps/web as cwd, so a relative path put the screenshots inside apps/web/docs, which is
  gitignored: the pictures were being written somewhere they could never be committed from.
*/
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "new pics");

const SHOTS: { name: string; path: string; full?: boolean; before?: (p: Page) => Promise<void> }[] = [
  { name: "01-desk", path: "/desk" },
  { name: "02-the-record", path: "/" },
  { name: "03-strategies", path: "/strategies", full: true },
  { name: "04-knowledge-risk", path: "/risk", full: true },
  { name: "05-capture", path: "/capture" },
  { name: "06-academy", path: "/academy" },
  { name: "07-the-system", path: "/system", full: true },
  { name: "08-verify", path: "/verify" },
  { name: "09-debriefs", path: "/debriefs" },
  { name: "10-reports", path: "/compliance" },
  { name: "11-my-record", path: "/my-record" },
  {
    name: "12-ask-the-ledger",
    path: "/",
    before: async (p) => {
      await p.keyboard.press("Meta+k");
      await p.waitForTimeout(400);
      await p.locator('[role="dialog"] input').fill("why is the expiry window capped");
      await p.waitForSelector("text=/passages? from the ledger/i", { timeout: 90_000 });
      await p.waitForTimeout(400);
    },
  },
  {
    name: "13-new-record",
    path: "/",
    before: async (p) => {
      await p.getByRole("button", { name: /New record/i }).first().click();
      await p.waitForTimeout(500);
    },
  },
  {
    name: "14-rail-collapsed",
    path: "/desk",
    before: async (p) => {
      await p.getByRole("button", { name: /Collapse the navigation/i }).click();
      await p.waitForTimeout(600);
    },
  },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("continuity:demo", "1");
      sessionStorage.setItem("continuity:booted", "1");
    } catch {
      /* Private window: the sign in is a valid shot too. */
    }
  });
  const page = await context.newPage();

  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForSelector("nav", { timeout: 30_000 });
    await page.waitForTimeout(900);
    if (shot.before) await shot.before(page);
    await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: shot.full ?? false });
    console.log(`  ${shot.name}`);
  }

  await browser.close();
  console.log(`wrote ${SHOTS.length} screenshots to ${OUT}`);
}

void main();
