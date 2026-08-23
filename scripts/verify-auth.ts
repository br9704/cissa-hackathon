import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/", { waitUntil: "commit" });
  /* Wait for the boot screen AND the session check. 3.5s was not enough on a cold start and
     the harness reported a blank page that was really a screen it had not waited for. */
  /* Scoped to the form. The boot screen also carries a class matching _screen_, so the
     first version of this waited for the loader and then reported the page as blank. */
  await p.waitForSelector("form, nav", { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(600);

  const loginVisible = (await p.locator("text=/Create an account|Sign in/i").count()) > 0;
  const appVisible = (await p.locator("nav").count()) > 0;
  await p.screenshot({ path: "docs/shots/dark/signin.png" });

  /* The quick capture window must never see a login form: it is a 560x132 floating panel. */
  const p2 = await ctx.newPage();
  await p2.goto("http://localhost:5273/quick-capture", { waitUntil: "commit" });
  await p2.waitForTimeout(1500);
  const captureHasLogin = (await p2.locator("text=/Create an account/i").count()) > 0;
  const captureHasInput = (await p2.locator("input").count()) > 0;

  console.log("  login screen shown :", loginVisible);
  console.log("  app shown instead  :", appVisible);
  console.log("  quick capture login:", captureHasLogin, "(want false)");
  console.log("  quick capture input:", captureHasInput, "(want true)");
  console.log("  console errors     :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
