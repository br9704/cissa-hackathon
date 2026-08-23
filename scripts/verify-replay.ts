import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto("http://localhost:5273/strategies", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);

  const slider = p.getByLabel("Replay the ledger over time");
  await slider.focus();
  await p.keyboard.press("Home");
  await p.waitForTimeout(400);
  const atStart = (await p.locator('[aria-live="polite"]').first().innerText()).trim();

  for (let i = 0; i < 25; i++) await p.keyboard.press("ArrowRight");
  await p.waitForTimeout(500);
  const midway = (await p.locator('[aria-live="polite"]').first().innerText()).trim();
  const feedRows = await p.locator("ol li").count();

  await p.keyboard.press("End");
  await p.waitForTimeout(500);
  const atEnd = (await p.locator('[aria-live="polite"]').first().innerText()).trim();

  console.log("  start   :", atStart.slice(0, 100));
  console.log("  midway  :", midway.slice(0, 100));
  console.log("  end     :", atEnd.slice(0, 120));
  console.log("  feed rows:", feedRows);
  console.log("  caption changed:", atStart !== midway && midway !== atEnd);
  console.log("  console errors:", errors.length === 0 ? "none" : errors.slice(0, 2));
  await p.screenshot({ path: "docs/shots/dark/replay.png" });
  await b.close();
}
void main();
