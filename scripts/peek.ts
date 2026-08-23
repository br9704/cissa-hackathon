import { chromium } from "playwright";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/strategies", "/risk", "/verify"];
async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  /* Skip the door the same way a visitor can, rather than needing credentials to look. */
  await p.addInitScript(() => {
    try {
      sessionStorage.setItem("continuity:demo", "1");
    } catch {
      /* Private window: the app will show the sign in, which is also a valid shot. */
    }
  });
  for (const r of ROUTES) {
    await p.goto(`http://localhost:5273${r}`, { waitUntil: "networkidle" });
    /* Wait past the boot screen. It is once per session, but every screenshot here starts a
       fresh page, so without this the harness photographs the loader every time. */
    await p.waitForSelector("nav", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const name = r === "/" ? "ledger" : r.slice(1).replace(/\//g, "-");
    await p.screenshot({ path: `docs/shots/dark/${name}.png` });
    console.log(`shot ${name}`);
  }
  await b.close();
}
void main();
