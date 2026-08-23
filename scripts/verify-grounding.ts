import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/", { waitUntil: "commit" });
  await p.waitForSelector("nav, form", { timeout: 25000 });

  /* Sign in when the login screen is up. Auth is real now, so the harness has to be a user. */
  if ((await p.locator("form").count()) > 0 && (await p.locator("nav").count()) === 0) {
    await p.locator('input[type="email"]').fill(process.env["DEMO_EMAIL"] ?? "");
    await p.locator('input[type="password"]').fill(process.env["DEMO_PASSWORD"] ?? "");
    await p.getByRole("button", { name: /^Sign in$/ }).click();
    await p.waitForSelector("nav", { timeout: 30000 });
  }

  await p.keyboard.press("Meta+k");
  await p.waitForTimeout(500);
  await p.locator('[role="dialog"] input').fill("why is the expiry window capped");
  /* The retrieval model downloads on first ask, so this waits for the real thing. */
  await p.waitForSelector("text=/passages? from the ledger/i", { timeout: 90000 });

  const askModel = p.getByRole("button", { name: /ask the firm model/i });
  const offered = (await askModel.count()) > 0;
  if (offered) {
    await askModel.click();
    await p.waitForSelector("text=/Meridian's own model/i", { timeout: 90000 });
    await p.waitForTimeout(600);
  }

  const claims = await p.locator("[class*=claim]").count();
  const struck = await p.locator('[data-grounded="false"]').count();
  const grounded = await p.locator('[data-grounded="true"]').count();
  await p.screenshot({ path: "docs/shots/dark/grounded.png" });

  console.log("  model offered      :", offered);
  console.log("  sentences judged   :", claims);
  console.log("  grounded / struck  :", grounded, "/", struck);
  console.log("  console errors     :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
