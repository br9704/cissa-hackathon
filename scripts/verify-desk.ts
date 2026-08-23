import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/desk", { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 20000 });
  await p.waitForTimeout(900);

  async function headings() {
    return (await p.locator("[class*=panelTitle]").allInnerTexts()).join(" | ");
  }

  const asNewcomer = await headings();
  const select = p.getByLabel("Viewing as");

  const options = await select.locator("option").allTextContents();
  const deskHead = options.find((o) => o.includes("desk head"))!;
  const compliance = options.find((o) => o.includes("compliance"))!;
  const researcher = options.find((o) => o.includes("researcher"))!;

  await select.selectOption({ label: deskHead });
  await p.waitForTimeout(500);
  const asDeskHead = await headings();
  await p.screenshot({ path: "docs/shots/dark/desk.png" });

  await select.selectOption({ label: compliance });
  await p.waitForTimeout(500);
  const asCompliance = await headings();

  await select.selectOption({ label: researcher });
  await p.waitForTimeout(500);
  const asResearcher = await headings();

  console.log("  newcomer  :", asNewcomer.slice(0, 90));
  console.log("  desk head :", asDeskHead.slice(0, 90));
  console.log("  compliance:", asCompliance.slice(0, 90));
  console.log("  researcher:", asResearcher.slice(0, 90));
  const distinct = new Set([asNewcomer, asDeskHead, asCompliance, asResearcher]).size;
  console.log("  distinct front pages:", distinct, "of 4");
  console.log("  console errors:", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
