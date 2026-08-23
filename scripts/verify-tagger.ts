import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/", { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 20000 });
  await p.getByRole("button", { name: /New record/i }).first().click();
  await p.waitForTimeout(400);

  const sheet = p.getByRole("dialog", { name: /New record/i });
  const before = (await sheet.locator('[aria-live="polite"]').first().innerText()).trim();

  await sheet.locator("textarea").first().fill(
    "Cut the intraday delta cap into expiry because the borrow got recalled twice in a week and the old limit assumed a friendly lender.",
  );
  await p.waitForTimeout(1200);
  const thinking = (await sheet.locator('[aria-live="polite"]').first().innerText()).trim();
  await p.waitForTimeout(6000);
  const after = (await sheet.locator('[aria-live="polite"]').first().innerText()).trim();

  await p.screenshot({ path: "docs/shots/dark/tagger.png" });
  console.log("  idle    :", before.replace(/\n/g, " ").slice(0, 90));
  console.log("  typing  :", thinking.replace(/\n/g, " ").slice(0, 90));
  console.log("  settled :", after.replace(/\n/g, " ").slice(0, 110));
  console.log("  console errors:", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
