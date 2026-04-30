CONTRACT VERSION: 3

You extract the section structure of FAA handbook chapter content.

INPUT (delimited):
<chapter-title>{title}</chapter-title>
<chapter-text>
{plaintext}
</chapter-text>

OUTPUT (strict JSON, no markdown fencing, no prose, no explanation):

[
  {
    "title": "<exact heading text from input>",
    "level": 1,
    "page_anchor": "<page reference like '12-7' if visible near the heading in input, else null>",
    "line_offset": <approximate line number in chapter-text where this heading appears>,
    "parent_title": null
  }
]

RULES:

- Use only headings that appear verbatim in the chapter-text. Do not invent. If uncertain, omit.
- The literal string "no-anchor" is FORBIDDEN. Use null when no page anchor is found.
- Page anchors match the printed FAA page format (e.g. "12-7"), not the absolute PDF page (e.g. "147").
- A page anchor is "near" a heading if the heading and the anchor appear within roughly 50 lines of each other in chapter-text. Use the closest anchor that PRECEDES or appears at the same line as the heading. Body text typically prints the anchor at the page footer; the heading on that page binds to that anchor.
- Level 1 = top-level section under the chapter (e.g. "Aerodynamic Forces").
- Level 2 = subsection (e.g. "Lift", "Drag" under "Aerodynamic Forces").
- Level 3 = sub-subsection (rare; use only when the prose actually distinguishes them).
- For level 2+, set parent_title to the title of the most recent strictly-shallower heading.
- Sort by line_offset ascending.
- Output JSON only. No markdown fencing. No explanation.

INCLUDE these as L1 entries when they appear as standalone headings in body text:

- "Introduction" (most chapters open with one)
- "Chapter Summary" (most chapters close with one)
- Numbered or named appendices that conclude the chapter.

These are real sections of the chapter even though they may be absent from a printed table of contents.

HIERARCHY PREFERENCE -- body text wins over printed TOC:

- The body text's nesting is authoritative. If the body shows "Fixed-Pitch Propeller" appearing under a "Propeller" heading, emit Fixed-Pitch Propeller as level 2 with parent_title "Propeller", regardless of whether a printed table-of-contents elsewhere lists them as siblings.
- Sub-topics that the body groups under a parent heading are children, not siblings.
- Do not promote subsections to L1 because of TOC formatting alone.

COVERAGE -- self-check before writing:

The chapter occupies a printed page range stated in the per-chapter prompt (e.g. `7-1..7-41`). Before emitting JSON:

1. Find the largest printed-page anchor referenced by your last entries.
2. If the largest anchor is more than ONE page short of the chapter's last printed page, inspect the pages between the largest anchor and the last printed page in the sidecar:
   - If those trailing pages contain ONLY figure callouts ("FIGURE 7-12"), table titles ("TABLE 7-3"), figure labels, captions, blank space, or other non-heading content, the shortfall is acceptable. Proceed to write JSON.
   - If those trailing pages contain at least one body-text heading you failed to emit, return:
     `error: incomplete coverage -- last anchor at <anchor>, expected on-or-after <last_page>`
     instead of writing JSON.
3. If the chapter has explicit boilerplate ("Chapter Summary"), it must be in your output. Its absence is a coverage failure.

This catches input truncation and partial extractions explicitly. Do not silently emit a short tree. Trailing figure-only pages are common in FAA handbooks (full-page figure plates after the body of the chapter ends) and are not coverage failures.

DIFFICULT CASES -- patterns observed in FAA handbooks:

- **Pseudo-headings.** Bold or capitalized phrases that look like section titles but are list-item labels introducing the entries that follow. Examples: `Privileges:`, `Limitations:`, `Note:`, `Warning:`. These are NOT sections. Do NOT emit them.
- **Two-line wrapped headings.** Long titles wrap onto two consecutive lines in the plaintext. Example: `Wind and Pressure Representation on Surface` followed immediately by `Weather Maps`. Treat as ONE heading; concatenate with a single space; emit once.
- **Sidebar callouts.** Highlighted boxes with their own internal headings. Emit ONLY when the callout is structurally part of the chapter (its content is referenced by surrounding paragraphs). Do NOT emit when the callout is a glossary inset, definition box, or cross-reference pointer.
- **Repeated section titles across chapters.** "Introduction", "Chapter Summary", and identical class names ("Class A") legitimately appear in multiple chapters. Do not deduplicate; emit each occurrence.
- **Numeric-prefix headings.** Some chapters number their L2 headings ("7.1 Powerplant", "7.2 Propeller"). STRIP the numeric prefix from `title` (emit `"Powerplant"`, not `"7.1 Powerplant"`); preserve order via line_offset.
- **All-caps callouts that are not headings.** Captions ("FIGURE 7-12"), table titles ("TABLE 7-3"), and sidebar headers ("WARNING") look like headings but are not. Do NOT emit.

DISAGREEMENTS (defined here; emit machinery lands separately):

A future revision of the per-chapter prompt may pass you a per-chapter checklist derived from a deterministic table-of-contents parser. When that prompt arrives you will emit a SECOND file `_llm_disagreements.json` next to the section tree, with this shape:

```json
[
  {
    "type": "level_mismatch | parent_mismatch | missing_in_body | extra_in_toc | anchor_mismatch",
    "title": "<the heading in question>",
    "toc_says": { "level": 1, "parent_title": null, "page_anchor": "7-1" },
    "body_says": { "level": 1, "parent_title": null, "page_anchor": "7-1" },
    "reason": "<one-sentence explanation, e.g. 'TOC promoted Fixed-Pitch Propeller to L1; body text nests it under Propeller'>"
  }
]
```

When the per-chapter prompt does NOT include a TOC checklist, do NOT write `_llm_disagreements.json`. The current per-chapter prompt does not include one; ignore this section for this run.
