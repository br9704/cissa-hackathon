import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function VerifyPage() {
  return (
    <Pane title="Verify" subtitle="Meridian Basis Partners">
      <p>Recompute the chain, row by row, and show the anchor receipt. Never trust a stored hash, recompute it.</p>
      <EmptyState
        title="Nothing to verify yet"
        body="The chain starts at the first event. File one and the sweep has something to walk."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        
      />
    </Pane>
  );
}
