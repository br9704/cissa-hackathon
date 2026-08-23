import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();

  /* A fresh context each time, because the boot screen is once per session by design. */
  const cold = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await cold.newPage();
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/", { waitUntil: "commit" });
  await p.waitForTimeout(150);
  const sawBoot = (await p.locator('[role="status"]').count()) > 0;
  const readout = sawBoot ? await p.locator('[role="status"]').first().innerText().catch(() => "") : "";
  await p.screenshot({ path: "docs/shots/dark/boot.png" });

  /* Settles on the shell OR the sign in screen, depending on whether Supabase is
     configured. Waiting only for nav made this hang the moment auth landed. */
  await p.waitForSelector("nav, form", { timeout: 25000 });
  const reachedApp = (await p.locator("nav, form").count()) > 0;
  const bootGone = (await p.locator('[role="status"]').count()) === 0;

  /* Second navigation in the same session must NOT show it again. */
  await p.goto("http://localhost:5273/strategies", { waitUntil: "commit" });
  await p.waitForTimeout(120);
  const secondTime = (await p.locator('[role="status"]').count()) > 0;

  /* Reduced motion skips it entirely. */
  const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const p2 = await rm.newPage();
  await p2.goto("http://localhost:5273/", { waitUntil: "commit" });
  await p2.waitForTimeout(150);
  const rmBoot = (await p2.locator('[role="status"]').count()) > 0;

  console.log("  boot shown on cold load :", sawBoot);
  console.log("  readout                 :", readout.replace(/\n/g, " ").slice(0, 70));
  console.log("  reached the app         :", reachedApp);
  console.log("  boot removed after       :", bootGone);
  console.log("  shown again same session:", secondTime, "(want false)");
  console.log("  shown under reduced motion:", rmBoot, "(want false)");
  console.log("  console errors          :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
