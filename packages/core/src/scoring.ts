/*
  Knowledge risk scoring.

  Pure functions over rows. No database, no clock, no configuration: the same inputs give
  the same numbers in the nightly job, in the on demand path, and in a unit test. That
  matters more than usual here because these numbers go on a slide.

  The one rule that shapes every function in this file: a score is a property of a
  STRATEGY, never of a person. There is a top holder field, and it exists so the
  departure simulation can name which decisions would be orphaned. It is not a ranking,
  there is no per person score anywhere, and any view that would rank individuals is a
  bug rather than a feature.
*/

export type AuthoredItem = {
  strategyId: string;
  authorMemberId: string;
  /* Risk flagged decisions count for more: they are the ones a successor most needs. */
  weight?: number;
};

export type StrategyScore = {
  strategyId: string;
  /* How many people would have to leave before the strategy loses most of its recorded
     reasoning. One is the number that should frighten a desk head. */
  busFactor: number;
  /* Herfindahl index over authorship shares. 0 is evenly spread, 1 is one person. */
  concentration: number;
  /* Can the desk answer its own open questions with this member masked. 0 to 100. */
  vacationReadiness: number;
  topHolderMemberId: string | null;
  breakdown: {
    totalItems: number;
    contributors: number;
    shares: { memberId: string; items: number; share: number }[];
    openQuestions: number;
    answerableWithoutTopHolder: number;
  };
};

/**
 * Authorship shares for one strategy, sorted heaviest first.
 */
function shares(items: AuthoredItem[]) {
  const byMember = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const w = item.weight ?? 1;
    byMember.set(item.authorMemberId, (byMember.get(item.authorMemberId) ?? 0) + w);
    total += w;
  }
  const out = [...byMember.entries()]
    .map(([memberId, weight]) => ({ memberId, items: weight, share: total ? weight / total : 0 }))
    .sort((a, b) => b.share - a.share);
  return { total, out };
}

/**
 * Herfindahl concentration: the sum of squared shares.
 *
 * Borrowed from competition economics, where it measures how much of a market sits with
 * how few firms, and it transfers cleanly: one author holding everything gives 1, ten
 * authors holding a tenth each gives 0.1. Unlike a simple "percent by the top person" it
 * notices the difference between a desk with two strong contributors and a desk with one
 * strong contributor and a long tail.
 */
export function herfindahl(items: AuthoredItem[]): number {
  const { out } = shares(items);
  return out.reduce((acc, s) => acc + s.share * s.share, 0);
}

/**
 * Bus factor: the smallest number of people whose departure removes more than half of
 * the recorded reasoning for a strategy.
 *
 * This is the truck factor idea from software, adapted from file authorship to decision
 * and artifact authorship. The threshold is half rather than some tuned number because
 * half is defensible without a footnote, and a score that needs a footnote does not get
 * used.
 */
export function busFactor(items: AuthoredItem[], threshold = 0.5): number {
  const { out } = shares(items);
  if (out.length === 0) return 0;
  let cumulative = 0;
  for (let i = 0; i < out.length; i++) {
    cumulative += out[i]!.share;
    if (cumulative > threshold) return i + 1;
  }
  return out.length;
}

/**
 * Vacation readiness: can the desk answer its own open questions with one person out.
 *
 * Named after the fire drill finance already runs. FINRA and NY DFS require a block of
 * mandatory leave with access cut, precisely so a firm finds out what it cannot do
 * without someone. Nobody scores whether the desk would pass. This does.
 *
 * A question counts as answerable without the top holder if it has been answered by a
 * decision that someone else authored. An unanswered question is not answerable by
 * anyone, which is the point of tracking it.
 */
export function vacationReadiness(
  openQuestions: { answeredByDecisionId: string | null }[],
  decisionAuthors: Map<string, string>,
  maskedMemberId: string | null,
): { score: number; answerable: number; total: number } {
  const total = openQuestions.length;
  if (total === 0) {
    /* No questions is not the same as being ready, but it is not a failure either, and
       inventing a number here would be exactly the kind of invented metric this project
       refuses to print. Report the honest 100 and let the breakdown show zero questions. */
    return { score: 100, answerable: 0, total: 0 };
  }
  let answerable = 0;
  for (const q of openQuestions) {
    if (!q.answeredByDecisionId) continue;
    const author = decisionAuthors.get(q.answeredByDecisionId);
    if (!author) continue;
    if (maskedMemberId && author === maskedMemberId) continue;
    answerable++;
  }
  return { score: Math.round((answerable / total) * 100), answerable, total };
}

export function scoreStrategy(input: {
  strategyId: string;
  items: AuthoredItem[];
  openQuestions: { answeredByDecisionId: string | null }[];
  decisionAuthors: Map<string, string>;
}): StrategyScore {
  const { total, out } = shares(input.items);
  const top = out[0]?.memberId ?? null;
  const readiness = vacationReadiness(input.openQuestions, input.decisionAuthors, top);

  return {
    strategyId: input.strategyId,
    busFactor: busFactor(input.items),
    concentration: herfindahl(input.items),
    vacationReadiness: readiness.score,
    topHolderMemberId: top,
    breakdown: {
      totalItems: total,
      contributors: out.length,
      shares: out,
      openQuestions: readiness.total,
      answerableWithoutTopHolder: readiness.answerable,
    },
  };
}

/**
 * What would be orphaned if this member left: the decisions only they have authored on
 * a strategy where nobody else has touched the same ground.
 *
 * "Orphaned" is a strong word, so it is defined narrowly. A decision is orphaned when
 * its author is leaving AND no remaining member has authored anything else about the
 * same parameter. A decision someone else has revisited is not orphaned, it is covered.
 */
export function simulateDeparture(
  memberId: string,
  decisions: { id: string; strategyId: string; authorMemberId: string; tags: string[]; title: string; riskFlag: boolean | null }[],
): { orphanedIds: string[]; byStrategy: Map<string, number> } {
  const theirs = decisions.filter((d) => d.authorMemberId === memberId);
  const remaining = decisions.filter((d) => d.authorMemberId !== memberId);

  /*
    Drop tags that carry no information about ground.

    Decisions usually carry a tag naming the strategy itself alongside the tag naming
    what was actually changed. A tag that appears on EVERY decision in a strategy tells
    you nothing about which part of it someone understands, and treating it as ground is
    how the simulation quietly reports that nothing would be orphaned: as soon as one
    other person has touched the book at all, every decision in it looks covered.

    Found by the first run of the departure test, which returned an empty orphan list for
    a member who unmistakably had orphaned work.
  */
  const perStrategyCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const d of decisions) {
    perStrategyCount.set(d.strategyId, (perStrategyCount.get(d.strategyId) ?? 0) + 1);
    for (const t of new Set(d.tags)) {
      const key = `${d.strategyId}::${t}`;
      tagCount.set(key, (tagCount.get(key) ?? 0) + 1);
    }
  }
  const discriminating = (strategyId: string, tag: string) => {
    const total = perStrategyCount.get(strategyId) ?? 0;
    if (total <= 1) return true;
    return (tagCount.get(`${strategyId}::${tag}`) ?? 0) < total;
  };

  const coveredGround = new Set(
    remaining.flatMap((d) =>
      d.tags
        .filter((t) => discriminating(d.strategyId, t))
        .map((t) => `${d.strategyId}::${t}`),
    ),
  );

  const orphanedIds: string[] = [];
  const byStrategy = new Map<string, number>();

  for (const d of theirs) {
    const covered = d.tags
      .filter((t) => discriminating(d.strategyId, t))
      .some((t) => coveredGround.has(`${d.strategyId}::${t}`));
    if (covered) continue;
    orphanedIds.push(d.id);
    byStrategy.set(d.strategyId, (byStrategy.get(d.strategyId) ?? 0) + 1);
  }

  return { orphanedIds, byStrategy };
}

/**
 * What a departure puts at risk, in revenue rather than in decision counts.
 *
 * A bus factor of 1 is a number a quant understands immediately and almost nobody else
 * does. Revenue attribution is how the same fact already sits in a desk head's mind, so
 * this converts one into the other without inventing anything: it sums the attributed
 * revenue of the strategies where this person is the top holder AND the recorded
 * reasoning has no second author.
 *
 * The definition is narrow on purpose, because a wide one would be more dramatic and
 * less true:
 *
 *   Exposed means the strategy has revenue, this person holds the majority of its
 *   recorded reasoning, and its bus factor is 1. A strategy where somebody else has also
 *   written things down is not exposed by this person leaving, however much they wrote.
 *
 *   Partial means they are top holder but the bus factor is above 1. Counted separately
 *   rather than folded in, because rolling it into the headline would let a book with a
 *   real second author inflate the number.
 *
 * Everything here is synthetic and the UI says so. Under the honest claims rule a dollar
 * figure is the single easiest thing to be caught overstating, so the arithmetic is
 * stated in full and the inputs are visible.
 */
export function departureExposure(
  memberId: string,
  strategies: { id: string; name: string; revenueUsdM: number }[],
  scores: Map<string, StrategyScore>,
): {
  exposedUsdM: number;
  partialUsdM: number;
  totalUsdM: number;
  exposed: { id: string; name: string; revenueUsdM: number }[];
  partial: { id: string; name: string; revenueUsdM: number }[];
} {
  const exposed: { id: string; name: string; revenueUsdM: number }[] = [];
  const partial: { id: string; name: string; revenueUsdM: number }[] = [];

  for (const s of strategies) {
    if (s.revenueUsdM <= 0) continue;
    const score = scores.get(s.id);
    if (!score || score.topHolderMemberId !== memberId) continue;
    if (score.busFactor <= 1) exposed.push(s);
    else partial.push(s);
  }

  const sum = (xs: { revenueUsdM: number }[]) => xs.reduce((a, b) => a + b.revenueUsdM, 0);

  return {
    exposedUsdM: sum(exposed),
    partialUsdM: sum(partial),
    totalUsdM: sum(strategies),
    exposed,
    partial,
  };
}
