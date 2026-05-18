---
# === Identity ===
id: reg-faa-cross-reference-triangulation
title: FAA Cross-Reference Triangulation
domain: regulations
cross_domains: [weather, adm-human-factors]

# === Knowledge character ===
knowledge_types: [judgment, procedural]
technical_depth: working
stability: evolving

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: standard
requires:
  - reg-faa-document-ecosystem
  - reg-faa-citation-anatomy
deepens: []
applied_by: []
taught_by: []
related:
  - reg-ac-numbering-system
  - wx-go-nogo-decision

# === Content & delivery ===
modalities: [reading, cards]
estimated_time_minutes: 35
review_time_minutes: 7

# === References ===
references:
  - source: 14 CFR
    detail: 91.103 (Preflight action)
    note: The binding rule that the pilot in command must, before any flight, become familiar with all available information concerning that flight, including weather reports and forecasts. Terse and binding -- the starting point of the worked triangulation.
  - source: AC 00-45H
    detail: Aviation Weather Services
    note: The Advisory Circular that explained how to obtain and interpret the weather products a pilot needs to satisfy 91.103. One acceptable means of getting the weather information the rule requires. The weather-services content of AC 00-45 has since been consolidated into the Aviation Weather Handbook (FAA-H-8083-28), so a pilot today goes to the handbook; AC 00-45H still illustrates the AC tier of the triangulation chain.
  - source: AIM
    detail: Chapter 7 (Safety of Flight) -- weather services and hazards
    note: Operational how-to for using weather services in flight planning and en route. The procedural layer between the rule and the textbook.
  - ref: airboss-ref:handbooks/avwx
    note: >-
      Training-depth treatment of weather theory and products. Where a pilot goes to actually understand the material the AC and AIM assume.
  - source: Airman Certification Standards
    detail: Private Pilot ACS -- the weather information and preflight-planning tasks
    note: Defines what a checkride examiner tests on weather and preflight planning. The endpoint of the triangulation, the standard "knowing this" is graded against.

# === Assessment ===
assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >-
  Given an aviation question, learner can triangulate it across document
  families: identify the binding 14 CFR rule, the Advisory Circular that shows
  an acceptable means of compliance, the AIM treatment for operational how-to,
  the FAA handbook for training-depth understanding, and the ACS task that
  defines what a checkride tests. Learner can explain why no single family
  fully answers a real question, can articulate what each family contributes,
  and can walk the worked weather go/no-go example end to end.
---

# FAA Cross-Reference Triangulation

:::phase name="context"

This is the capstone. The earlier nodes built the pieces: the binding/advisory split, the AC numbering scheme, the grammar of citations. This node puts them to work on the thing the whole course exists for: answering a real aviation question.

Here is the uncomfortable truth a returning pilot discovers fast. No single FAA document answers a real question completely. The binding rule tells you what you must do, but it is terse and gives you almost no operational help. The Advisory Circular explains an acceptable way to satisfy the rule, but it is not the rule and not a tutorial. The AIM gives you operational procedure, the handbook gives you the underlying understanding, and the ACS tells you what an examiner will actually test. Each document is one face of the answer.

The skill is **triangulation**: walking a question deliberately across the families, taking from each the thing only it provides, and assembling a complete answer. A pilot who can do this is not lost in the ecosystem. They use it.

This is not an academic exercise. Take the weather go/no-go question this node walks. A pilot who triangulates it well - rule, acceptable means, operational how-to, training-depth understanding, tested standard - launches genuinely prepared for the weather they will meet. A pilot who reads only 14 CFR 91.103 and stops has met the letter of the rule and is still not ready to fly: the rule tells you that you must become familiar with the weather, never how, and never what the weather actually means. The skill is the difference between satisfying the regulation and being ready for the flight. That gap is the reason triangulation is worth learning, not just the documentation tidiness of it.

:::
:::phase name="problem"

Here is the driving question, and it is a question every pilot faces:

> It is the morning of a planned cross-country flight. The weather is marginal. How do I decide, in a way that is both legal and sound, whether to go?

This is a weather go/no-go decision. Now make it a documentation problem. Which FAA documents bear on this question? Try to name them before you read on, and for each one, say what it would contribute that the others would not.

- Is there a binding rule that obligates you to do anything before this flight?
- Is there a document that explains an acceptable way to do that thing?
- Where do you find the operational procedure for actually using weather services?
- Where do you go to genuinely understand the weather, not just satisfy a rule?
- And on a checkride, what gets tested about this exact decision?

If you can only name one or two documents, that is the gap this node closes.

:::
:::phase name="discover"

Work the triangulation yourself before reading the Reveal. Walk the question from the rule outward.

1. **Find the binding rule.** Start with the question "what does the law actually require of me before this flight." There is a 14 CFR section squarely on point: a regulation that says the pilot in command must, before beginning a flight, become familiar with all available information concerning that flight, including weather. Where would such a rule live? It is in Part 91 (general operating rules), in the preflight-action section. From the citation-anatomy node, you can already predict the shape of the cite: 14 CFR, Part 91, a section number. Read the rule's character: it is short, it is mandatory, and it gives you almost no detail about HOW. That terseness is not a flaw. A binding rule is deliberately small.

2. **Find the acceptable means.** The rule says "become familiar with weather information" but does not tell you how to obtain or read that information. Where does the FAA explain that? From the AC-numbering node: an AC supports a regulation. A weather-services AC would explain how to get and interpret weather products. Which subject series would it be in? The 00-series, the general series, since weather is not owned by one numbered CFR part. You are looking for an Advisory Circular on aviation weather services. Predict roughly what it contributes: one acceptable means of getting the information the rule requires.

3. **Find the operational how-to.** The AC tells you about the products. But how do you operationally use weather services in planning and en route? That is the AIM's job. Which chapter of the AIM covers safety of flight and weather? Reason from the AIM's structure: it is organized by operational topic. Weather and safety of flight sit together in one chapter. Predict what the AIM adds that the AC does not: procedure, in-the-cockpit how-to.

4. **Find the training depth.** Suppose you read the rule, the AC, and the AIM, and you still do not actually understand what a particular weather product is telling you, why a front behaves the way it does, what the hazard really is. None of those three documents is a tutorial. Where do you go to genuinely learn the material? An FAA handbook. Which handbook treats weather? The Aviation Weather Handbook. Predict its role: training-depth understanding, the layer beneath compliance.

5. **Find what gets tested.** Finally, a checkride. An examiner is going to probe this exact decision. What document defines, task by task, what the examiner may test on weather and preflight planning? The Airman Certification Standards. Predict what the ACS contributes that none of the other four do: it does not teach and it does not bind; it defines the standard you are measured against.

6. **Assemble.** You now have five documents, one from each family, each contributing something the others cannot. Before the Reveal, write the chain in order and say in one phrase what each link gives you.

:::
:::phase name="reveal"

### The triangulation chain

A real question is answered by walking it across families. For the weather go/no-go question, the chain is:

```text
14 CFR 91.103   ->   AC 00-45H   ->   AIM Chapter 7   ->   Aviation Weather Handbook   ->   Private Pilot ACS
   (binding)        (acceptable        (operational         (training-depth                (what a checkride
                     means)            how-to)              understanding)                 tests)
```

### What each link contributes

| Link                      | Family             | What it gives you that the others do not                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14 CFR 91.103             | Binding regulation | The obligation. You MUST become familiar with all available information, including weather reports and forecasts, before the flight. Terse, mandatory, no how-to.                                                                                                                                                                                                                                  |
| AC 00-45H                 | Advisory Circular  | One acceptable means: how to obtain and interpret the weather products that satisfy the rule. Explains the products; does not bind you to this exact method. The weather-services content of AC 00-45 has since been consolidated into the Aviation Weather Handbook (FAA-H-8083-28), so a pilot today reads the handbook for this material; AC 00-45H stands in here as the AC tier of the chain. |
| AIM Chapter 7             | AIM                | Operational how-to: using weather services in planning and en route, recognizing hazards. Procedure, not theory.                                                                                                                                                                                                                                                                                   |
| Aviation Weather Handbook | FAA handbook       | Training-depth understanding: the theory under the products, so you actually know what you are reading, not just where to read it.                                                                                                                                                                                                                                                                 |
| Private Pilot ACS         | ACS                | The standard: what an examiner may test on weather information and preflight planning. Defines "knowing this" for checkride purposes.                                                                                                                                                                                                                                                              |

### Why no single document is enough

Read the table as a whole. The binding rule is **authoritative but terse**: it tells you what, never how. The AC is **detailed but advisory**: it shows a way, but it is not the rule and not a tutorial. The AIM is **procedural**: how to operate, not why. The handbook is **deep but non-binding and non-procedural**: it builds understanding. The ACS is **neither binding nor instructional**: it is the yardstick.

Each family is shaped for one job and is bad at the others. That is by design, and it is the same binding/advisory architecture from the ecosystem node showing up again: the FAA split the material so each family could do one job well. Triangulation is the skill of using that split instead of being lost in it. You do not pick the "right" document. You walk all five and take from each the one thing only it provides.

### The general method

The weather go/no-go question is one instance. The method generalizes to any aviation question:

1. **Find the binding rule.** What does the law require? It is in 14 CFR. Expect it to be terse.
2. **Find the acceptable means.** Which AC supports that rule? Use the subject-series prefix to locate it.
3. **Find the operational how-to.** Which AIM chapter covers the procedure?
4. **Find the training depth.** Which FAA handbook treats the underlying knowledge?
5. **Find the standard.** Which ACS task defines what is tested?

Not every question touches all five families, but the habit of asking all five questions is what makes a pilot fluent in the ecosystem rather than dependent on whoever hands them a single citation.

:::
:::phase name="practice"

### Triangulation prompts

1. **Walk the worked chain.** From memory, reproduce the five-link chain for the weather go/no-go question. Name the document at each link and the one thing it contributes.

2. **A new question: night currency.** Triangulate "may I carry passengers on a night flight." Where is the binding rule? Is there an AC? Which AIM and ACS material applies? Note which families this question touches and which it does not.

3. **A new question: airspace entry.** Triangulate "may I enter this Class C airspace." Find the binding rule, the operational how-to in the AIM, and the ACS task. Decide whether an AC is involved.

4. **Spot the missing family.** A pilot answers a question using only the AIM. What kind of error are they at risk of, and which family would catch it?

5. **Explain the design.** In two sentences, explain why the FAA's choice to split material across families makes triangulation necessary, and why that is a feature and not a bug.

### Cards

- `card:reg-triangulation-chain` -- the five-link chain for the weather go/no-go question (recall).
- `card:reg-family-contributions` -- what each family contributes that the others cannot (recall + discrimination).
- `card:reg-triangulation-method` -- the five questions of the general triangulation method (recall).
- `card:reg-no-single-document` -- why no single FAA document fully answers a real question (conceptual recall).

### Reps

- `rep:reg-triangulate-a-question` -- given an aviation question, name the document at each family link and justify.

:::
:::phase name="connect"

### What changes if...

- **...you cannot read the citations you find?** Triangulation produces a trail of citations across families; following the trail requires the citation grammar. Link: `reg-faa-citation-anatomy`.
- **...you need to locate the supporting AC fast?** The subject-series prefix takes you straight from a CFR part to its AC neighborhood. Link: `reg-ac-numbering-system`.
- **...you confuse advisory for binding mid-triangulation?** If you treat the AC as the rule, you have over-constrained; if you treat 91.103 as optional, you have under-constrained. The binding/advisory distinction is load-bearing the whole way down. Link: `reg-faa-document-ecosystem`.
- **...the question is itself a weather decision?** The triangulation worked example IS a weather go/no-go. The documentation skill and the weather-judgment skill meet here. Link: `wx-go-nogo-decision`.

### Links

- `reg-faa-document-ecosystem` -- the binding/advisory architecture that makes triangulation necessary.
- `reg-ac-numbering-system` -- jumping from a CFR part to its AC by prefix.
- `reg-faa-citation-anatomy` -- reading the citations the triangulation trail produces.
- `wx-go-nogo-decision` -- the weather-judgment side of the same worked example.

:::
:::phase name="verify"

### Novel scenario

A pilot planning an IFR cross-country asks you: "What do I actually need to do, and know, about alternates and fuel before this flight?"

1. Triangulate the question. Name the binding 14 CFR rule (it is in Part 91), the AC that would support the weather and planning side, the AIM chapter for the operational procedure, the handbook that builds the underlying understanding, and the ACS task that defines what a checkride tests.
2. For each link, state in one sentence what that document contributes that the others do not.
3. The pilot says: "I read the regulation, that is enough." Explain, using this specific question, what they would be missing and which family would supply it.

### Teaching exercise (CFI)

A student consistently answers oral-exam questions by quoting a single document, usually whichever one they read most recently, and is surprised when the examiner pushes for more.

1. Diagnose the habit. What is the student treating as complete that is not?
2. Build a ground exercise that walks one question, the weather go/no-go decision, across all five families, having the student name each document and its contribution out loud.
3. Then hand the student a fresh question and have them triangulate it unaided. What are you listening for to know the skill has transferred?
4. The student asks: "Is not it simpler to just memorize the regulations?" Answer in a way that respects the instinct toward the binding rule while showing why the rule alone leaves a pilot under-prepared.

:::
