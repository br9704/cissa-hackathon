import { chromium } from "playwright";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/strategies", "/risk", "/verify"];
async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const r of ROUTES) {
    await p.goto(`http://localhost:5273${r}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    const name = r === "/" ? "ledger" : r.slice(1).replace(/\//g, "-");
    await p.screenshot({ path: `docs/shots/dark/${name}.png` });
    console.log(`shot ${name}`);
  }
  await b.close();
}
void main();
