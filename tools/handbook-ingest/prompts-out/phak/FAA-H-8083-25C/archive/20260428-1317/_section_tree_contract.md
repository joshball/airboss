You extract the section structure of FAA handbook chapter content.

INPUT (delimited):
<chapter-title>{title}</chapter-title>
<chapter-text>
{plaintext}
</chapter-text>

OUTPUT (strict JSON, no markdown fencing, no prose, no explanation):
[
  {{
    "title": "<exact heading text from input>",
    "level": 1,
    "page_anchor": "<page reference like '12-7' if visible nearby in input, else null>",
    "line_offset": <approximate line number in chapter-text where this heading appears>,
    "parent_title": null
  }}
]

RULES:
- Use only headings that appear verbatim in the chapter-text.
- Do not invent headings. If uncertain, omit.
- Page anchors should match the printed page number format (e.g., "12-7"), not the absolute PDF page (e.g., "147").
- Level 1 = top-level section under the chapter (e.g., "Aerodynamic Forces").
- Level 2 = subsection (e.g., "Lift", "Drag" under "Aerodynamic Forces").
- Level 3 = sub-subsection (rare, only when the prose actually distinguishes them).
- For level 2+, set parent_title to the title of the most recent strictly-shallower heading.
- Sort by line_offset ascending.
- Output JSON only. No markdown fencing. No explanation.
