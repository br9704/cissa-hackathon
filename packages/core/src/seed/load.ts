/*
  Writes a generated corpus into Postgres.

  Split from run.ts so the same loader serves the local database and the hosted Supabase
  project, and so it can be called from a test. It takes a `pg` client rather than
  creating one, because who owns the connection is the caller's problem.

  Two things about this loader are deliberate and worth not undoing.

  Events go in one at a time, in order. Batching them would be faster and would also
  make the chain unverifiable if a single row failed halfway through a multi row insert.
  The ledger is the one place where slow and certain beats fast.

  It never touches prev_hash or this_hash. Those are the trigger's job. A loader that
  computed its own hashes would be a second implementation of the chain, and a second
  implementation is a second thing that can drift.
*/
import type { Client } from "pg";
import type { Corpus } from "./generate.js";

export type LoadStats = {
  firms: number; members: number; strategies: number; artifacts: number;
  events: number; decisions: number; links: number; sessions: number;
  turns: number; questions: number;
};

export async function load(client: Client, corpus: Corpus): Promise<LoadStats> {
  const stats: LoadStats = {
    firms: 0, members: 0, strategies: 0, artifacts: 0, events: 0,
    decisions: 0, links: 0, sessions: 0, turns: 0, questions: 0,
  };

  await client.query("begin");
  try {
    await client.query("insert into firms (id, name) values ($1, $2)", [
      corpus.firmId,
      corpus.firmName,
    ]);
    stats.firms = 1;

    for (const m of corpus.members) {
      await client.query(
        `insert into members (id, user_id, firm_id, role, display_name)
         values ($1, $2, $3, $4, $5)`,
        [m.id, m.userId, corpus.firmId, m.role, m.displayName],
      );
      stats.members++;
    }

    for (const s of corpus.strategies) {
      await client.query(
        `insert into strategies (id, firm_id, name, status, description, created_by)
         values ($1, $2, $3, $4, $5, $6)`,
        [s.id, corpus.firmId, s.name, s.status, s.description, s.createdBy],
      );
      stats.strategies++;
    }

    for (const a of corpus.artifacts) {
      await client.query(
        `insert into artifacts
           (id, firm_id, strategy_id, kind, external_ref, content_hash,
            author_member_id, occurred_at, raw_meta)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [a.id, corpus.firmId, a.strategyId, a.kind, a.externalRef, a.contentHash,
         a.authorMemberId, a.occurredAt, JSON.stringify(a.rawMeta)],
      );
      stats.artifacts++;
    }

    /*
      Every decision is an event first and a row second. That ordering is the product's
      central claim, so the loader has to honour it rather than inserting the projection
      and backfilling a ledger entry afterwards.
    */
    const ordered = corpus.decisions
      .slice()
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    for (const d of ordered) {
      const { rows } = await client.query<{ id: string }>(
        `insert into events (firm_id, kind, payload, actor_member_id, occurred_at)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [
          corpus.firmId,
          d.approvedAt ? "decision_approved" : "decision_drafted",
          JSON.stringify({
            decision_id: d.id,
            strategy_id: d.strategyId,
            title: d.title,
            decision_type: d.decisionType,
            risk_flag: d.riskFlag,
            drafted_by: d.draftedBy,
          }),
          d.authorMemberId,
          d.occurredAt,
        ],
      );
      stats.events++;
      const eventId = rows[0]!.id;

      await client.query(
        `insert into decisions
           (id, firm_id, strategy_id, event_id, title, what_changed, why, alternatives,
            confidence, tags, decision_type, risk_flag, author_member_id, approved_at,
            drafted_by, source_artifact_ids, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [d.id, corpus.firmId, d.strategyId, eventId, d.title, d.whatChanged, d.why,
         JSON.stringify(d.alternatives), d.confidence, d.tags, d.decisionType,
         d.riskFlag, d.authorMemberId, d.approvedAt, d.draftedBy,
         d.sourceArtifactIds, d.occurredAt],
      );
      stats.decisions++;
    }

    for (const l of corpus.links) {
      await client.query(
        `insert into decision_links (parent_decision_id, child_decision_id, relation)
         values ($1, $2, $3)
         on conflict do nothing`,
        [l.parent, l.child, l.relation],
      );
      stats.links++;
    }

    for (const s of corpus.sessions) {
      await client.query(
        `insert into debrief_sessions
           (id, firm_id, member_id, strategy_id, scheduled_for, completed_at, trigger_reason)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [s.id, corpus.firmId, s.memberId, s.strategyId, s.scheduledFor,
         s.completedAt, s.triggerReason],
      );
      stats.sessions++;
    }

    for (const t of corpus.turns) {
      await client.query(
        `insert into debrief_turns (session_id, seq, role, text, grounded_artifact_ids)
         values ($1,$2,$3,$4,$5)`,
        [t.sessionId, t.seq, t.role, t.text, t.groundedArtifactIds],
      );
      stats.turns++;
    }

    for (const q of corpus.questions) {
      await client.query(
        `insert into questions
           (id, firm_id, strategy_id, text, asked_by, answered_by_decision_id,
            undocumentedness_score)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [q.id, corpus.firmId, q.strategyId, q.text, q.askedBy,
         q.answeredByDecisionId, q.undocumentedness],
      );
      stats.questions++;
    }

    await client.query("commit");
    return stats;
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}
