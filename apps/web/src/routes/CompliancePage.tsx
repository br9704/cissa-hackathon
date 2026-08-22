import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function CompliancePage() {
  return (
    <Pane title="Compliance" subtitle="Meridian Basis Partners">
      <p>RTS 6 change logs and SR 11-7 model documentation, generated from the ledger and labelled draft.</p>
      <EmptyState
        title="Nothing to extract yet"
        body="Compliance artifacts are projections of the ledger. They appear once it has content."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        
      />
    </Pane>
  );
}
