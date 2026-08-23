/*
  The curriculum, derived from the ledger.

  This is the second problem the product exists for. The first is that knowledge leaves when
  a person does. The second is that a desk which loses a portfolio manager loses value
  immediately, and the long answer is not retention: it is that the firm's own record of how
  its people think becomes the thing that trains the next ones.

  So none of this is authored. A module is a book, its lessons are the decisions actually
  recorded on it, and the order comes from genealogy links that already exist, because a
  decision that superseded another is only comprehensible after the one it replaced.

  Two rules, and the second is enforced by the design audit against identifiers:

    Coverage describes the RECORD, not a person. "This book has 48 decisions and 6 of them
    have nobody left who can explain them" is a fact about the ledger.

    Nothing here scores a person. Not the trainee, not the author. The moment a training
    surface ranks people it becomes a performance tool, everybody learns to game it, and the
    record stops being honest, which destroys the thing the whole product depends on.
*/
import type { Corpus, Decision } from "@continuity/core";

export type Lesson = {
  decisionId: string;
  title: string;
  why: string;
  authorName: string;
  authorGone: boolean;
  orphaned: boolean;
  occurredAt: string;
};

export type Module = {
  strategyId: string;
  name: string;
  description: string;
  lessons: Lesson[];
  /* Open questions ARE the syllabus: precisely what the desk has not written down, which is
     what a new person most needs told out loud while somebody can still tell them. */
  openQuestions: { id: string; text: string }[];
  coverage: number;
  gaps: number;
};

/**
 * Order lessons so a decision never appears before the one it replaced.
 *
 * Topological over the genealogy links, falling back to date order. A hand seeded corpus can
 * contain a cycle and a naive walk would hang, so anything unresolved is appended rather than
 * dropped: an imperfect order beats a missing lesson.
 */
export function orderLessons(
  decisions: Decision[],
  links: { parent: string; child: string }[],
): Decision[] {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const parents = new Map<string, string[]>();
  for (const l of links) {
    if (!byId.has(l.child) || !byId.has(l.parent)) continue;
    parents.set(l.child, [...(parents.get(l.child) ?? []), l.parent]);
  }

  const out: Decision[] = [];
  const placed = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string): void {
    if (placed.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const p of parents.get(id) ?? []) visit(p);
    visiting.delete(id);
    const d = byId.get(id);
    if (d && !placed.has(id)) {
      placed.add(id);
      out.push(d);
    }
  }

  for (const d of [...decisions].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) {
    visit(d.id);
  }
  return out;
}

export function buildCurriculum(corpus: Corpus): Module[] {
  const members = new Map(corpus.members.map((m) => [m.id, m]));

  const modules = corpus.strategies.map((s) => {
    const decisions = corpus.decisions.filter((d) => d.strategyId === s.id);
    const ordered = orderLessons(decisions, corpus.links);

    const authors = new Set(decisions.map((d) => d.authorMemberId));
    const remaining = [...authors].filter((id) => !members.get(id)?.resignedOn);

    const lessons: Lesson[] = ordered.map((d) => {
      const author = members.get(d.authorMemberId);
      const gone = Boolean(author?.resignedOn);
      return {
        decisionId: d.id,
        title: d.title,
        why: d.why,
        authorName: author?.displayName ?? "unknown",
        authorGone: gone,
        /* Orphaned needs BOTH: the author gone and nobody still here writing on this book.
           One author leaving a book two people share is not a gap in the record. */
        orphaned: gone && remaining.length === 0,
        occurredAt: d.occurredAt,
      };
    });

    const gaps = lessons.filter((l) => l.orphaned).length;

    return {
      strategyId: s.id,
      name: s.name,
      description: s.description,
      lessons,
      openQuestions: corpus.questions
        .filter((q) => q.strategyId === s.id && !q.answeredByDecisionId)
        .map((q) => ({ id: q.id, text: q.text })),
      coverage: lessons.length === 0 ? 1 : (lessons.length - gaps) / lessons.length,
      gaps,
    };
  });

  /*
    Hardest first, deliberately.

    A new person's time is best spent where the record is thinnest and the people who wrote
    it are gone, because that is the material nobody can explain to them later. Sorting the
    comfortable modules first would teach them the parts they could have picked up by asking.
  */
  return modules.sort((a, b) => a.coverage - b.coverage || b.gaps - a.gaps);
}
