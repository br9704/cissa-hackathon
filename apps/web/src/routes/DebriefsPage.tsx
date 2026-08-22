import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function DebriefsPage() {
  return (
    <Pane title="Debriefs" subtitle="Meridian Basis Partners">
      <p>Sixty seconds, three to five questions, every one of them grounded in something you actually did.</p>
      <EmptyState
        title="No debriefs scheduled"
        body="Debriefs are scheduled by cadence: after a merge, after a drawdown flag, and weekly."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        
      />
    </Pane>
  );
}
