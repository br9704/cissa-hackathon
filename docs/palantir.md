# docs/palantir.md: what Palantir teaches Continuity (researched 22 Aug 2026)

> How Palantir architects copious data for the US government, and what Continuity adopts
> and deliberately avoids. All quotes verbatim from primary sources (Palantir docs, S-1,
> official blog, contract reporting); URLs inline. Adopted items are wired into prd.md
> and masterplan.md (locked decision D13).

## 1. How Palantir actually works with data

The ontology. Foundry's core is an ontology: an "operational layer" over integrated
data with semantic elements (object types, properties, link types: real-world
counterparts like equipment, orders, transactions) and kinetic elements (actions,
functions: the governed ways state changes). Their S-1 line: data is represented "not
as cells in a spreadsheet... but as entities, events, relationships, consequences, and
decisions in context," and the docs call the ontology "a digital twin of the
organization." (palantir.com/docs/foundry/ontology/overview; SEC S-1.)

Datasets are transaction logs. Every Foundry dataset is an append-only sequence of
transactions (APPEND/UPDATE/SNAPSHOT/DELETE), so any historical version is
reconstructible; transforms are code, versioned; the Data Lineage graph tethers every
datum to its source, and security markings propagate along lineage.
(palantir.com/docs/foundry/data-integration/datasets, /data-lineage/overview.)

Actions as the only write path. An action type is "a single transaction that changes
the properties of one or more objects": typed parameters, submission criteria (who may
act, under what preconditions), and a writeback dataset creating an audit trail. Humans
change the world through typed, attributable, replayable actions, never free edits.
(palantir.com/docs/foundry/action-types/overview.)

Governance as product features. Purpose-based access: "Instead of applying for access
to an individual data set, a potential user applies for access to a Purpose," with
recorded rationale on BOTH sides, so "an auditor can understand not just who has access
to what data, but also why." Checkpoints: "a prompt that asks a user to provide a
justification for an interaction," logged with timestamp, user, resources, across 60+
interaction types. Immutable audit logs: "every user action in our systems must be
auditable"; fixed categories, no free-form; streamable to the customer's SIEM.
(blog.palantir.com purpose-based-access-controls; docs /checkpoints/overview,
/security/audit-logs-overview.)

The LLM layer (AIP). LLM functions take ontology objects as input, use query tools, and
write ONLY through the same typed actions a human would use; "platform security
controls grant an LLM access only to what is necessary to complete a task"; AIP Evals
regression-tests functions before release. (palantir.com/docs/foundry/aip, /logic.)

## 2. The government footprint (why they hold so much)

CIA-funded origin (In-Q-Tel, ~2003); Army Vantage consolidating ~180 sources into a
platform with 100,000+ users ($618.9M expansion 2021, $400.7M extension 2024); Maven
Smart System at a ~$1.3B ceiling through 2029, 20,000+ users; CDC $443M disease
surveillance; NHS England Federated Data Platform up to 330M pounds; ICE FALCON/ICM and
the 2025 ImmigrationOS modification; the 2025 information-silos executive order and the
NYT "compiling data on Americans" fight. The through-line: governments pay nine figures
for the INTEGRATION AND MEMORY LAYER over their own messy data, not for algorithms.
(Defense News, DefenseScoop, FedScoop, The Register, EPIC/ACLU documents; URLs in the
research trail.)

Their most durable shield is a sentence: "We do not collect, store, or sell personal
data... We act as a data processor, not a data controller." Deployed, single-tenant
instances; the customer's data stays the customer's. Critics answer that the claim is
technically true but incomplete: the tool's function is integration, and what it makes
easy is what it will be used for. Both halves of that exchange matter to us.

## 3. What actually detonates (and what defends)

The scandals were never capture itself. ICE blew up on PURPOSE CREEP (investigation
tooling became deportation tooling); the NHS fight was OPACITY AND CONSENT (redacted
contracts, no opt-out); the 2025 panic was PLAUSIBILITY OF MERGER, not proof. And the
defenses that consistently work are the governance features: purpose-based access,
dual written justifications, who-what-why audit, "no dark areas" (every dataset has an
owner and a purpose).

## 4. Signac: the direct precedent in finance (gold)

March 2016: Credit Suisse and Palantir launched Signac, a 50-50 joint venture to catch
rogue traders by monitoring employee behavior for "deviations from normal behavior
patterns." Dissolved after ~15 months. The tech was not the failure: the venture died
over revenue-recognition governance, and its CEO alleged retaliation and surveillance
of herself. (Bloomberg, CNBC, finews, NBC.) Two conclusions for Continuity: the lane
(always-on capture inside a trading firm) is real enough that Palantir and a tier-one
bank built a company for it; and a product selling trust-through-recording dies from
the operator's first integrity failure, not from the recording. Also: nobody has since
productized this layer. The lane is open.

## 5. What Continuity adopts (wired into prd/masterplan)

1. Ontology framing. The schema IS an ontology: objects (strategies, artifacts,
   people), links (decision genealogy), and one kinetic rule: ALL state changes are
   typed, attributable events on the ledger: Palantir's actions pattern, which we
   already had as D4; now named and pitched that way.
2. Everything tethered to source. Every decision links its source artifacts; lineage
   is a first-class UI concept (the genealogy graph + grounding chips).
3. Audit-of-access as product (NEW, weekend scope). Reads and exports are themselves
   ledger events: opening another desk's strategy, generating a pack, exporting the
   change log all append access events. The ledger records who read it. This is
   Palantir's strongest defense, repurposed as our feature.
4. Checkpoint on export (NEW, weekend scope). Exporting a handover pack or compliance
   artifact prompts for a one-line justification, stored on the access event.
5. Let the captured see the ledger (NEW, weekend scope). Every member has a My Record
   view: everything captured from them, and every access event touching their
   contributions. Transparency to the observed is the acceptability condition.
6. Purpose scoping (roadmap) and the processor stance (contract): access granted per
   purpose with recorded rationale; and Continuity deploys into the firm's environment,
   single tenant, never pooling or training on customer data: our version of "we are
   not a data company," stated in the PRD security section.
7. Hard-scoped uses (doctrine). Allowed: continuity, onboarding, compliance, IP
   documentation. Forbidden and made technically annoying, not just contractually:
   performance management, termination cases, individual productivity analytics. This
   is the anti-ICE clause: purpose creep is the thing that detonates.
8. The delivery lesson (go-to-market slide): land embedded on one bleeding workflow
   (the departing PM), expand on measured usage: the forward-deployed motion and the
   Vantage/Maven expansion arithmetic.

## 6. One-line synthesis

Palantir proves organizations pay nine figures for an integration-and-memory layer over
their own data IF the vendor never owns the data, governance ships as product features,
and the stated purpose never silently expands. Capture everything; let the captured see
the ledger.
