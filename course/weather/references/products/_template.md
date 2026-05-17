---
id: wx-ref-SLUG
title: Product Full Name (SHORT_CODE)
short_code: SHORT_CODE
category: surface-obs | terminal-forecast | area-product | hazard-advisory | winds-temps | pirep | chart | radar-sat | icing-turb | tfr-notam
tier: 1 | 2
status: stub | draft | done
authoritative_sources:
  - source: AC 00-45H
    section: ''
    note: ''
  - source: AIM
    section: ''
    note: ''
  - source: FAA-H-8083-28
    section: ''
    note: ''
related_knowledge_nodes: []
related_products: []
---

# Product Full Name (SHORT_CODE)

> One-sentence elevator pitch: what this product answers, in plain English.

## What it is

A short paragraph: who issues it, how often, what it covers, what shape it takes (encoded text vs chart vs polygon advisory vs raster). Keep it accessible to a private pilot reading it for the first time.

## When you read it

- Preflight, en route, both? At what point in the briefing flow?
- What decision does it inform? (go/no-go, route selection, altitude selection, divert)
- What it replaces or supplements in the briefing pack.

## How to read it

For fixed-format encoded text products, a field-by-field table:

| Field   | Example | Meaning                                   |
| ------- | ------- | ----------------------------------------- |
| Type    | METAR   | Routine surface observation               |
| Station | KJFK    | ICAO identifier for the reporting station |
| ...     | ...     | ...                                       |

For chart products, a labeled walkthrough of the symbology and the questions each layer answers.

## Annotated example(s)

### Example 1 -- (short label)

Raw product text:

```text
PASTE THE RAW PRODUCT
```

Decoded:

- Line/group 1 -- plain English
- Line/group 2 -- plain English
- ...

What this is telling you: 1-2 sentences synthesizing the full snapshot.

### Example 2 -- (short label, ideally a contrasting case)

(Same pattern. Aim for at least one routine and one challenging example.)

## Common gotchas

- The unit trap that bites people (Zulu time vs local, statute vs nautical miles, AGL vs MSL on ceilings).
- The field that's easy to misread.
- The way this product can disagree with a related product, and which one to trust when.

## Triage

When you have 60 seconds to scan this product, where do your eyes go first? What changes the go/no-go decision? What's load-bearing and what's noise?

## Related products

- [sibling-product-slug](../sibling-product-slug/page.md) -- one-line reason to read it alongside this one.

## Authoritative sources

- **AC 00-45H** -- Aviation Weather Services, §X.Y (specific section)
- **AIM** -- 7-X-Y (specific paragraph)
- **FAA-H-8083-28** -- Aviation Weather Handbook, Chapter X (specific chapter)
- Service docs: link to aviationweather.gov product page if applicable

## Related knowledge nodes

For the pedagogical (discovery-walk) treatment of this product, see:

- [knowledge node title](../../../../knowledge/weather/NODE-SLUG/node.md)
