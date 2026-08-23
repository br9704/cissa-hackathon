/*
  Verify the chain while the boot screen is up.

  Real work, not a described step: it recomputes every hash in the seeded ledger. That takes
  a few milliseconds, which is exactly why the app can afford to do it on every start rather
  than only on the Verify page, and it means the readout is telling the truth when it says
  the chain is being verified.

  A failure here is not fatal to the boot. If the chain is broken the Verify page is the
  place that says so, in detail, with the row named. Refusing to start would hide the
  evidence behind a blank screen.
*/
import { done, report } from "./assets";
import { chainedLedger } from "../data/source";

export async function verifyAtBoot(): Promise<void> {
  try {
    report("chain", 0.15);
    await chainedLedger();
    done("chain");
  } catch (err) {
    console.warn("[boot] chain verification did not complete", err);
    done("chain");
  }
}
