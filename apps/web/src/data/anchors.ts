/*
  The anchor receipts, imported from the file the anchor command writes.

  Same discipline as the tagger figures: the UI reads the artifact rather than describing
  it, so the page cannot claim an anchor that does not exist or a status the receipt does
  not have. If nothing has been anchored the page says so, which is the correct thing for
  it to say.
*/
import anchors from "../../../../docs/anchors.json";

export type Anchor = {
  firm_id: string;
  through_event_id: number;
  event_count: number;
  merkle_root: string;
  receipt_base64: string;
  status: "pending" | "attested";
  anchored_at: string;
  attestation?: { chain: string; blockHeight: number; timestamp: string };
};

export const allAnchors = anchors as Anchor[];

export function latestAnchor(): Anchor | null {
  if (allAnchors.length === 0) return null;
  return allAnchors
    .slice()
    .sort((a, b) => b.anchored_at.localeCompare(a.anchored_at))[0]!;
}

/** Receipt size in bytes, from the base64, without decoding it. */
export function receiptBytes(anchor: Anchor): number {
  const b64 = anchor.receipt_base64;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length * 3) / 4 - padding;
}
