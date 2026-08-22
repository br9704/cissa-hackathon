import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function StrategiesPage() {
  return (
    <Pane title="Strategies" subtitle="Meridian Basis Partners">
      <p>Every strategy carries its decision genealogy: what changed, why, and what was rejected along the way.</p>
      <EmptyState
        title="No strategies yet"
        body="Strategies arrive with the seed, or you can file the first decision from quick capture."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        shortcut="Cmd Shift Space"
      />
    </Pane>
  );
}
