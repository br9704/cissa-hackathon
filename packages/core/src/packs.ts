/*
  Generated artifacts: the handover pack and the compliance extracts.

  All three are pure functions from rows to markdown. Nothing here reaches a database or
  a clock, which means the same input always produces the same document and the pack hash
  actually means something.

  The shapes are not invented. Regulators have already written the specification and it
  is more specific than most people expect:

    FCA SYSC 25.9 says handover material should include "judgement and opinion, not just
    facts and figures". That sentence is the reason the pack leads with reasoning and
    open questions rather than with a list of positions.

    MiFID II RTS 6 Article 5(7) requires a record of when a material algorithm change was
    made, who made it, who approved it, and its nature. That is a table, and the ledger
    already has every column.

    SR 11-7 asks for model documentation understandable by "parties unfamiliar with a
    model". That is a readability constraint, not a completeness one, so the extract
    leads with what the strategy does before it lists what changed.

  Every generated document says DRAFT at the top and names the ledger position it was
  generated from, so a pack and the ledger can be reconciled after the fact.
*/
import type { Decision, DebriefSession, DebriefTurn, Question, Strategy, Member } from "./seed/generate.js";
import type { StrategyScore } from "./scoring.js";

export type PackInput = {
  firmName: string;
  member: Member;
  strategies: Strategy[];
  decisions: Decision[];
  questions: Question[];
  sessions: DebriefSession[];
  turns: DebriefTurn[];
  scores: Map<string, StrategyScore>;
  /* The ledger position this was generated from. A pack that cannot be reconciled with
     the ledger is a document, not an artifact. */
  throughEvent: number;
  generatedAt: string;
};

const rule = "\n---\n";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The handover pack, shaped by SYSC 25.9.
 *
 * Ordered by what a successor needs first, which is not the order the data is stored in:
 * what you are inheriting, what nobody but the departing person can currently explain,
 * then the reasoning itself, then the mechanics.
 */
export function handoverPack(input: PackInput): string {
  const {
    firmName, member, strategies, decisions, questions, sessions, turns,
    scores, throughEvent, generatedAt,
  } = input;

  const theirs = decisions.filter((d) => d.authorMemberId === member.id);
  const byStrategy = new Map<string, Decision[]>();
  for (const d of theirs) {
    const list = byStrategy.get(d.strategyId) ?? [];
    list.push(d);
    byStrategy.set(d.strategyId, list);
  }

  const owned = strategies.filter((s) => scores.get(s.id)?.topHolderMemberId === member.id);
  const soleHeld = owned.filter((s) => (scores.get(s.id)?.busFactor ?? 0) <= 1);

  const openForThem = questions
    .filter((q) => !q.answeredByDecisionId)
    .sort((a, b) => b.undocumentedness - a.undocumentedness);

  const theirSessions = sessions.filter((s) => s.memberId === member.id);
  const sessionIds = new Set(theirSessions.map((s) => s.id));
  const theirTurns = turns
    .filter((t) => sessionIds.has(t.sessionId) && t.role === "human")
    .slice(0, 8);

  const lines: string[] = [];

  lines.push(`# Handover pack: ${member.displayName}`);
  lines.push("");
  lines.push("**DRAFT.** Generated from the decision ledger. Reviewed by nobody yet.");
  lines.push("");
  lines.push(`${firmName} · ${member.desk} desk · generated ${fmtDate(generatedAt)}`);
  lines.push(`Ledger position: event ${throughEvent}`);
  lines.push("");
  lines.push(
    "Shaped by FCA SYSC 25.9, which asks that handover material contain judgement and " +
      "opinion, not just facts and figures. The sections are ordered by what a successor " +
      "needs first rather than by what is easiest to generate.",
  );
  lines.push(rule);

  // 1. What is being inherited
  lines.push("## 1. What you are inheriting");
  lines.push("");
  if (owned.length === 0) {
    lines.push("No strategy currently has this person as its largest recorded contributor.");
  } else {
    lines.push("| Strategy | Status | Their decisions | Bus factor | Readiness |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const s of owned) {
      const score = scores.get(s.id)!;
      lines.push(
        `| ${s.name} | ${s.status} | ${(byStrategy.get(s.id) ?? []).length} | ` +
          `${score.busFactor} | ${score.vacationReadiness} |`,
      );
    }
  }
  lines.push("");
  if (soleHeld.length > 0) {
    lines.push(
      `**${soleHeld.map((s) => s.name).join(" and ")}** ` +
        `${soleHeld.length === 1 ? "has" : "have"} a bus factor of one. Nobody else has ` +
        "recorded reasoning on the same ground, so anything not captured before the last " +
        "day is not captured.",
    );
    lines.push("");
  }

  // 2. What only they can answer
  lines.push(rule);
  lines.push("## 2. Questions nobody else can currently answer");
  lines.push("");
  lines.push(
    "Ranked by how undocumented they are. These are the exit interview, and they are the " +
      "part of a handover that is normally improvised.",
  );
  lines.push("");
  if (openForThem.length === 0) {
    lines.push("No open questions. Unusual, and worth checking rather than celebrating.");
  } else {
    for (const q of openForThem.slice(0, 10)) {
      lines.push(`- ${q.text}`);
    }
  }
  lines.push("");

  // 3. Their reasoning, in their words
  lines.push(rule);
  lines.push("## 3. Their reasoning, in their own words");
  lines.push("");
  if (theirTurns.length === 0) {
    lines.push("No debrief answers on file.");
  } else {
    for (const t of theirTurns) {
      lines.push(`> ${t.text}`);
      lines.push("");
    }
  }

  // 4. Risk flagged decisions
  lines.push(rule);
  lines.push("## 4. Risk flagged decisions");
  lines.push("");
  const risky = theirs.filter((d) => d.riskFlag);
  if (risky.length === 0) {
    lines.push("None recorded.");
  } else {
    lines.push(
      "Decisions that changed the firm's risk posture or were made in response to a risk " +
        "event. A successor should be able to explain every one of these.",
    );
    lines.push("");
    for (const d of risky.slice(0, 20)) {
      lines.push(`### ${d.title}`);
      lines.push("");
      lines.push(`*${fmtDate(d.occurredAt)}*`);
      lines.push("");
      lines.push(d.why);
      if (d.alternatives.length) {
        lines.push("");
        lines.push("Rejected:");
        for (const a of d.alternatives) lines.push(`- ${a}`);
      }
      lines.push("");
    }
  }

  // 5. Full decision index
  lines.push(rule);
  lines.push("## 5. Full decision index");
  lines.push("");
  lines.push(`${theirs.length} decisions recorded by ${member.displayName}.`);
  lines.push("");
  lines.push("| Date | Strategy | Decision | Type | Risk |");
  lines.push("| --- | --- | --- | --- | --- |");
  const strategyName = (id: string) => strategies.find((s) => s.id === id)?.name ?? "Unassigned";
  for (const d of theirs.slice().sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))) {
    lines.push(
      `| ${fmtDate(d.occurredAt)} | ${strategyName(d.strategyId)} | ${d.title} | ` +
        `${d.decisionType ?? "untagged"} | ${d.riskFlag ? "yes" : ""} |`,
    );
  }
  lines.push("");
  lines.push(rule);
  lines.push(
    `Generated by Continuity from the ledger of ${firmName} at event ${throughEvent}. ` +
      "Every row above is traceable to an append only record. All data is synthetic.",
  );
  lines.push("");
  lines.push(`Approved by: _________________________  Date: ______________`);
  lines.push("");

  return lines.join("\n");
}

/**
 * RTS 6 Article 5(7) change log.
 *
 * The regulation asks for when, who made it, who approved it, and the nature of the
 * change. That is exactly four columns, and the ledger has all four without deriving
 * anything, which is the point worth making when this is shown to a compliance officer.
 */
export function rts6ChangeLog(input: {
  firmName: string;
  strategy: Strategy;
  decisions: Decision[];
  memberName: (id: string | null) => string;
  throughEvent: number;
  generatedAt: string;
}): string {
  const { firmName, strategy, decisions, memberName, throughEvent, generatedAt } = input;
  const material = decisions
    .filter((d) => d.strategyId === strategy.id)
    .slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const lines: string[] = [];
  lines.push(`# Algorithm change log: ${strategy.name}`);
  lines.push("");
  lines.push("**DRAFT.** Generated from the decision ledger.");
  lines.push("");
  lines.push(`${firmName} · generated ${fmtDate(generatedAt)} · ledger position event ${throughEvent}`);
  lines.push("");
  lines.push(
    "Shaped by MiFID II RTS 6 Article 5(7), which requires a record of when each material " +
      "change was made, who made it, who approved it, and the nature of the change. Those " +
      "are the four columns below and none of them are derived: the ledger stores each one " +
      "at the moment the change happens.",
  );
  lines.push("");
  lines.push("| When | Nature of change | Made by | Approved | Risk |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const d of material) {
    lines.push(
      `| ${fmtDate(d.occurredAt)} | ${d.title} | ${memberName(d.authorMemberId)} | ` +
        `${d.approvedAt ? fmtDate(d.approvedAt) : "not yet approved"} | ` +
        `${d.riskFlag ? "yes" : ""} |`,
    );
  }
  lines.push("");
  lines.push(`${material.length} material changes recorded.`);
  lines.push("");
  lines.push(
    "Entries marked not yet approved are model drafted records awaiting a human. They " +
      "appear here because omitting them would misrepresent the record, not because they " +
      "are approved.",
  );
  lines.push("");
  return lines.join("\n");
}

/**
 * SR 11-7 shaped model documentation.
 *
 * The binding constraint in SR 11-7 is that documentation be understandable by parties
 * unfamiliar with the model. That is a readability requirement rather than a
 * completeness one, so this leads with what the strategy does and only then lists what
 * changed and why.
 */
export function sr117Documentation(input: {
  firmName: string;
  strategy: Strategy;
  decisions: Decision[];
  questions: Question[];
  score: StrategyScore | undefined;
  memberName: (id: string | null) => string;
  throughEvent: number;
  generatedAt: string;
}): string {
  const { firmName, strategy, decisions, questions, score, memberName, throughEvent, generatedAt } = input;
  const own = decisions.filter((d) => d.strategyId === strategy.id);
  const byType = new Map<string, Decision[]>();
  for (const d of own) {
    const key = d.decisionType ?? "untagged";
    byType.set(key, [...(byType.get(key) ?? []), d]);
  }

  const lines: string[] = [];
  lines.push(`# Model documentation: ${strategy.name}`);
  lines.push("");
  lines.push("**DRAFT.** Generated from the decision ledger.");
  lines.push("");
  lines.push(`${firmName} · generated ${fmtDate(generatedAt)} · ledger position event ${throughEvent}`);
  lines.push("");
  lines.push(
    "Shaped by SR 11-7, which asks that model documentation be understandable by parties " +
      "unfamiliar with the model. So this starts with what the strategy does.",
  );
  lines.push(rule);
  lines.push("## What it does");
  lines.push("");
  lines.push(strategy.description);
  lines.push("");
  lines.push(`Status: ${strategy.status}.`);
  lines.push("");
  lines.push(rule);
  lines.push("## Who understands it");
  lines.push("");
  if (score) {
    lines.push(`- Largest recorded contributor: ${memberName(score.topHolderMemberId)}`);
    lines.push(`- Bus factor: ${score.busFactor}`);
    lines.push(`- Authorship concentration: ${score.concentration.toFixed(2)}`);
    lines.push(`- Contributors with recorded reasoning: ${score.breakdown.contributors}`);
    lines.push("");
    if (score.busFactor <= 1) {
      lines.push(
        "A bus factor of one means one person holds the majority of the recorded " +
          "reasoning and nobody else has covered the same ground. This is a documentation " +
          "finding, not a performance one.",
      );
      lines.push("");
    }
  }
  lines.push(rule);
  lines.push("## What has changed, and why");
  lines.push("");
  for (const [type, list] of [...byType.entries()].sort()) {
    lines.push(`### ${type.replace(/_/g, " ")} (${list.length})`);
    lines.push("");
    for (const d of list.slice(0, 6)) {
      lines.push(`**${d.title}** · ${fmtDate(d.occurredAt)} · ${memberName(d.authorMemberId)}`);
      lines.push("");
      lines.push(d.why);
      lines.push("");
    }
  }
  lines.push(rule);
  lines.push("## Known gaps");
  lines.push("");
  const open = questions.filter((q) => q.strategyId === strategy.id && !q.answeredByDecisionId);
  if (open.length === 0) {
    lines.push("No open questions recorded against this strategy.");
  } else {
    lines.push(
      "Questions that have been asked and not answered in the record. Listed because " +
        "documentation that omits its own gaps is not documentation.",
    );
    lines.push("");
    for (const q of open) lines.push(`- ${q.text}`);
  }
  lines.push("");
  return lines.join("\n");
}
