---
# === Identity ===
id: reg-faa-document-ecosystem
title: The FAA Document Ecosystem
domain: regulations
cross_domains: [adm-human-factors]

# === Knowledge character ===
knowledge_types: [conceptual]
technical_depth: working
stability: evolving

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: standard
requires: []
deepens: []
applied_by:
  - reg-ac-numbering-system
  - reg-faa-citation-anatomy
  - reg-faa-cross-reference-triangulation
taught_by: []
related:
  - reg-pilot-privileges-limitations
  - reg-currency-vs-proficiency

# === Content & delivery ===
modalities: [reading, cards]
estimated_time_minutes: 30
review_time_minutes: 5

# === References ===
references:
  - source: 14 CFR
    detail: Title 14 of the Code of Federal Regulations -- the Aeronautics and Space title
    note: The binding rules. The reference point against which everything advisory is measured. "FAR" is the colloquial name for the same body of law.
  - source: AC 00-2
    detail: Advisory Circular Checklist (cancelled)
    note: Was the FAA's master index of advisory circulars. Cancelled; no successor document. The Dynamic Regulatory System at drs.faa.gov replaced it as a search tool, not as a browsable map. Its cancellation is the clearest single illustration of why this node exists.
  - source: AIM
    detail: Aeronautical Information Manual, Basic Flight Information and ATC Procedures
    note: The largest advisory document a pilot uses. Operational how-to, covering procedures, phraseology, and good-operating-practice. Carries no regulatory force on its own.
  - source: drs.faa.gov
    detail: Dynamic Regulatory System -- the FAA document search portal
    note: The modern entry point for ACs, orders, notices, and policy. A search tool, not an index; you cannot browse the ecosystem from it.

# === Assessment ===
assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >-
  Learner can state the load-bearing distinction between a binding (regulatory)
  document and an advisory (guidance) document, give 14 CFR and an Advisory
  Circular as the canonical example of each, and explain why the FAA separates
  the two: guidance can be revised quickly without going through rulemaking,
  so the slow-changing binding rule and the fast-changing acceptable means of
  compliance are deliberately kept in different document families. Learner can
  sort the major families (14 CFR, ACs, AIM, P/CG, ACS, handbooks, orders,
  TSOs, ADs, SAFOs/InFOs, NOTAMs, Chart Supplements) into binding vs advisory.
---

# The FAA Document Ecosystem

:::phase name="context"

A returning pilot opens a single question, say "do I need a flight review," and within five minutes is staring at five different kinds of document: a 14 CFR section, an Advisory Circular, an AIM paragraph, an FAA handbook chapter, and a safety brochure. Each looks official. Each uses different numbering. None of them says, on its face, "I am binding" or "I am only guidance."

That is the wall this node takes down. The FAA does not publish a single page that maps its own document families. The old master index of advisory circulars, AC 00-2, was cancelled outright. Its replacement, the Dynamic Regulatory System at drs.faa.gov, is a search box, not a map. So a pilot who never learned the shape of the ecosystem has no way to learn it from any one FAA page.

This node is the map. Not the content of any single document: the structure of how the families fit together, and the one distinction that makes the whole thing make sense.

:::
:::phase name="problem"

Here is the question that exposes the gap. The FAA could have published everything in one place: every rule, every recommended technique, every explanation, all in 14 CFR.

It chose not to. It split its guidance into a separate family of documents, the Advisory Circulars, that are explicitly NOT part of the regulations. A pilot can comply with the regulation without ever reading the matching AC.

Why would an agency deliberately do that? Why keep the rule and the recommended way to satisfy the rule in two different documents, with two different numbering systems, two different revision cycles, two different legal weights?

Before you read on: think about what is different about a rule versus a recommendation. What happens when each one needs to change? Which one is easy to update and which one is hard?

:::
:::phase name="discover"

Work these through before reading the Reveal.

1. **The cost of changing a rule.** A regulation in 14 CFR is law. To change a single sentence of it, the FAA must go through formal rulemaking: a notice of proposed rulemaking, a public comment period, responses to comments, a final rule. That process is measured in years. Now ask: if the FAA wants to tell pilots about a better way to inspect a fuel system, or a new acceptable method for a weight-and-balance computation, does it want that to take years?

2. **Two speeds of knowledge.** Some aviation knowledge is slow and stable: the rule that you must have a current flight review, the rule that you must hold a medical. Other knowledge moves fast: a newly discovered technique, a clarification, a response to an accident trend, an updated method that uses new equipment. Sort these two kinds in your head. Which kind belongs in something that takes years to amend? Which kind needs a document that can be revised in months?

3. **The split as a design choice.** If you were designing the system, and you had slow-changing binding rules and fast-changing recommended practice, what would you do? You would not put them in the same document. You would keep the binding rule small, stable, and terse, and put the changeable detail somewhere it can be revised without rulemaking. What would you call that second family of documents? What legal weight would you give it?

4. **One acceptable means, not the only one.** Suppose the FAA publishes a recommended method in that second family. If it said "this is the only way," it would have quietly created a new binding rule through the back door, bypassing rulemaking. So how must it phrase the recommendation to stay advisory? The phrase the FAA actually uses is worth predicting before you see it.

5. **Map the families.** Given the binding/advisory split, take a guess at which side each of these falls on, and why: the regulations themselves; a recommended inspection procedure; the manual of ATC procedures pilots read; a mandatory corrective action on a cracked engine mount; a time-critical notice that a runway is closed tonight; a training textbook; the standards a checkride is graded against.

:::
:::phase name="reveal"

### The one distinction that organizes everything

Every FAA document a pilot touches is either **binding** or **advisory**.

- **Binding** means it has the force of law. You must comply. Non-compliance is a violation. 14 CFR is the type specimen: it IS the regulations.
- **Advisory** means it is guidance. It explains, recommends, or shows an acceptable way to do something. It does not, by itself, create a legal obligation. The Advisory Circular is the type specimen.

The split exists because **rules and the explanation of rules change at different speeds.** A regulation is hard to change on purpose: rulemaking is slow because law should be stable and publicly debated. But the recommended way to satisfy a rule, the techniques, the clarifications, the responses to new equipment and new accident trends, all of that needs to move fast. So the FAA keeps the slow binding rule in 14 CFR and puts the fast-changing detail in the Advisory Circular system, which it can revise without rulemaking. The AC system is the formal expression of "guidance that can update quickly."

### One acceptable means of compliance

An Advisory Circular shows **one acceptable means** of complying with a regulation. Read those words carefully. Not "the" means. Not "the required" means. **One acceptable** means. If you follow the AC, the FAA has told you in advance it will accept that as compliance. But you are free to comply some other way, and the AC is not itself the rule. This phrasing is exactly what keeps the AC advisory: if it said "the only way," it would be a regulation created without rulemaking.

The mirror-image error is just as costly. A 14 CFR section IS binding. Treating it as optional guidance is under-constraining. Treating an AC as law is over-constraining: you cage yourself with a recommendation you were free to satisfy another way. A pilot who cannot tell the two apart makes both mistakes.

### The family map

| Family                    | Binding?  | What it is                                                       |
| ------------------------- | --------- | ---------------------------------------------------------------- |
| 14 CFR                    | Binding   | The regulations. "FAR" is the colloquial name for the same body. |
| Advisory Circulars (AC)   | Advisory  | One acceptable means of compliance with a regulation.            |
| AIM                       | Advisory  | Aeronautical Information Manual: operational how-to, procedures. |
| Pilot/Controller Glossary | Advisory  | The shared vocabulary behind the AIM and ATC phraseology.        |
| ACS                       | Advisory  | Airman Certification Standards: what a checkride tests.          |
| FAA handbooks             | Advisory  | PHAK, AFH, IFH, Aviation Weather Handbook, and others.           |
| Orders and Notices        | Advisory* | Internal FAA direction (8900.1, JO 7110.65). Binds the agency.   |
| TSOs                      | Advisory  | Technical Standard Orders: minimum performance for articles.     |
| Airworthiness Directives  | Binding   | ADs: mandatory corrective action on a specific aircraft/article. |
| SAFOs and InFOs           | Advisory  | Safety Alerts and Information for Operators.                     |
| NOTAMs                    | Binding   | Notices to Air Missions: time-critical changes to the NAS.       |
| Chart Supplements         | Advisory  | Airport and facility data (formerly Airport/Facility Directory). |

*Orders and Notices bind the FAA and its inspectors, not pilots directly. They are not advisory to the agency, but a pilot treats them as guidance rather than a personal legal obligation.

The map is not symmetric: most families are advisory. The binding families are few and specific: 14 CFR, Airworthiness Directives, and NOTAMs. That asymmetry is itself worth carrying. Most of what the FAA publishes is help, not law.

### Why there is no canonical index

The FAA publishes no single browsable index of this ecosystem. AC 00-2, the old Advisory Circular Checklist, used to come close, and it was cancelled with no successor. drs.faa.gov, the Dynamic Regulatory System, replaced it, but DRS is a search tool: you query it, you do not browse a structured map from it. This node, and the document-family reference pages it points at, are the map the FAA does not itself publish.

:::
:::phase name="practice"

### Recall and discrimination prompts

1. **State the distinction.** In one sentence, what is the difference between a binding document and an advisory document? Give the canonical example of each.

2. **Why the split.** Explain, without using the word "because" as a shortcut, why the FAA keeps binding rules and acceptable means of compliance in two different document families. The answer must mention the speed of rulemaking.

3. **One acceptable means.** An Advisory Circular describes a procedure for complying with a regulation. A pilot follows a different procedure that also satisfies the rule. Has the pilot violated anything? Explain using the exact phrase the FAA uses.

4. **Sort the families.** Without looking, label each binding or advisory: AIM, Airworthiness Directive, ACS, NOTAM, Advisory Circular, 14 CFR, Chart Supplement, FAA handbook.

5. **The cancelled index.** What was AC 00-2, what happened to it, and what does that tell you about how to find an AC today?

### Cards

- `card:reg-binding-vs-advisory` -- define binding vs advisory; give the type specimen of each (recall + discrimination).
- `card:reg-why-the-split` -- why the FAA separates rules from acceptable means of compliance (conceptual recall).
- `card:reg-one-acceptable-means` -- the meaning of "one acceptable means of compliance" (recall).
- `card:reg-family-binding-sort` -- sort the twelve families into binding vs advisory (recall).

:::
:::phase name="connect"

### What changes if...

- **...you want to predict an AC's subject from its number?** The numbering is not arbitrary; the AC number mirrors the 14 CFR part structure. Link: `reg-ac-numbering-system`.
- **...you need to read an unfamiliar citation?** Every family has its own identifier anatomy. Pulling apart "AC 00-45H" or "14 CFR 91.137(a)(2)" is a separate skill. Link: `reg-faa-citation-anatomy`.
- **...one document is not enough to answer a question?** A binding rule is terse; its AC explains compliance; the AIM gives operational how-to; a handbook gives training depth; the ACS says what is tested. Answering a real question means walking across families. Link: `reg-faa-cross-reference-triangulation`.
- **...the document you found is old?** Advisory documents are revised and cancelled. A cancelled document can still matter (its successor inherits the subject), or it can be gone with no successor (AC 00-2). Always check for the current edition.

### Links

- `reg-ac-numbering-system` -- the numbering scheme that mirrors 14 CFR parts.
- `reg-faa-citation-anatomy` -- reading any AC, CFR, or AIM identifier.
- `reg-faa-cross-reference-triangulation` -- answering a question across families.
- `reg-pilot-privileges-limitations` -- a worked example of a question that lives in 14 CFR.

:::
:::phase name="verify"

### Novel scenario

A pilot tells you, with confidence: "AC 120-71 says flight crews must use a sterile cockpit below 10,000 feet, so that is the legal rule and I have to follow it exactly as written."

1. Identify what is right and what is wrong in that statement. Is the sterile-cockpit idea binding? If so, what document actually makes it binding, and what is the AC's role?
2. Explain to the pilot, in plain language, the difference between the AC and the regulation it supports.
3. The pilot then asks: "Then why does the AC exist at all, if it is not the rule?" Give the answer that mentions the speed of rulemaking.

### Teaching exercise (CFI)

A student pilot has been told by a well-meaning hangar acquaintance that "the AIM is the law, you can get violated for not following the AIM."

1. Is that true? What is the AIM's actual legal status?
2. Build a short ground explanation that gives the student the binding/advisory distinction as a tool, not as a list of facts to memorize. Use one binding example and one advisory example the student already knows.
3. The student then over-corrects: "So the AIM does not matter, I can ignore it." Correct that too. Why does a non-binding document still deserve a pilot's full attention?

:::
