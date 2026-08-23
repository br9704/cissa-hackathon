/*
  S13 acceptance, driven in a real browser.

  The critique was written by driving the app, not by reading it, and the fixes are only
  worth anything if they survive the same treatment. Each check is independent so one
  failure reports itself instead of taking the rest of the run down with it.
*/
import { chromium, type Page } from "playwright";

const BASE = "http://localhost:5273";
const results: [string, unknown][] = [];

async function check(name: string, fn: () => Promise<unknown>) {
  try {
    results.push([name, await fn()]);
  } catch (err) {
    results.push([name, `FAILED: ${(err as Error).message.split("\n")[0]}`]);
  }
}

async function main() {
  const browser = await chromium.launch();
  const page: Page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle" });

  await check("capture button in chrome", () =>
    page.getByRole("button", { name: /New record/i }).first().isVisible(),
  );
  await check("my record in nav", () =>
    page.getByRole("link", { name: /My record/i }).first().isVisible(),
  );
  await check("liveness strip", async () => (await page.locator("text=/last capture/i").count()) > 0);

  await check("sheet opens and has three channels", async () => {
    await page.getByRole("button", { name: /New record/i }).first().click();
    await page.waitForTimeout(400);
    return page.getByRole("tab").count();
  });

  await check("filing a note reaches the inbox", async () => {
    /* Scoped to the dialog. The page behind it also has a textarea (the transcript
       importer), and an unscoped locator picked that one, filled it, and then waited
       forever for a submit button that was still correctly disabled. */
    const sheet = page.getByRole("dialog", { name: /New record/i });
    await sheet.locator("textarea").first().fill("Cut the expiry window: the carry stopped paying after the circular.");
    await page.getByRole("button", { name: /Send to inbox/i }).click();
    await page.waitForTimeout(400);
    return (await page.locator("text=/Captured:/i").count()) > 0;
  });

  await check("typing in the sheet does not fire draft hotkeys", async () => {
    const ta = page.getByRole("dialog", { name: /New record/i }).locator("textarea").first();
    await ta.fill("");
    await ta.type("hello there", { delay: 20 });
    return (await ta.inputValue()) === "hello there";
  });

  await check("inbox count shows in chrome", async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    return (await page.locator("text=/waiting/i").count()) > 0;
  });

  await check("palette offers New record", async () => {
    await page.keyboard.press("Meta+k");
    await page.waitForTimeout(400);
    const n = await page.locator('[role="dialog"] >> text=/New record/i').count();
    await page.keyboard.press("Escape");
    return n > 0;
  });

  await page.goto(`${BASE}/strategies`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  await check("graph nodes carry labels", () => page.locator("svg text").count());
  await check("replay sits above the graph", async () => {
    const tm = await page.getByLabel("Replay the ledger over time").boundingBox();
    /* The genealogy svg specifically. The nav rail is full of icon svgs and first() found
       one of those, which sits at the top of the page and made this always read false. */
    const svg = await page.locator("svg").filter({ has: page.locator("circle") }).last().boundingBox();
    return tm && svg ? tm.y < svg.y : "no boxes";
  });
  await check("selected strategy card is visibly selected", async () => {
    const card = page.locator('button[data-active="true"]').first();
    return card.isVisible();
  });

  results.push(["console errors", errors.length === 0 ? "none" : errors.slice(0, 3)]);

  for (const [name, value] of results) {
    console.log(`  ${String(value).padEnd(28)} ${name}`);
  }
  await browser.close();
}

void main();
