import { chromium } from "playwright";

const SITE = process.env["SITE"] ?? "https://continuity-nu.vercel.app";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });

  await p.goto(SITE, { waitUntil: "commit" });
  await p.waitForSelector("nav, form", { timeout: 40000 });

  const wantsLogin = (await p.locator("form").count()) > 0 && (await p.locator("nav").count()) === 0;
  if (wantsLogin) {
    await p.locator('input[type="email"]').fill(process.env["DEMO_EMAIL"] ?? "");
    await p.locator('input[type="password"]').fill(process.env["DEMO_PASSWORD"] ?? "");
    await p.getByRole("button", { name: /^Sign in$/ }).click();
    await p.waitForSelector("nav", { timeout: 40000 });
  }

  const nav = await p.locator("nav a").count();
  await p.goto(`${SITE}/system`, { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 40000 });
  await p.waitForTimeout(2500);
  const supabaseUp = (await p.locator("text=/hosted, and this app is reading it/i").count()) > 0;

  await p.goto(`${SITE}/verify`, { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 40000 });
  await p.waitForTimeout(3000);
  const verifyText = await p.locator("main").innerText();

  console.log("  login required :", wantsLogin);
  console.log("  nav entries    :", nav);
  console.log("  supabase live  :", supabaseUp);
  console.log("  verify says    :", verifyText.replace(/\s+/g, " ").slice(0, 120));
  console.log("  console errors :", errors.length === 0 ? "none" : errors.slice(0, 3));
  await b.close();
}
void main();
