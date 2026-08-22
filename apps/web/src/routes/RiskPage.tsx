import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function RiskPage() {
  return (
    <Pane title="Knowledge risk" subtitle="Meridian Basis Partners">
      <p>Bus factor, concentration and vacation readiness, computed per strategy. Never per person.</p>
      <EmptyState
        title="Nothing to score yet"
        body="Scores need decisions to score. File a few, or run the seed."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        
      />
    </Pane>
  );
}
