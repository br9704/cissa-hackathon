import { chromium } from "playwright";
const SITE = process.env["SITE"] ?? "https://continuity-nu.vercel.app";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 110)); });

  await p.goto(SITE, { waitUntil: "commit" });
  await p.waitForSelector("form, nav", { timeout: 40000 });

  const demoButton = p.getByRole("button", { name: /Look around without an account/i });
  const offered = (await demoButton.count()) > 0;
  if (offered) {
    await demoButton.click();
    await p.waitForSelector("nav", { timeout: 40000 });
  }
  await p.waitForTimeout(1500);

  const mode = await p.locator("text=/Demo, seeded corpus/i").count();
  const records = await p.locator("text=/184\\s+records/i").count();
  const nav = await p.locator("nav a").count();
  await p.screenshot({ path: "docs/shots/dark/live-demo.png" });

  console.log("  demo button offered :", offered);
  console.log("  chrome says demo    :", mode > 0);
  console.log("  ledger has records  :", records > 0);
  console.log("  nav entries         :", nav);
  console.log("  console errors      :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
