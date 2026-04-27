---
title: How to read a citation
week: 1
section_order: "02"
covers_regulations:
  - 91.103
  - 91.169
  - 91.13
  - 91.3
  - 61.57
ties_to_knowledge_nodes: []
---

# How to read a citation

A regulation citation is a precise address. Reading it sloppily is the single most common source of pilots being wrong about regulations -- including pilots in oral exams, including pilots in court. This lesson teaches you to parse citations exactly.

## What you'll be able to do

- Read aloud and parse any standard CFR citation
- Distinguish between section, paragraph, sub-paragraph, and item levels of granularity
- Identify when a citation refers to a different document entirely (USC, AC, AIM, NTSB)
- Resolve ambiguous spoken citations into the right written form

## Why this matters

A pilot who hears "ninety-one one-oh-three" needs to know this is **Part 91, Section 103** -- which is "Preflight action," roughly two pages of regulation. A pilot who hears "ninety-one one-sixty-nine alpha two" needs to know this is **§91.169(a)(2)** -- one specific clause about IFR alternate filing requirements, three lines of text. The difference between the two is roughly a thousand to one in how much text you're being asked to know.

When examiners give you regulations to look up, they cite to the level of granularity that matters. When you cite back to them, you are expected to be equally precise. This lesson is the precision drill.

## The discovery question

If you saw `91.169(c)(1)(i)` written on a checkride scratchpad, how many distinct pieces of information are in that string?

Pause.

Five:

1. The Part: 91
2. The Section: 169
3. The paragraph: (c)
4. The sub-paragraph: (1)
5. The item: (i)

Each level zooms further in. Reading it aloud properly:

> "Title 14, Part 91, Section 169, paragraph c, sub-paragraph 1, item i"

That's the full read. Working pilots collapse it: "ninety-one one-sixty-nine charlie one romeo" or "ninety-one one-sixty-nine c-one-i." Both are unambiguous because each level uses a different alphabet (numbers for parts/sections/sub-paragraphs, lowercase letters for paragraphs, lowercase roman numerals for items).

## The standard citation form

```text
14 CFR § 91.169(c)(1)(i)
   ^      ^   ^   ^   ^   ^
   |      |   |   |   |   +-- item (lowercase roman: i, ii, iii, iv ...)
   |      |   |   |   +------ sub-paragraph (arabic: 1, 2, 3 ...)
   |      |   |   +---------- paragraph (lowercase letter: a, b, c ...)
   |      |   +-------------- section (within Part 91)
   |      +------------------ Part 91
   +------------------------- Title 14, CFR
```

Several common variants -- all the same citation:

```text
14 CFR 91.169(c)(1)(i)
14 C.F.R. § 91.169(c)(1)(i)
§ 91.169(c)(1)(i)
91.169(c)(1)(i)
```

Different sources use different styles. The FAA's own publications often drop "14 CFR" because it's implied. NTSB orders use the full form. The text is the same.

## Reading levels of granularity

What does each level *mean*?

### Section level: §91.169

Without any paragraph specifier, this means **the entire section** -- everything under §91.169 ("IFR flight plan: information required"). That's about a page of text covering both flight-plan info and the alternate-airport requirements.

### Paragraph level: §91.169(c)

This means **paragraph (c) of section 91.169** -- specifically "IFR alternate airport weather minima." About half a page.

### Sub-paragraph level: §91.169(c)(1)

This means **sub-paragraph 1 within paragraph (c)** -- the case where a Part 97 instrument approach exists at the alternate. Roughly four lines.

### Item level: §91.169(c)(1)(i)

This means **item i within sub-paragraph 1** -- the precision approach minimum: ceiling 600 feet and visibility 2 statute miles. One sentence.

When an examiner says "tell me about §91.169(c)(1)(i)" they want one sentence. When they say "tell me about §91.169" they want the whole picture.

## Reading a citation aloud

Different communities have different oral conventions. The two you'll hear most:

### Phonetic style (used in oral exams, NTSB hearings)

> "Title 14, Part 91, Section 103"
> "Section 91.169 paragraph c, sub-paragraph 1, item i"

Slower and unambiguous. Use this when precision matters.

### Working-pilot style (used in CFI conversations, hangar talk)

> "Ninety-one one-oh-three"
> "Ninety-one one-sixty-nine c-one-i"

Faster, requires the listener to fill in the parsing. Common, fine in informal contexts.

### Specifically: the section number

`91.103` is read as "ninety-one one-oh-three" -- treat the section number as a multi-digit run. Not "ninety-one point one hundred three" (the period is a separator, not a decimal). Not "ninety-one dot one zero three." Pilots who say "point" sound like they don't know how citations work.

## Distinguishing similar citations

These look similar and have caused real confusion in oral exams and incident reports:

| Citation     | What it is                                          | Length       |
| ------------ | --------------------------------------------------- | ------------ |
| **§91.3**    | PIC authority and emergency deviation               | 3 paragraphs |
| **§91.13**   | Careless or reckless operation                       | 2 paragraphs |
| **§91.103**  | Preflight action                                     | 1 page       |
| **§91.119**  | Minimum safe altitudes                               | 1 page       |
| **§91.123**  | Compliance with ATC clearances and instructions     | 2 paragraphs |
| **§91.13** vs **§91.130** | Careless/reckless vs Class C ops      | very different |

The trap: in fast speech, "ninety-one thirteen" and "ninety-one one thirty" can blur. Always pause briefly between digits when there's any chance of ambiguity. In writing, always use the period properly: §91.13, not §91-13 or §91/13.

### The 91.3 / 91.13 pair specifically

The two most-cited Part 91 sections in violation actions are 91.3 and 91.13. They are NOT the same section.

- **§91.3 — Responsibility and authority of the pilot in command.** The PIC is directly responsible for, and is the final authority as to, the operation of the aircraft. May deviate from any rule to the extent required to meet an in-flight emergency. Must report a deviation if requested by the FAA.
- **§91.13 — Careless or reckless operation.** No person may operate an aircraft in a careless or reckless manner so as to endanger the life or property of another (paragraph (a) — in flight) or in a manner that would endanger another (paragraph (b) — non-flight ops).

These sections are different things. §91.3 is the PIC's authority; §91.13 is the catch-all enforcement hook. Calling 91.13 "the PIC rule" or 91.3 "the careless rule" will mark you as imprecise on day one.

## Citations to non-Part 91 documents

Pilot-relevant law lives in many documents. The citation form differs:

| Document                | Form                                  | Example                              |
| ----------------------- | ------------------------------------- | ------------------------------------ |
| 14 CFR                  | Title CFR Part.Section(paragraph)     | 14 CFR § 91.169(c)(1)(i)             |
| 49 CFR                  | Same form, different Title            | 49 CFR § 830.5                       |
| United States Code      | Title USC § Section                    | 49 USC § 44703                       |
| Advisory Circular       | AC Number                             | AC 61-65 (sometimes AC 61-65J for revision letter) |
| AIM                     | Chapter-Section-Paragraph             | AIM 5-1-7 (chapter 5, section 1, paragraph 7) |
| Chief Counsel letter    | Recipient name + year                 | Mangiamele (2009), Hicks (2010)      |
| FAA Order               | Order Number, Volume, Chapter         | FAA Order 8900.1, Vol 5, Ch 1        |
| NTSB Board order        | Case name + EA-#                       | Administrator v. Lobeiko, EA-5310    |

When a citation has a Roman numeral or a chapter number with hyphens (like `5-1-7`), you're almost certainly looking at the AIM, not a CFR section.

## Common misreadings

- **Treating the period as a decimal.** "Ninety-one point one-oh-three" tells the world you don't know how citations work. The period is a separator between Part and Section.
- **Conflating section numbers and paragraph letters.** "Ninety-one A-one" is not a citation -- there is no "A1" in 14 CFR. You probably meant `91.1(a)(1)` or `91.21(a)(1)`. Slow down.
- **Citing without paragraph when you mean a paragraph.** "It's in 91.205" when you specifically mean the IFR list at 91.205(d). Imprecision is the trap; the examiner can ask "where in 91.205?"
- **Citing the AIM as if it were a regulation.** "AIM 5-1-7 says I have to..." -- the AIM does not require anything. It describes recommended practice. The regulatory hook is 91.13 if a deviation from AIM creates a careless/reckless scenario.
- **Citing 14 CFR section numbers as 14 USC.** USC is the United States Code (statute). CFR is the Code of Federal Regulations (regulation). The actor matters: Congress writes USC; agencies write CFR. Citing one when you mean the other is a category error.
- **Forgetting that 49 CFR Part 830 is NTSB, not FAA.** The most common citation outside Title 14 that pilots need. Living in the wrong title means living in the wrong regulatory ecosystem.

## Drills

### Parse these citations aloud

| Written          | Read aloud (phonetic style)                                             |
| ---------------- | ----------------------------------------------------------------------- |
| §91.103          | Section ninety-one one-oh-three                                          |
| §91.103(b)(1)    | Section ninety-one one-oh-three paragraph b sub-paragraph one            |
| §61.57(c)(1)(i)  | Section sixty-one fifty-seven paragraph c sub-paragraph one item i       |
| §91.213(d)       | Section ninety-one two-thirteen paragraph d                              |
| §91.13           | Section ninety-one thirteen                                              |
| §91.130          | Section ninety-one one-thirty                                            |

### Parse these spoken citations into written form

| Spoken                                                | Written          |
| ----------------------------------------------------- | ---------------- |
| "ninety-one one-sixty-seven"                          | §91.167          |
| "ninety-one one-sixty-nine bravo"                     | §91.169(b)       |
| "sixty-one fifty-six alpha"                           | §61.56(a)        |
| "ninety-one two-eleven a-three"                       | §91.211(a)(3)    |
| "fourteen CFR sixty-one fifty-seven c-one-i"          | 14 CFR § 61.57(c)(1)(i) |
| "forty-nine CFR eight-thirty point five"              | 49 CFR § 830.5   |

### Identify the source

| Citation                          | Source                                  |
| --------------------------------- | --------------------------------------- |
| 14 CFR § 91.103                   | Federal Aviation Regulation             |
| 49 CFR § 830.5                    | NTSB regulation (incident reporting)    |
| 49 USC § 44703                    | United States Code (BasicMed authority) |
| AIM 5-1-7                         | AIM (procedure guidance, not regulation)|
| AC 61-65                          | Advisory Circular (guidance)            |
| FAA Order 8900.1                  | FSDO operations handbook                |
| Mangiamele (2009)                 | Chief Counsel interpretation letter     |
| Administrator v. Lobeiko          | NTSB Board order (enforcement precedent)|

## Where this lesson sits

This is the second of four foundation lessons in Week 1. The first ([01-title-14-shape.md](01-title-14-shape.md)) gave you the structural map. This one gave you the address syntax. The next ([03-companion-documents.md](03-companion-documents.md)) covers what's *outside* Title 14 that you still need to know. The fourth ([04-the-pilot-the-flight-the-operation.md](04-the-pilot-the-flight-the-operation.md)) is the framing that organizes the entire course.

## Related

- Live source: [eCFR Title 14](https://www.ecfr.gov/current/title-14)
- Live source: [eCFR Part 91](https://www.ecfr.gov/current/title-14/chapter-I/subchapter-F/part-91)
- Drill bank: [drills.md](drills.md)
