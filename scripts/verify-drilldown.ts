/*
  The app has to be a graph you can walk, not nine dead ends. This walks it.
*/
import { chromium } from "playwright";

const BASE = "http://localhost:5273";

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  const hops: string[] = [];
  async function hop(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      await page.waitForTimeout(500);
      hops.push(`  ok    ${name}  ${new URL(page.url()).pathname}`);
    } catch (err) {
      hops.push(`  FAIL  ${name}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  await hop("ledger row to decision", async () => {
    await page.locator('a[href*="/decision/"]').first().click();
    await page.waitForURL(/\/decision\//);
  });
  await hop("decision to its author", async () => {
    await page.locator('a[href*="/person/"]').first().click();
    await page.waitForURL(/\/person\//);
  });
  await hop("person to a book they hold", async () => {
    await page.locator('a[href*="/strategy/"]').first().click();
    await page.waitForURL(/\/strategy\//);
  });
  await hop("book to one of its decisions", async () => {
    await page.locator('a[href*="/decision/"]').first().click();
    await page.waitForURL(/\/decision\//);
  });
  await hop("decision to a source artifact", async () => {
    const a = page.locator('a[href*="/artifact/"]').first();
    if ((await a.count()) === 0) throw new Error("this decision cites no artifact");
    await a.click();
    await page.waitForURL(/\/artifact\//);
  });
  await hop("artifact back to a citing decision", async () => {
    await page.locator('a[href*="/decision/"]').first().click();
    await page.waitForURL(/\/decision\//);
  });

  await hop("back unwinds", async () => {
    for (let i = 0; i < 6; i++) await page.goBack();
    await page.waitForTimeout(300);
    if (new URL(page.url()).pathname !== "/") throw new Error(`landed on ${page.url()}`);
  });

  await hop("an unknown id says so instead of blanking", async () => {
    await page.goto(`${BASE}/decision/does-not-exist`, { waitUntil: "networkidle" });
    const n = await page.locator("text=/is in the record/i").count();
    if (n === 0) throw new Error("no not-found state");
  });

  console.log(hops.join("\n"));
  console.log(`  console errors: ${errors.length === 0 ? "none" : errors.slice(0, 3).join(" | ")}`);
  await browser.close();
}

void main();
