/*
  The package's public surface. Everything the web app, the CLI and the server routes are
  allowed to reach for lives behind this file.

  One thing deliberately absent: anything that talks to a database. The loader takes a
  client rather than making one, and it is imported directly by the seed script, so a
  browser bundle can pull in the corpus and the scoring without dragging `pg` along with
  it.
*/
export { makeRng, makeUuid, type Rng } from "./rng.js";
export {
  generate, DEFAULT_SEED,
  type Corpus, type Member, type Strategy, type Artifact, type Decision,
  type DecisionLink, type DebriefSession, type DebriefTurn, type Question,
} from "./seed/generate.js";
export {
  DECISION_TYPES, PERSONAS, STRATEGIES, FIRM_NAME,
  type DecisionType, type PersonaKey,
} from "./seed/vocabulary.js";
export * from "./scoring.js";
export { handoverPack, rts6ChangeLog, sr117Documentation, type PackInput } from "./packs.js";
export {
  canonicalJsonb, canonicalText, sha256Hex, eventHash, verifyChain,
  type ChainInput, type VerifiedRow,
} from "./chain.js";
