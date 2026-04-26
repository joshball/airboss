# Context: Cert, Syllabus, Goal, and the Multi-Lens Learning Model

How the conversation that produced ADR 016 unfolded. This is the evolution of thinking, not the final decision -- read [decision.md](./decision.md) for the model.

## The trigger

User zero asked for a "course aspect" to airboss: a syllabus per cert, drillable from PPL all the way to a custom curriculum for a returning CFI rebuilding seven certs simultaneously (PPL refresh, IR, CPL, multi, CFII, MEI, MEII). He wanted big-picture progress across all certs, frictionless cross-cert navigation, FAA-shaped browsing, and additional lenses on the same content.

The first response cataloged what airboss already had (knowledge graph, `CERTS`/`CERT_PREREQUISITES`, per-node relevance arrays, study plans, session engine) and proposed a syllabus layer that would map ACS Areas-Tasks-Elements onto graph nodes. Useful, but anchored to existing shape.

The user pushed back: "the right thing should not depend on any of our work. it should be objectively the right thing. And then we might have to adjust to it."

That reframed the question. The second pass started from first principles, independent of airboss.

## First-principles thinking

Ten principles emerged, in roughly the order they came up in the dialogue. They became the [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md):

1. Knowledge is a graph, not a tree.
2. A cert is a constraint set over the graph, not a container of content.
3. Certs compose as a DAG, not a line.
4. Personal learning is orthogonal to certificates.
5. Progress rolls up at every level the learner thinks at.
6. Multiple lenses are a primary feature, not a setting.
7. Sequencing is an opinion, not a constraint.
8. References are first-class.
9. Evidence of mastery has to match the kind of knowledge.
10. The system is the learner's, not the course author's.

Each principle was tested against the user's actual case (returning CFI, multi-cert, mixed regulatory + practical needs) and against the airboss codebase to see what would have to change.

## What the principles surfaced about airboss

Two things the codebase was doing right:

- The knowledge graph (ADR 011) is the correct foundation. Nodes + typed edges + multi-dimensional relevance + dual-gate mastery is the right primitive.
- The session engine already handles cert-agnostic study (ADR 012) and weights items across slices in a way that generalizes to "what should I do next" regardless of cert.

Two things the codebase was doing wrong:

- The `CERT_PREREQUISITES` constant collapses a DAG into a line. CFII is not "after CFI"; it's CFI + IR add-on. MEI is CFI + multi-engine. Endorsements are peers, not leaves.
- The per-node `relevance` array does two jobs at once: it asserts "this concept is on the PPL ACS at apply level" *and* it stores that fact. With many nodes and many certs, those edits drift. The right shape is to author the assertion in the syllabus and let the node's relevance be a derived cache.

One thing missing entirely:

- No first-class **syllabus** object. The FAA's structure (Areas of Operation -> Tasks -> Elements -> required depth + references) is how the regulation is written, how examiners test, and how pilots think when prepping. The graph has no notion of it.

## Handbook integration question

The user asked how the FAA handbooks (PHAK, AFH, Aviation Weather Handbook, Instrument Flying Handbook, Instrument Procedures Handbook, IFH) integrate. The answer that emerged:

- Handbooks are reference material, not curriculum.
- Handbooks overlap deliberately -- PHAK covers weather at survey depth; AvWX covers it operationally; IFH covers it again with an instrument focus. Each is a *lens* on the same underlying knowledge.
- Handbooks are not 1:1 with the ACS. One ACS task references multiple handbooks; one handbook chapter feeds multiple ACS tasks across multiple certs. The graph is the only place that resolves the many-to-many.
- "Browse by handbook" becomes a peer lens to "browse by ACS" once references are first-class.

That confirmed the principle that **lenses are a primary feature**, and that **references must be first-class** -- they're not metadata, they're a peer object with their own edition versioning and citation locators.

## The cached-relevance clarification

The user wasn't sure he understood the "relevance array becomes a cache" point. Restated:

> Today, a node's frontmatter says `relevance: [{cert: PPL, bloom: apply}, {cert: CFI, bloom: evaluate}]`. That line is *both* the claim ("this is on the PPL ACS") *and* the storage of the claim. With syllabi as first-class objects, the claim moves to the PPL ACS syllabus (its leaf for "Slow Flight, Stalls" points at the angle-of-attack node and says "required at apply level"). The node's `relevance` array becomes a derived index built by walking every syllabus that points at the node. It's still on the node for fast reads, but if the node's array and the syllabi disagree, the syllabi win and the array rebuilds. Authoring moves from the node to the syllabus.

Why it matters:

1. No drift. Edit the syllabus once; every node it touches updates.
2. Same node can be claimed by multiple syllabi at different depths (PPL at apply, CFI at evaluate, an aerobatic course at create). The cache shows all claims; each claim's source lives in its own syllabus.

## The five objects that fell out

Not designed up front; they emerged from the principles:

1. **Knowledge graph** (already exists)
2. **References** (partially exists; needs to be a peer object, not metadata)
3. **Syllabi** (new; the FAA-shaped projection)
4. **Credentials** (new; certs/ratings/endorsements as a DAG)
5. **Goals** (new; learner-owned, multi-syllabus, possibly cert-agnostic)

Mastery is computed at the node and projects up through any structure. Lenses are queries over `(graph, syllabi, references, mastery)`.

## What got rejected

- **A "course" entity.** The user used the word "course," but what he actually wanted was a goal (learner-owned, multi-syllabus). A course is a curriculum someone teaches; a goal is what the learner needs. Conflating them is the standard LMS mistake. The model uses "Goal" deliberately.
- **A primary structure.** Early drafts had ACS as the canonical view with everything else as alternates. The principle "multiple lenses are a primary feature" rejected that. The graph is structureless; every named structure is a peer view.
- **Tree-shaped knowledge.** Considered briefly. Rejected immediately because angle-of-attack appears under stalls, unusual attitudes, chandelles, VMC, teaching, aerobatics -- a tree forces duplication or false hierarchy.
- **Sequencing in the graph.** Considered making `requires` edges enforce session ordering. Rejected because real instruction interleaves; the ACS deliberately doesn't sequence; sequencing is a syllabus or goal opinion, not a graph fact.

## What stays open

Recorded in the ADR's "Open questions" section. Each gets resolved in-place or in a follow-up ADR before the corresponding migration phase ships.

## Why the philosophy doc exists separately

Two reasons:

1. **Durability.** ADRs document decisions; principles document beliefs. The model in ADR 016 might evolve as we build it; the principles in `LEARNING_PHILOSOPHY.md` should outlive any particular ADR. Future reviews check features against the philosophy, not the ADR.
2. **Audience.** The ADR is for engineers implementing the model. The philosophy is for anyone shaping product (including the user himself, future contributors, and downstream skills like `/ball-wp-spec` that need to know what airboss is *for*).

Both docs say the same thing in their own register.
