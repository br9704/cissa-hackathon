/*
  Builds the whole Meridian Basis Partners corpus in memory, deterministically.

  Nothing here touches a database. That separation is what lets the ML export and the
  Postgres load read from exactly the same generated objects, so the labels the tagger
  trains on are the labels the app displays, by construction rather than by care.
*/
import { makeRng, makeUuid, type Rng } from "../rng.js";
import {
  FIRM_NAME, PERSONAS, STRATEGIES, TEMPLATES, PARAMS, VENUES, SOURCES, CLOSERS,
  type DecisionType, type PersonaKey, type Vars,
} from "./vocabulary.js";

export const DEFAULT_SEED = 20260822;

export type Member = {
  id: string; userId: string; key: PersonaKey; role: string; displayName: string; desk: string;
};
export type Strategy = {
  id: string; key: string; name: string; status: string; description: string; createdBy: string;
};
export type Artifact = {
  id: string; strategyId: string | null; kind: string; externalRef: string | null;
  contentHash: string; authorMemberId: string; occurredAt: string; rawMeta: unknown;
};
export type Decision = {
  id: string; strategyId: string; title: string; whatChanged: string; why: string;
  alternatives: string[]; confidence: "low" | "medium" | "high"; tags: string[];
  decisionType: DecisionType; riskFlag: boolean; authorMemberId: string;
  approvedAt: string | null; draftedBy: "human" | "model"; sourceArtifactIds: string[];
  occurredAt: string;
};
export type DecisionLink = { parent: string; child: string; relation: string };
export type DebriefSession = {
  id: string; memberId: string; strategyId: string; scheduledFor: string;
  completedAt: string | null; triggerReason: string;
};
export type DebriefTurn = {
  sessionId: string; seq: number; role: "agent" | "human"; text: string;
  groundedArtifactIds: string[];
};
export type Question = {
  id: string; strategyId: string; text: string; askedBy: string;
  answeredByDecisionId: string | null; undocumentedness: number;
};

export type Corpus = {
  firmId: string;
  firmName: string;
  members: Member[];
  strategies: Strategy[];
  artifacts: Artifact[];
  decisions: Decision[];
  links: DecisionLink[];
  sessions: DebriefSession[];
  turns: DebriefTurn[];
  questions: Question[];
  /* The labelled rows the tagger trains on. Free, because the generator knows the answer. */
  labelled: { text: string; label: DecisionType; risk: boolean }[];
};

/* The corpus runs backwards from a fixed date so that "two days after the flag" means
   something and every relative reference in the text lines up with a real timestamp. */
const END = Date.UTC(2026, 7, 21, 9, 0, 0);
const DAY = 86_400_000;

const iso = (ms: number) => new Date(ms).toISOString();
const daysAgo = (n: number, hourOffset = 0) => iso(END - n * DAY + hourOffset * 3_600_000);
const humanDate = (n: number) =>
  new Date(END - n * DAY).toLocaleDateString("en-AU", { day: "numeric", month: "long" });

function makeVars(rng: Rng, dayIndex: number): Vars {
  return {
    param: rng.pick(PARAMS),
    from: (rng.int(50, 80) / 100).toFixed(2),
    to: (rng.int(60, 95) / 100).toFixed(2),
    venue: rng.pick(VENUES),
    window: rng.pick(["expiry window", "final session", "morning session", "roll window", "weekly cycle"]),
    source: rng.pick(SOURCES),
    date: humanDate(dayIndex + rng.int(1, 20)),
    pct: `${rng.int(10, 40)} percent`,
  };
}

/* A content hash that is stable for the same text, so a reseed does not churn every row. */
function stableHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

export function generate(seed: number = DEFAULT_SEED): Corpus {
  const rng = makeRng(seed);
  const firmId = makeUuid(rng);

  const members: Member[] = PERSONAS.map((p) => ({
    id: makeUuid(rng),
    userId: makeUuid(rng),
    key: p.key,
    role: p.role,
    displayName: p.displayName,
    desk: p.desk,
  }));
  const byKey = new Map(members.map((m) => [m.key, m]));
  const member = (k: PersonaKey) => byKey.get(k)!;

  const strategies: Strategy[] = STRATEGIES.map((s) => ({
    id: makeUuid(rng),
    key: s.key,
    name: s.name,
    status: s.status,
    description: s.description,
    createdBy: member(s.primary).id,
  }));
  const strategyByKey = new Map(strategies.map((s) => [s.key, s]));

  const artifacts: Artifact[] = [];
  const decisions: Decision[] = [];
  const links: DecisionLink[] = [];

  /*
    Authorship is weighted, not uniform. A desk where everyone contributes evenly has no
    bus factor problem and therefore nothing to demonstrate. Daniel writes most of two
    books and writes them alone, which is what the risk board is supposed to find.
  */
  function authorFor(strategyKey: string): PersonaKey {
    const spec = STRATEGIES.find((s) => s.key === strategyKey)!;
    if (rng.chance(spec.dominance)) return spec.primary;
    return rng.pick(spec.secondary.length ? spec.secondary : [spec.primary]);
  }

  // --- meeting transcripts. Four of them, and decisions cite them.
  const MEETINGS = [
    { key: "standup_aug", title: "Vol desk standup", strategy: "vol_filter", day: 9,
      attendees: ["priya", "tom", "marcus"] as PersonaKey[] },
    { key: "standup_jul", title: "India desk standup", strategy: "india_carry", day: 34,
      attendees: ["daniel", "marcus"] as PersonaKey[] },
    { key: "review", title: "Quarterly strategy review", strategy: "expiry_effects", day: 52,
      attendees: ["marcus", "daniel", "priya", "elena"] as PersonaKey[] },
    { key: "risk", title: "Risk meeting after the August flag", strategy: "india_carry", day: 17,
      attendees: ["elena", "marcus", "daniel"] as PersonaKey[] },
  ];

  const transcriptByKey = new Map<string, Artifact>();
  for (const m of MEETINGS) {
    const strategy = strategyByKey.get(m.strategy)!;
    const turns = m.attendees.flatMap((who, i) => {
      const speaker = member(who);
      return [
        {
          speaker: speaker.displayName,
          at: daysAgo(m.day, i),
          text: rng.pick([
            `The ${strategy.name} book is behaving, but the filter is doing more work than it should be.`,
            `I want to know what happens to that number when the next flag lands, not what it did last month.`,
            `We changed it once already and nobody wrote down why, which is the actual problem here.`,
            `Give me the version of this that someone covering the desk could read in ten minutes.`,
            `If the answer is only in one person's head then it is not a strategy, it is a dependency.`,
          ]),
        },
      ];
    });
    const text = turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
    const artifact: Artifact = {
      id: makeUuid(rng),
      strategyId: strategy.id,
      kind: "meeting_transcript",
      externalRef: null,
      contentHash: stableHash(text),
      authorMemberId: member(m.attendees[0]!).id,
      occurredAt: daysAgo(m.day),
      rawMeta: {
        title: m.title,
        attendees: m.attendees.map((a) => member(a).displayName),
        turns,
      },
    };
    artifacts.push(artifact);
    transcriptByKey.set(m.key, artifact);
  }

  // --- decisions, each with the commit or notebook it came from.
  const DECISION_COUNT = 184;
  const byStrategy = new Map<string, Decision[]>(strategies.map((s) => [s.id, []]));

  for (let i = 0; i < DECISION_COUNT; i++) {
    /* Weighted toward the live books. A paper strategy with as much recorded history as
       a live one does not look like a real desk. */
    const spec = rng.pick([
      ...STRATEGIES.filter((s) => s.status === "live"),
      ...STRATEGIES.filter((s) => s.status === "live"),
      ...STRATEGIES,
    ]);
    const strategy = strategyByKey.get(spec.key)!;
    const authorKey = authorFor(spec.key);
    const author = member(authorKey);
    /* Spread across roughly six months, newest first. */
    const dayIndex = Math.floor((i / DECISION_COUNT) * 170) + rng.int(0, 3);
    const vars = makeVars(rng, dayIndex);
    const template = rng.pick(TEMPLATES);

    const artifactKind = rng.pick(["commit", "commit", "commit", "notebook", "param_file"]);
    const body = template.whatChanged(vars);
    const artifact: Artifact = {
      id: makeUuid(rng),
      strategyId: strategy.id,
      kind: artifactKind,
      externalRef:
        artifactKind === "commit"
          ? stableHash(body).slice(0, 7)
          : `research/${spec.key}/${vars.param}.ipynb`,
      contentHash: stableHash(body),
      authorMemberId: author.id,
      occurredAt: daysAgo(dayIndex, -2),
      rawMeta: { message: template.title(vars) },
    };
    artifacts.push(artifact);

    const sources = [artifact.id];
    /* Roughly one decision in seven cites a meeting, which is what makes the total
       context claim visible in the product rather than only in the pitch. */
    const meetingsHere = MEETINGS.filter((m) => m.strategy === spec.key);
    if (meetingsHere.length > 0 && rng.chance(0.14)) {
      /* Not every book has a recorded meeting: basis_roll is in paper and never came up
         in one. Checking the list before picking rather than after is the difference
         between a corpus that generates and one that throws on the fourth strategy. */
      sources.push(transcriptByKey.get(rng.pick(meetingsHere).key)!.id);
    }

    const decision: Decision = {
      id: makeUuid(rng),
      strategyId: strategy.id,
      title: template.title(vars),
      whatChanged: body,
      why: template.why(vars),
      alternatives: template.alternatives(vars),
      confidence: rng.pick(["low", "medium", "high", "high", "medium"] as const),
      tags: [spec.key, vars.param],
      decisionType: template.type,
      riskFlag: template.risk,
      authorMemberId: author.id,
      approvedAt: daysAgo(dayIndex),
      /* A handful stay unapproved so the draft queue has something in it on load. */
      draftedBy: i < 3 ? "model" : rng.chance(0.12) ? "model" : "human",
      sourceArtifactIds: sources,
      occurredAt: daysAgo(dayIndex),
    };
    if (i < 3) decision.approvedAt = null;
    decisions.push(decision);
    byStrategy.get(strategy.id)!.push(decision);
  }

  /* Genealogy. Within a strategy, a later decision on the same parameter supersedes the
     earlier one, which is the edge that actually means something. The rest inform. */
  for (const list of byStrategy.values()) {
    const ordered = list.slice().sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const lastByParam = new Map<string, Decision>();
    for (const d of ordered) {
      const param = d.tags[1]!;
      const prior = lastByParam.get(param);
      if (prior && prior.id !== d.id) {
        links.push({ parent: prior.id, child: d.id, relation: "supersedes" });
      } else if (rng.chance(0.35)) {
        const other = rng.pick(ordered.slice(0, Math.max(1, ordered.indexOf(d))));
        if (other && other.id !== d.id) {
          links.push({ parent: other.id, child: d.id, relation: "informs" });
        }
      }
      lastByParam.set(param, d);
    }
  }

  // --- debriefs. Six sessions, one of them Daniel's exit.
  const sessions: DebriefSession[] = [];
  const turns: DebriefTurn[] = [];

  const SESSION_PLAN = [
    { who: "priya" as PersonaKey, strategy: "vol_filter", reason: "post_merge", day: 6 },
    { who: "daniel" as PersonaKey, strategy: "india_carry", reason: "drawdown_flag", day: 16 },
    { who: "tom" as PersonaKey, strategy: "vol_filter", reason: "weekly_pulse", day: 12 },
    { who: "marcus" as PersonaKey, strategy: "basis_roll", reason: "half_life_refresh", day: 28 },
    { who: "daniel" as PersonaKey, strategy: "expiry_effects", reason: "post_merge", day: 21 },
    { who: "daniel" as PersonaKey, strategy: "india_carry", reason: "exit", day: 1 },
  ];

  for (const plan of SESSION_PLAN) {
    const strategy = strategyByKey.get(plan.strategy)!;
    const who = member(plan.who);
    const session: DebriefSession = {
      id: makeUuid(rng),
      memberId: who.id,
      strategyId: strategy.id,
      scheduledFor: daysAgo(plan.day, -1),
      completedAt: daysAgo(plan.day),
      triggerReason: plan.reason,
    };
    sessions.push(session);

    const theirDecisions = decisions.filter(
      (d) => d.strategyId === strategy.id && d.authorMemberId === who.id,
    );
    const questionCount = plan.reason === "exit" ? 6 : rng.int(3, 5);
    let seq = 0;

    for (let q = 0; q < questionCount; q++) {
      const subject = theirDecisions[q % Math.max(1, theirDecisions.length)];
      /* Every agent question names something the person actually did. An ungrounded
         question is the interviewer guessing, and the corpus is precisely what removes
         the need to guess. */
      const grounded = subject ? subject.sourceArtifactIds.slice(0, 1) : [];
      const meeting =
        plan.reason === "exit" && q === 1
          ? [transcriptByKey.get("risk")!.id]
          : [];

      turns.push({
        sessionId: session.id,
        seq: seq++,
        role: "agent",
        text: subject
          ? `On ${humanDate(plan.day + q + 2)} you ${subject.title.charAt(0).toLowerCase()}${subject.title.slice(1)}. Walk me through what you rejected before you landed there.`
          : `What is the thing about ${strategy.name} that you would tell someone covering it, that is not written down anywhere?`,
        groundedArtifactIds: meeting.length ? meeting : grounded,
      });

      turns.push({
        sessionId: session.id,
        seq: seq++,
        role: "human",
        text: subject
          ? `${subject.why} ${subject.alternatives.length ? `I did look at ${subject.alternatives[0]!.toLowerCase()}, and it did not hold up once the flag was in the sample.` : "There was not really a second option worth writing down."}`
          : `The filter looks like it is about vol and it is really about liquidity. On a quiet expiry it reads fine and the book still cannot get out. Nobody has written that down because it has never cost us enough to notice.`,
        groundedArtifactIds: [],
      });
    }
  }

  // --- the open questions feed, ranked by how undocumented they are.
  const QUESTION_TEXTS = [
    "Why is the expiry window capped at the level it is, rather than one step wider?",
    "What was the reasoning behind excluding the corporate action window from the fit?",
    "Which venue does the liquidity filter actually bind on, and has that changed?",
    "Is the borrow haircut still right after the prime broker change?",
    "What does the desk do if the flag fires twice inside one cycle?",
    "Why does the roll happen before the close and not at it?",
    "Which parts of the India book only Daniel has ever run end to end?",
    "What is the restart procedure after the consecutive loss stop trips?",
  ];

  const questions: Question[] = QUESTION_TEXTS.map((text, i) => {
    const strategy = rng.pick(strategies);
    const answered = rng.chance(0.35)
      ? rng.pick(decisions.filter((d) => d.strategyId === strategy.id))
      : null;
    return {
      id: makeUuid(rng),
      strategyId: strategy.id,
      text,
      askedBy: member(rng.pick(["tom", "marcus", "elena"] as PersonaKey[])).id,
      answeredByDecisionId: answered?.id ?? null,
      /* Higher means less documented. The unanswered ones sort to the top. */
      undocumentedness: answered ? 0.2 + i * 0.02 : 0.72 + i * 0.03,
    };
  }).map((q) => ({ ...q, undocumentedness: Math.min(0.999, q.undocumentedness) }));

  // --- the labelled set for the tagger.
  const labelled: Corpus["labelled"] = [];
  for (const d of decisions) {
    labelled.push({
      text: `${d.title}\n${d.whatChanged}\n${d.why}`,
      label: d.decisionType,
      risk: d.riskFlag,
    });
  }
  /* Pad out to the training target with fresh variations rather than duplicates: the
     same templates with different variables, which is what the tagger will actually see
     when new decisions arrive. Duplicating rows would inflate the count and teach the
     model nothing it does not already know. */
  const TARGET = 2200;
  const seenText = new Set(labelled.map((l) => l.text));
  let guard = 0;
  while (labelled.length < TARGET) {
    /* The guard is a real backstop, not decoration. If the variable space ever narrows
       enough that fresh rows stop appearing, this loop would otherwise spin forever and
       the failure would look like a hang rather than a data problem. */
    if (guard++ > TARGET * 50) {
      throw new Error(
        `ran out of distinct training rows at ${labelled.length} of ${TARGET}: widen the template or CLOSERS pool`,
      );
    }
    const template = rng.pick(TEMPLATES);
    const vars = makeVars(rng, rng.int(0, 170));
    const text =
      `${template.title(vars)}\n${template.whatChanged(vars)}\n` +
      `${template.why(vars)} ${rng.pick(CLOSERS)}`;
    if (seenText.has(text)) continue;
    seenText.add(text);
    labelled.push({ text, label: template.type, risk: template.risk });
  }

  return {
    firmId, firmName: FIRM_NAME, members, strategies, artifacts, decisions, links,
    sessions, turns, questions, labelled,
  };
}
