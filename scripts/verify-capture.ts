import { chromium } from "playwright";

async function main() {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await p.goto("http://localhost:5273/capture", { waitUntil: "commit" });
  await p.waitForSelector("nav", { timeout: 20000 });
  await p.waitForTimeout(700);

  const channels = await p.locator("[class*=channelName]").allInnerTexts();
  const emptyInbox = (await p.locator("text=/Nothing captured yet/i").count()) > 0;

  await p.getByRole("button", { name: /Write it down/i }).click();
  await p.waitForTimeout(400);
  const sheet = p.getByRole("dialog", { name: /New record/i });
  await sheet.locator("textarea").first().fill(
    "Widened the borrow buffer on India carry because we were recalled twice in one week and the old assumption was a friendly lender.",
  );
  await sheet.getByRole("button", { name: /Send to inbox/i }).click();
  await p.waitForTimeout(400);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(400);

  const inboxCount = await p.locator("[class*=itemTitle]").count();
  await p.screenshot({ path: "docs/shots/dark/capture.png" });

  await p.getByRole("button", { name: /File into the ledger/i }).first().click();
  await p.waitForTimeout(500);
  const chained = (await p.locator("text=/chained/i").count()) > 0;
  const filedSection = (await p.locator("text=/Filed this session/i").count()) > 0;

  console.log("  channels        :", channels.join(" | "));
  console.log("  inbox empty first:", emptyInbox);
  console.log("  landed in inbox  :", inboxCount > 0);
  console.log("  filed to ledger  :", filedSection && chained);
  console.log("  console errors   :", errors.length === 0 ? "none" : errors.slice(0, 2));
  await b.close();
}
void main();
