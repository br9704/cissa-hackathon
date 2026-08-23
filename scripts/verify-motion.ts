import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  /* The counting figure. */
  await p.goto("http://localhost:5273/risk", { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 20000 });
  await p.getByRole("button", { name: /Daniel Okonkwo/i }).first().click();
  await p.waitForTimeout(60);
  const early = await p.locator("[class*=exposureNumber]").first().innerText().catch(() => "");
  await p.waitForTimeout(1400);
  const settled = await p.locator("[class*=exposureNumber]").first().innerText().catch(() => "");
  console.log("  exposure early  :", early.trim());
  console.log("  exposure settled:", settled.trim());
  console.log("  it counted up   :", early.trim() !== settled.trim());

  /* The approve flight: the row that lands must share the card's layoutId. */
  await p.goto("http://localhost:5273/", { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 20000 });
  await p.waitForTimeout(700);
  const before = await p.locator("[class*=LedgerRow_wrap]").count();
  await p.locator("body").click({ position: { x: 5, y: 400 } });
  await p.keyboard.press("a");
  await p.waitForTimeout(1400);
  const after = await p.locator("[class*=LedgerRow_wrap]").count();
  const filed = (await p.locator("text=/Filed/i").count()) > 0;
  console.log("  rows before/after:", before, "/", after);
  console.log("  approve landed   :", filed || after > before);
  console.log("  console errors   :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
