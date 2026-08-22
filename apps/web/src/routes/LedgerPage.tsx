import { Pane } from "../components/Pane";
import { EmptyState } from "../components/EmptyState";

export function LedgerPage() {
  return (
    <Pane title="Ledger" subtitle="Meridian Basis Partners">
      <p>The append only record. Every meaningful thing in the system is an event here first, hash chained to the one before it.</p>
      <EmptyState
        title="No events yet"
        body="The ledger fills itself. A commit in a linked repo files an artifact and drafts a decision record for approval."
        hint="Capture is ambient. Nothing here is filled by hand unless you want it to be."
        shortcut="A"
      />
    </Pane>
  );
}
