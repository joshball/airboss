---
# === Identity ===
id: reg-faa-citation-anatomy
title: FAA Citation Anatomy
domain: regulations
cross_domains: []

# === Knowledge character ===
knowledge_types: [procedural]
technical_depth: working
stability: stable

# === Cert + study priority ===
# minimum_cert: lowest cert that requires this topic. Higher certs inherit.
minimum_cert: private
# study_priority: critical (safety/checkride hot) | standard (default) | stretch (adjacent).
study_priority: standard
requires:
  - reg-faa-document-ecosystem
deepens: []
applied_by:
  - reg-faa-cross-reference-triangulation
taught_by: []
related:
  - reg-ac-numbering-system

# === Content & delivery ===
modalities: [reading, cards]
estimated_time_minutes: 25
review_time_minutes: 5

# === References ===
references:
  - source: AC 00-45H
    detail: Aviation Weather Services -- used as the worked example for AC identifier anatomy
    note: The identifier "AC 00-45H" splits into type prefix (AC), AC number (00-45), and revision letter (H). The title "Aviation Weather Services" describes the document; the identifier locates it. AC 00-45 is current at revision H.
  - source: 14 CFR
    detail: 91.137(a)(2) -- used as the worked example for CFR citation anatomy
    note: Splits into title (14), part (91), section (137), and paragraph (a)(2). The eCFR is the authoritative live text of any CFR citation.
  - source: AIM
    detail: Paragraph 7-1-6 -- used as the worked example for AIM citation anatomy
    note: Splits into chapter (7), section (1), and paragraph (6). AIM paragraphs are cited chapter-section-paragraph, not by page.
  - source: drs.faa.gov
    detail: Dynamic Regulatory System -- resolves an AC identifier to its title and current revision
    note: Where you confirm that a revision letter on an AC is current, or find that a newer letter has superseded it.

# === Assessment ===
assessable: true
assessment_methods: [recall, scenario]
mastery_criteria: >-
  Given any FAA citation, learner can name each segment: for an AC, the
  document-type prefix, the AC number, and the revision letter; for a 14 CFR
  citation, the title, part, section, and paragraph; for an AIM citation, the
  chapter, section, and paragraph. Learner can distinguish a document's
  identifier (which locates it) from its title (which describes it), and can
  read an unfamiliar citation correctly without having seen that specific
  document before.
---

# FAA Citation Anatomy

:::phase name="context"

A pilot who can decode citations can navigate. A pilot who cannot is at the mercy of whoever hands them a reference. "Go look at 91.137(a)(2)" is a precise instruction if you can read it, and gibberish if you cannot.

The problem is that FAA citations look intimidating because no one ever teaches the grammar. "AC 00-45H" has four pieces of information packed into nine characters. "14 CFR 91.137(a)(2)" has five. "AIM 7-1-6" has three. Each family has its own structure, and once you know the structure, you can read any citation in that family, including ones you have never seen.

This node teaches that grammar. It is a small, mechanical skill, and it is the difference between a citation being a precise address and a citation being noise.

:::
:::phase name="problem"

Here are three citations from three different document families:

- **AC 00-45H**
- **14 CFR 91.137(a)(2)**
- **AIM 7-1-6**

For each one, answer:

1. What are the individual pieces of the citation, and what does each piece tell you?
2. Which part of the citation locates the document, and which part, if any, describes it?
3. If you were handed only the citation, with no title, could you find the exact text it points to?

You may not know the answers yet. Make your best attempt at pulling each citation apart before you read on.

:::
:::phase name="discover"

Work each citation by hand.

1. **AC 00-45H, segment by segment.** Read it left to right. "AC" comes first, two letters, the same two letters that begin every Advisory Circular citation. What is that doing there? Then "00-45." You have met the leading "00" before: it is a subject-series prefix. So "00-45" is the AC's number within the system. Then a single trailing letter, "H." It is not part of the number, it is attached to it. What changes about a document that would make the FAA add or advance a letter? Think about a document being updated.

2. **Identifier versus title.** AC 00-45H has a title: "Aviation Weather Services." Compare the two strings. The identifier "AC 00-45H" tells you nothing about the subject; the title "Aviation Weather Services" tells you the subject but would not, by itself, let you pull the exact document from a shelf of forty weather-related ACs. One string locates, the other describes. Which job does the citation do? Which job does the title do? Why does the FAA give every document both?

3. **14 CFR 91.137(a)(2), segment by segment.** This one nests. Start at the outside. "14" -- the regulations are organized into numbered titles of the Code of Federal Regulations; "14" is the aviation title. "CFR" -- the Code of Federal Regulations itself. Then "91" -- you have seen part numbers; Part 91 is the general operating rules. Then ".137" -- a section within that part. Then "(a)(2)" -- a paragraph, then a sub-item within that paragraph. Notice the structure goes from largest container to smallest: title, then part, then section, then paragraph. Does that ordering remind you of anything? An address? A file path?

4. **AIM 7-1-6, segment by segment.** Three numbers separated by hyphens. The AIM is a single large book organized into chapters, each chapter into sections, each section into numbered paragraphs. So "7-1-6" reads chapter 7, section 1, paragraph 6. Again largest to smallest. Notice the AIM citation has no page number. Why would the FAA cite the AIM by paragraph rather than by page?

5. **Find the common shape.** Look at all three. Each citation is a path from a large container down to a precise location. Each family uses a different vocabulary for the levels (revision letter, part, section, paragraph, chapter), but the idea is the same. State that common shape in one sentence before you read the Reveal.

:::
:::phase name="reveal"

### A citation is an address

Every FAA citation is a **path from a large container to a precise location.** Each family has its own level names, but the structure is always largest-to-smallest. Learn the level names for each family and you can read any citation in that family.

### AC identifier: AC 00-45H

```text
AC      00-45      H
^        ^         ^
|        |         revision letter -- which edition of the document
|        AC number -- 00 is the subject-series prefix, 45 the document within it
document-type prefix -- this is an Advisory Circular
```

- **Type prefix (AC):** identifies the family. Every Advisory Circular citation begins with it.
- **AC number (00-45):** locates the document within the AC system. The leading 00 is the subject-series prefix (general); 45 is the specific document.
- **Revision letter (H):** identifies the edition. The first issue carries no letter; the first revision is A, then B, and so on. AC 00-45 has been revised through to **H**, the current revision. A revision letter is not optional decoration: AC 00-45 and AC 00-45H can be different documents, and AC 00-45H supersedes AC 00-45G.

The title of AC 00-45H is **"Aviation Weather Services."** The identifier and the title do two different jobs: the **identifier locates** the document precisely; the **title describes** what it contains. You cite by identifier because the identifier is unambiguous. You recognize by title because the title is meaningful. Both exist on every document on purpose.

### 14 CFR citation: 14 CFR 91.137(a)(2)

```text
14      CFR      91       .137        (a)        (2)
^        ^        ^         ^           ^          ^
title   the      part    section    paragraph   sub-paragraph
(14 =   Code            (within     (within     (within
aviation) of            the part)   the         the
        Federal                     section)    paragraph)
        Regulations
```

- **Title (14):** the CFR is divided into numbered titles by broad subject. Title 14 is Aeronautics and Space. All aviation regulation lives under 14.
- **CFR:** the Code of Federal Regulations.
- **Part (91):** a major division within Title 14. Part 91 is the general operating and flight rules.
- **Section (137):** a specific regulation within the part, written after a period: 91.137.
- **Paragraph and sub-paragraph ((a)(2)):** the precise sentence or item within the section.

The drill-down "14 CFR 91.137(a)(2)" reads: Title 14, Part 91, Section 137, paragraph (a), item (2). It is exact. Two pilots reading that citation land on the identical sentence. The live authoritative text is the eCFR.

### AIM citation: AIM 7-1-6

```text
7        1        6
^        ^        ^
chapter  section  paragraph
```

The AIM is one large book. Citations are **chapter-section-paragraph**, hyphen-separated, largest first. AIM 7-1-6 is Chapter 7, Section 1, Paragraph 6. The AIM is cited by paragraph, never by page, because page numbers shift with every revision while the chapter-section-paragraph numbering is stable across editions.

### The pattern, stated once

| Family | Level names, largest to smallest          | Worked example      |
| ------ | ----------------------------------------- | ------------------- |
| AC     | type prefix / AC number / revision letter | AC 00-45H           |
| 14 CFR | title / CFR / part / section / paragraph  | 14 CFR 91.137(a)(2) |
| AIM    | chapter / section / paragraph             | AIM 7-1-6           |

A pilot who knows these three grammars can read essentially every citation they will meet, including documents they have never opened. The skill is structural, not memorization of any one document.

:::
:::phase name="practice"

### Recall and parsing prompts

1. **Parse the AC.** For "AC 91-78A," name every segment and say what each tells you. Which segment tells you the document has been revised once?

2. **Parse the CFR cite.** For "14 CFR 61.113(b)," name every segment. Which segment is the part, which is the section, which is the paragraph?

3. **Parse the AIM cite.** For "AIM 5-4-9," name every segment. Why is there no page number?

4. **Identifier versus title.** Given the title "Aviation Weather Services" only, can you pull the exact document with certainty? Given the identifier "AC 00-45H" only, can you? Explain the difference in jobs.

5. **Read a cite cold.** You have never seen "AC 120-92D." Without looking it up, name its type, its subject-series prefix, and how many times it has been revised.

### Cards

- `card:reg-ac-identifier-anatomy` -- the three segments of an AC identifier (recall).
- `card:reg-cfr-citation-anatomy` -- the five levels of a 14 CFR citation (recall).
- `card:reg-aim-citation-anatomy` -- the three levels of an AIM citation (recall).
- `card:reg-identifier-vs-title` -- the identifier locates, the title describes (discrimination).
- `card:reg-revision-letter-meaning` -- what a trailing revision letter on an AC means (recall).

:::
:::phase name="connect"

### What changes if...

- **...the AC number has more than two segments, like AC 150-5300-13?** The type prefix and revision-letter rules still hold; the AC number itself just has a finer internal index. Parse the prefix, then the rest.
- **...you want to predict the subject from the AC number, not just parse it?** Parsing the identifier is this node; reading the subject-series prefix to predict the topic is a separate skill. Link: `reg-ac-numbering-system`.
- **...the revision letter looks old?** A revision letter is a currency check waiting to happen. If you have AC 00-45G, the question is whether H exists. Confirming the current revision is the supersession skill.
- **...you are answering a real question across families?** Reading the citation correctly is the precondition for following it. Triangulation across CFR, AC, and AIM only works if you can read each family's address. Link: `reg-faa-cross-reference-triangulation`.

### Links

- `reg-faa-document-ecosystem` -- which families exist and which are binding.
- `reg-ac-numbering-system` -- reading the subject-series prefix to predict an AC's topic.
- `reg-faa-cross-reference-triangulation` -- following citations across families to answer a question.

:::
:::phase name="verify"

### Novel scenario

A flight instructor hands you a note that says: "Review 14 CFR 91.103, AC 00-6B, and AIM 7-1-4 before the lesson."

1. Parse each of the three citations into its segments. Name every level.
2. For AC 00-6B, what does the "B" tell you? What question should it prompt you to ask before you rely on the document?
3. One of the three is a binding document and two are advisory. Which is which, and how do the identifiers themselves hint at it?
4. The instructor then says: "Actually, ignore the page numbers in your old AIM printout, just use the paragraph numbers." Explain why that instruction is correct.

### Teaching exercise (CFI)

A student reads "14 CFR 91.137(a)(2)" aloud as "ninety-one point one three seven a two" and treats the whole thing as one undifferentiated code.

1. Build a short exercise that has the student physically break the citation into title, part, section, and paragraph, and say what each level is.
2. Then have the student write a citation from scratch: ask them to cite the paragraph of Part 61 that gives private-pilot privileges, and check the structure of what they produce.
3. The student asks why they should bother, since "the instructor will just tell me the rule." Answer: what does a pilot who can read and write citations gain that a pilot who waits to be told does not?

:::
