/*
  The world of Meridian Basis Partners.

  All of this is invented. It has to be plausible to someone who trades for a living and
  it must not resemble any real firm's book, so the strategies are ordinary published
  ideas (index carry, vol filters, expiry effects) rather than anything with an edge in
  it.

  Kept as data rather than woven into the generator so a demo detail can be changed in
  one place without touching the code that assembles the corpus.
*/

export const FIRM_NAME = "Meridian Basis Partners";

/*
  Five people. Daniel is the one who resigns, and the whole dramatic arc of the demo
  depends on him having genuinely concentrated knowledge in the corpus rather than a
  flag that says he does. So he authors more, and more of it alone.
*/
export const PERSONAS = [
  {
    key: "priya",
    displayName: "Priya Raghunathan",
    role: "researcher",
    desk: "Vol",
    voice: "precise, hedged, shows her working",
  },
  {
    key: "marcus",
    displayName: "Marcus Adeyemi",
    role: "desk_head",
    desk: "India options",
    voice: "short sentences, asks what it costs",
  },
  {
    key: "elena",
    displayName: "Elena Vasquez",
    role: "compliance",
    desk: "Risk and compliance",
    voice: "formal, cites the rule",
  },
  {
    key: "daniel",
    displayName: "Daniel Okonkwo",
    role: "researcher",
    desk: "India options",
    voice: "conversational, reasons out loud, assumes context",
  },
  {
    key: "tom",
    displayName: "Tom Bergstrom",
    role: "researcher",
    desk: "Vol",
    voice: "asks basic questions without embarrassment",
  },
] as const;

export type PersonaKey = (typeof PERSONAS)[number]["key"];

export const STRATEGIES = [
  {
    key: "india_carry",
    name: "India options carry",
    status: "live",
    description:
      "Systematic short volatility in NIFTY weekly options, sized against realised vol and an expiry day liquidity filter.",
    /* Daniel's, and heavily so. This concentration IS the demo: the departure
       simulation has nothing to show unless someone genuinely holds a book alone. */
    primary: "daniel" as PersonaKey,
    secondary: ["marcus"] as PersonaKey[],
    dominance: 0.88,
  },
  {
    key: "expiry_effects",
    name: "Expiry window effects",
    status: "live",
    description:
      "Intraday positioning around index expiry, with position caps that tighten inside the final session.",
    primary: "daniel" as PersonaKey,
    secondary: ["priya"] as PersonaKey[],
    dominance: 0.84,
  },
  {
    key: "vol_filter",
    name: "Cross asset vol filter",
    status: "live",
    description:
      "A regime filter on realised versus implied vol that gates entry for the other books.",
    /* Healthy by comparison. The contrast is the point: a desk where every book looks
       like the India book has no story, it just has a policy problem. */
    primary: "priya" as PersonaKey,
    secondary: ["tom", "daniel"] as PersonaKey[],
    dominance: 0.5,
  },
  {
    key: "basis_roll",
    name: "Futures basis roll",
    status: "paper",
    description:
      "Calendar roll timing on index futures, currently in paper while the borrow assumptions are checked.",
    primary: "marcus" as PersonaKey,
    secondary: ["priya", "tom"] as PersonaKey[],
    dominance: 0.45,
  },
] as const;

export type StrategyKey = (typeof STRATEGIES)[number]["key"];

/*
  The seven classes the tagger learns. These are the label space, so the templates below
  are grouped by class and the generator knows the answer for every row it emits. That is
  what makes 2000 labelled training rows free rather than a labelling project.
*/
export const DECISION_TYPES = [
  "parameter_change",
  "risk_limit",
  "data_handling",
  "execution",
  "universe",
  "infra",
  "process",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

type Template = {
  type: DecisionType;
  /* Risk flagged decisions are the ones a regulator or a successor would want to see. */
  risk: boolean;
  title: (v: Vars) => string;
  whatChanged: (v: Vars) => string;
  why: (v: Vars) => string;
  alternatives: (v: Vars) => string[];
};

export type Vars = {
  param: string;
  from: string;
  to: string;
  venue: string;
  window: string;
  source: string;
  date: string;
  pct: string;
};

export const PARAMS = [
  "vol_filter", "expiry_cap", "entry_threshold", "roll_window", "borrow_haircut",
  "max_gamma", "slippage_budget", "realised_lookback", "strike_band", "delta_cap",
];

export const VENUES = ["NSE", "CME", "Eurex", "SGX", "the primary venue"];
/*
  A closing clause, appended to the "why" of a generated training row.

  Real captured reasoning is not template shaped: two people changing the same parameter
  for the same reason still write it up differently, and the tagger has to survive that.
  Without this pool the padded rows collide heavily, and a training set that is mostly
  duplicates inflates its own row count while teaching the model nothing it has not
  already seen. The uniqueness assertion in generate.test.ts is what caught that.
*/
export const CLOSERS = [
  "Reviewed with the desk before it went live.",
  "Backtested over the last four quarters, including the flagged sessions.",
  "Marcus signed off on this one.",
  "Paper only until the next review.",
  "This supersedes the note from the previous cycle.",
  "Nobody objected, which is not the same as agreement, so it is written down here.",
  "The old behaviour is still reachable behind a flag if we need to roll back.",
  "Checked against the compliance record before shipping.",
  "Same change was rejected last quarter for reasons that no longer apply.",
  "Sized deliberately small for the first cycle.",
  "Worth revisiting once the borrow assumptions are settled.",
  "Elena asked for this to be explicit rather than implied.",
  "The number is judgement, not optimisation, and it should be treated that way.",
  "One session of live data so far, so treat the result as directional.",
  "Documented now because the person who knows why is going on leave.",
  "This is the second attempt; the first one moved too much at once.",
  "Held off shipping until the pipeline smoke test was in place.",
  "The alternative would have been faster to build and harder to explain.",
  "Agreed at the standup and filed the same morning.",
  "Cost is small and known; the risk of leaving it is neither.",
  "Reverted once already, so the reasoning matters more than usual here.",
  "Applies to the live book only, not to research.",
  "Left the research path untouched on purpose.",
  "If this is still here in six months somebody should ask why.",
];

export const SOURCES = [
  "the vendor tick feed", "the exchange settlement file", "the internal risk warehouse",
  "the prime broker file", "the corporate actions feed",
];

/*
  Ten templates per class, forty words of variation each. Deliberately written in the
  voice a quant would actually use in a commit message or a debrief: short, specific,
  and assuming the reader knows the book. Text that reads like documentation is text the
  tagger learns nothing useful from, because real captured text never looks like that.
*/
export const TEMPLATES: Template[] = [
  // ---- parameter_change
  { type: "parameter_change", risk: false,
    title: (v) => `Raised ${v.param} to ${v.to}`,
    whatChanged: (v) => `${v.param} moved from ${v.from} to ${v.to}.`,
    why: (v) => `Realised vol has been running above the ${v.window} average since ${v.date} and the old level was letting us in too early. ${v.to} is where the backtest stops giving back the first day.`,
    alternatives: (v) => [`Held at ${v.from} and widened the stop instead`, `Tried ${v.to} minus one step, too slow to re-enter`] },
  { type: "parameter_change", risk: false,
    title: (v) => `Lowered ${v.param} to ${v.to}`,
    whatChanged: (v) => `${v.param} ${v.from} to ${v.to}, effective next session.`,
    why: (v) => `We were leaving the ${v.window} entirely on quiet days. Lowering it costs a little in drawdown and picks up most of what we were missing.`,
    alternatives: () => ["Left it and accepted the missed days", "Made it regime dependent, too many moving parts for now"] },
  { type: "parameter_change", risk: true,
    title: (v) => `Widened ${v.param} after the ${v.date} drawdown flag`,
    whatChanged: (v) => `${v.param} widened from ${v.from} to ${v.to}.`,
    why: (v) => `The flag on ${v.date} was a liquidity event, not a signal failure, and the tight ${v.from} turned a bad hour into a bad week. This is a risk decision as much as a parameter one.`,
    alternatives: () => ["Cut size instead of widening", "Paused the book for a session"] },
  { type: "parameter_change", risk: false,
    title: (v) => `Retuned ${v.param} on the longer lookback`,
    whatChanged: (v) => `${v.param} now reads the ${v.window} window rather than the previous one.`,
    why: () => "The short window was tracking noise. The longer one lags by about a session and is far more stable across regimes.",
    alternatives: () => ["Blended the two windows, marginal and harder to explain"] },
  { type: "parameter_change", risk: false,
    title: (v) => `Set ${v.param} per venue instead of globally`,
    whatChanged: (v) => `${v.param} split into per venue values, starting with ${v.venue}.`,
    why: (v) => `${v.venue} behaves differently enough at the open that one global number was wrong in both directions.`,
    alternatives: () => ["Kept it global and accepted the worse fills"] },

  // ---- risk_limit
  { type: "risk_limit", risk: true,
    title: (v) => `Capped position size in the ${v.window}`,
    whatChanged: (v) => `Hard cap introduced inside the ${v.window}, sized off the previous session close.`,
    why: (v) => `Two days after the ${v.date} flag we were carrying more into the close than the book is meant to hold. The cap is deliberately blunt: it should bind rarely and obviously.`,
    alternatives: () => ["Soft cap with an override, rejected because overrides never get reviewed", "Sized off realised vol, too slow to react"] },
  { type: "risk_limit", risk: true,
    title: (v) => `Cut ${v.param} ceiling by ${v.pct}`,
    whatChanged: (v) => `${v.param} ceiling reduced ${v.pct}.`,
    why: () => "Concentration crept up over the quarter without any single decision causing it. This resets the ceiling to where it was assumed to be.",
    alternatives: () => ["Left it and monitored, which is what we did last time"] },
  { type: "risk_limit", risk: true,
    title: () => "Added a hard stop on consecutive losing sessions",
    whatChanged: () => "Book pauses automatically after a run of losing sessions and needs a human to restart it.",
    why: () => "The failure mode is not a big loss, it is a slow one that nobody stops. A rule that requires a person to restart is the point.",
    alternatives: () => ["Alert only, which is what we had and it did not work"] },
  { type: "risk_limit", risk: false,
    title: (v) => `Documented the existing ${v.param} limit`,
    whatChanged: (v) => `No change to ${v.param}. The limit is now written down with its rationale.`,
    why: () => "The number was right and undocumented, which means it was one departure away from being arbitrary.",
    alternatives: () => [] },
  { type: "risk_limit", risk: true,
    title: (v) => `Tightened intraday ${v.param} into expiry`,
    whatChanged: (v) => `${v.param} steps down inside the final session rather than holding flat.`,
    why: () => "Gamma into the close does not behave like gamma at any other point in the cycle, and a flat limit is the wrong shape for it.",
    alternatives: () => ["Flat but lower all cycle, gives up too much on the quiet days"] },

  // ---- data_handling
  { type: "data_handling", risk: false,
    title: (v) => `Switched to ${v.source} for settlement prices`,
    whatChanged: (v) => `Settlement now comes from ${v.source}.`,
    why: () => "The previous source revised silently after the close, so a backtest run in the morning disagreed with one run at night. Same numbers, different answers, no error anywhere.",
    alternatives: () => ["Snapshotted the old source at a fixed time, still wrong just consistently wrong"] },
  { type: "data_handling", risk: true,
    title: () => "Excluded the corporate action window from the fit",
    whatChanged: () => "Sessions inside a corporate action window are dropped from the training set.",
    why: () => "The adjustments land late and the unadjusted prices were being learned as signal. This is the kind of thing that looks like alpha until it costs money.",
    alternatives: () => ["Adjusted retroactively, which works and needs a rebuild every time"] },
  { type: "data_handling", risk: false,
    title: (v) => `Forward filled ${v.source} gaps up to one session`,
    whatChanged: (v) => `Short gaps in ${v.source} are carried forward, longer gaps drop the session.`,
    why: () => "A single missing print was killing whole sessions. One session is where carrying forward stops being reasonable.",
    alternatives: () => ["Interpolated, rejected because it invents prices that never traded"] },
  { type: "data_handling", risk: false,
    title: () => "Moved the timestamp normalisation upstream",
    whatChanged: () => "Timestamps are normalised on ingest rather than at read.",
    why: () => "Three different readers were each doing their own version, and two of them were subtly wrong about the exchange holiday calendar.",
    alternatives: () => [] },
  { type: "data_handling", risk: true,
    title: () => "Quarantined the vendor revision feed",
    whatChanged: () => "Revisions land in a separate table and are applied deliberately rather than automatically.",
    why: () => "A revision rewrote history under a live book. The data was more correct afterwards and the position was not.",
    alternatives: () => ["Applied automatically with an alert, same problem plus an email"] },

  // ---- execution
  { type: "execution", risk: false,
    title: (v) => `Moved the roll to the ${v.window}`,
    whatChanged: (v) => `Roll executes in the ${v.window} rather than at the close.`,
    why: () => "The close is where everyone else rolls, and the slippage shows it. Earlier is thinner but cheaper on net.",
    alternatives: () => ["Split across both, halves the benefit and doubles the operational work"] },
  { type: "execution", risk: false,
    title: (v) => `Routed ${v.venue} flow through the passive book`,
    whatChanged: (v) => `${v.venue} orders default to passive with a time based escalation.`,
    why: () => "We were paying the spread on trades that had no urgency. The escalation stops it turning into never filling.",
    alternatives: () => ["Fully passive, we missed entries"] },
  { type: "execution", risk: true,
    title: () => "Added a fat finger check on the order size",
    whatChanged: () => "Orders above a multiple of the average size require confirmation.",
    why: () => "Nothing happened. That is the point of adding it now rather than after something does.",
    alternatives: () => [] },
  { type: "execution", risk: false,
    title: (v) => `Slowed the ${v.param} unwind`,
    whatChanged: (v) => `Unwind now spreads across the ${v.window}.`,
    why: () => "We were the flow. Spreading it out costs a little in timing risk and a lot less in impact.",
    alternatives: () => ["Unwound at the open instead, same problem earlier in the day"] },
  { type: "execution", risk: false,
    title: () => "Stopped crossing the spread on the last clip",
    whatChanged: () => "The final clip of an unwind waits rather than crossing.",
    why: () => "The last clip is the one nobody is watching and it was the most expensive one by some distance.",
    alternatives: () => [] },

  // ---- universe
  { type: "universe", risk: false,
    title: (v) => `Added ${v.venue} names to the universe`,
    whatChanged: (v) => `${v.venue} listed names now in scope, subject to the liquidity filter.`,
    why: () => "The filter was already doing the work; the venue restriction was historical and nobody could say why it was there.",
    alternatives: () => ["Kept it out and revisited next quarter, which is what happened the last two quarters"] },
  { type: "universe", risk: true,
    title: () => "Dropped the illiquid tail",
    whatChanged: () => "Names below the liquidity threshold are excluded rather than sized down.",
    why: () => "Sized down still means we hold them in a stress, and a stress is exactly when the threshold matters.",
    alternatives: () => ["Kept them at minimum size, which is how the tail got there"] },
  { type: "universe", risk: false,
    title: (v) => `Excluded names with ${v.param} above the band`,
    whatChanged: (v) => `Universe filter now checks ${v.param}.`,
    why: () => "Two of the worst three months came from names that would have failed this check.",
    alternatives: () => [] },
  { type: "universe", risk: false,
    title: () => "Rebalanced the universe monthly rather than quarterly",
    whatChanged: () => "Universe refresh moved to monthly.",
    why: () => "Quarterly meant we were trading a universe that was up to three months stale, and turnover barely moved when we tested monthly.",
    alternatives: () => ["Weekly, turnover went up without improving anything"] },
  { type: "universe", risk: false,
    title: (v) => `Reinstated ${v.venue} after the ${v.date} review`,
    whatChanged: (v) => `${v.venue} back in scope.`,
    why: () => "It was removed during an incident and never reviewed afterwards. The review says the original reason no longer applies.",
    alternatives: () => [] },

  // ---- infra
  { type: "infra", risk: false,
    title: () => "Pinned the backtest environment",
    whatChanged: () => "Backtest runs against a pinned dependency set.",
    why: () => "Two people got different numbers from the same code on the same data, which is the point at which a backtest stops being evidence.",
    alternatives: () => [] },
  { type: "infra", risk: false,
    title: (v) => `Cached the ${v.source} pulls`,
    whatChanged: (v) => `${v.source} responses cached for the session.`,
    why: () => "Every research run was re-fetching the same day of data, and the rate limit was starting to shape what people were willing to test.",
    alternatives: () => ["Raised the rate limit, treats the symptom"] },
  { type: "infra", risk: true,
    title: () => "Moved the live risk calc off the research box",
    whatChanged: () => "Risk runs on its own host.",
    why: () => "A research job could and did starve the live risk calculation. It should not have been possible for those two to compete at all.",
    alternatives: () => ["Nice-d the research jobs, which is a convention not a guarantee"] },
  { type: "infra", risk: false,
    title: () => "Added a smoke test on the morning pipeline",
    whatChanged: () => "Pipeline asserts row counts and date ranges before publishing.",
    why: () => "A silently empty load looks exactly like a quiet market until you look at the positions.",
    alternatives: () => [] },
  { type: "infra", risk: false,
    title: (v) => `Rebuilt the ${v.param} job as idempotent`,
    whatChanged: (v) => `The ${v.param} job can be safely re-run.`,
    why: () => "Re-running it used to double count, so nobody re-ran it, so failures sat unfixed until someone noticed downstream.",
    alternatives: () => [] },

  // ---- process
  { type: "process", risk: false,
    title: () => "Required a second reader on live parameter changes",
    whatChanged: () => "Changes to live parameters need a second person before they take effect.",
    why: () => "Not because anyone got one wrong. Because when someone does, we want to be able to say what the process was.",
    alternatives: () => ["Post hoc review, which finds it after the money"] },
  { type: "process", risk: false,
    title: (v) => `Moved the ${v.window} review to Monday`,
    whatChanged: (v) => `The ${v.window} review now runs Monday morning.`,
    why: () => "Friday afternoon reviews were being skipped, and a review that gets skipped is worse than no review because it is on the calendar.",
    alternatives: () => [] },
  { type: "process", risk: true,
    title: () => "Wrote down the escalation path for a drawdown flag",
    whatChanged: () => "Flag escalation has a named owner and a time limit.",
    why: () => "During the last flag three people assumed a fourth was handling it. That is a process failure and it is the cheapest kind to fix.",
    alternatives: () => [] },
  { type: "process", risk: false,
    title: () => "Started recording the desk standup",
    whatChanged: () => "Morning standup is transcribed and filed against the strategies discussed.",
    why: () => "Most of the reasoning that never gets written down is said out loud in that fifteen minutes.",
    alternatives: () => ["Written summaries, tried twice, stopped both times inside a fortnight"] },
  { type: "process", risk: false,
    title: (v) => `Handover checklist for the ${v.window} cover`,
    whatChanged: (v) => `Cover during the ${v.window} follows a written checklist.`,
    why: () => "The person covering has to know what normally happens, not just what to do when something breaks.",
    alternatives: () => [] },
];
