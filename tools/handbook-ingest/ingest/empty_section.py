"""Empty-section detection + per-doc remediation policy.

WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.

An "empty section" is one whose body markdown contains zero paragraph-level
prose after frontmatter-strip + figure-injection (see the IFH chapter 1
"Introduction" subsection example in the WP spec). The extractor produces
the empty row when it splits a heading off without a paragraph behind it.

Three branches, keyed on the dotted-decimal section code (NOT chapter
ordinals), driven by the per-doc YAML `empty_section_policy:` block:

- `merge_upward[]`     -- drop the row from the manifest entirely. Emit
                           `empty-section-merged` warning.
- `best_effort_fill[]` -- scan the section's claimed PDF pages for
                           orphan paragraphs (prose not present in any
                           sibling body). If any qualifying prose is
                           found, attribute it to this section and tag
                           `extraction_status: 'merged-from-orphans'`.
                           If none, fall to the default branch and
                           emit `empty-section-kept`.
- default              -- keep the row, tag
                           `metadata.extraction_status: 'no-body-content'`
                           on the manifest section row, emit
                           `empty-section-kept` warning.

Frontmatter strip already happens upstream (the body_md the writer sees
has no `---` block). Figure-injection happens in `normalize._compose_markdown`,
AFTER the policy applies, so figures don't fool the empty-detector.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import fitz

from .config_loader import EmptySectionPolicy
from .outline import OutlineNode
from .sections import SectionBody

# Heading-only line: a `#` markdown heading or a single-line title that
# `_compose_markdown` synthesizes (`# <Title>`). Headings alone don't count
# as prose.
_HEADING_LINE_RE = re.compile(r"^\s*#{1,6}\s+\S")
# YAML frontmatter delimiter; a body_md value should not normally contain
# this (the section writer strips frontmatter before calling normalize).
_YAML_DELIMITER = "---"
# Minimum char count of orphan prose to attribute via best_effort_fill.
# Prevents fragments / page numbers / running headers from being attributed.
_ORPHAN_MIN_CHARS = 80
# Maximum char count of attributable orphan prose. A multi-page run usually
# means we're absorbing a sibling section, not a stranded paragraph; stop.
_ORPHAN_MAX_CHARS = 4000


@dataclass(frozen=True)
class EmptySectionWarning:
    """One warning emitted by the empty-section policy.

    Code is one of `empty-section-kept` / `empty-section-merged`. Caller
    routes through the `extra_warnings` lane on `write_outputs`, so the
    warning is normalized into the manifest like the other strategy
    instrumentation codes.
    """

    code: str
    section_code: str
    message: str

    def as_extra_warning_str(self) -> str:
        """Render as `<code>: <message>` for the `extra_warnings` lane.

        `normalize.write_outputs` parses the colon-prefix to route the
        message into the right manifest code; both `empty-section-kept`
        and `empty-section-merged` are on `ALLOWED_WARNING_CODES` so the
        prefix-match path will not fall back to `section-strategy`.
        """
        return f"{self.code}: {self.message}"


def is_empty_body(body_md: str) -> bool:
    """Return True when the body markdown has zero paragraph-level prose.

    Conservative heuristic: walks the lines and counts any non-blank,
    non-heading line as prose. Returns True when the count is zero.
    Pure `#` headings, blank lines, YAML delimiters, and whitespace-only
    lines do not count as prose.
    """
    if not body_md:
        return True
    for raw in body_md.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line == _YAML_DELIMITER:
            continue
        if _HEADING_LINE_RE.match(line):
            continue
        # Found a non-blank, non-heading line -- there is prose.
        return False
    return True


def apply_empty_section_policy(
    policy: EmptySectionPolicy,
    pdf_path: Path,
    outline_nodes: list[OutlineNode],
    bodies: list[SectionBody],
) -> tuple[list[OutlineNode], list[SectionBody], dict[str, dict[str, str]], list[EmptySectionWarning]]:
    """Resolve every empty section against the per-doc policy.

    Returns the (possibly-filtered) outline_nodes + bodies, a per-section
    metadata dict the caller merges into `write_outputs(section_metadata=...)`,
    and a list of warnings the caller normalizes through the `extra_warnings`
    lane.

    Algorithm:

    1. Walk every body that `is_empty_body()` flags.
    2. If `node.code in policy.merge_upward`: drop the row + emit
       `empty-section-merged`.
    3. Elif `node.code in policy.best_effort_fill`: scan the PDF page(s)
       the row claims for orphan prose; if found, attribute it +
       record `merged-from-orphans` metadata; if not, fall to default.
    4. Else (default): keep the row + record `no-body-content` metadata +
       emit `empty-section-kept`.

    Front-matter rows (`level == 'front-matter'`) are exempt from the
    policy; their bodies are short by design and the policy targets the
    chapter / section / subsection extraction quality, not the
    front-matter capture.
    """
    keep_codes: set[str] = set()
    warnings: list[EmptySectionWarning] = []
    section_metadata: dict[str, dict[str, str]] = {}
    fill_results: dict[str, str] = {}  # code -> orphan prose to inject

    # Pre-compute a per-PDF-page text cache for best_effort_fill scans.
    page_text_cache: dict[int, str] = {}

    def _page_text(pdf_page: int) -> str:
        if pdf_page not in page_text_cache:
            with fitz.open(pdf_path) as doc:
                if 1 <= pdf_page <= doc.page_count:
                    page_text_cache[pdf_page] = doc.load_page(pdf_page - 1).get_text("text") or ""
                else:
                    page_text_cache[pdf_page] = ""
        return page_text_cache[pdf_page]

    # Build a "what text is already claimed" lookup so best_effort_fill
    # doesn't re-attribute prose that lives in a sibling.
    already_claimed_by_page: dict[int, str] = {}
    for body in bodies:
        for pg in range(body.node.page_start, body.node.page_end + 1):
            already_claimed_by_page.setdefault(pg, "")
            already_claimed_by_page[pg] += "\n" + body.body_md

    for body in bodies:
        node = body.node
        if node.level == "front-matter":
            keep_codes.add(node.code)
            continue
        if not is_empty_body(body.body_md):
            keep_codes.add(node.code)
            continue
        # Empty section detected; resolve via policy.
        if node.code in policy.merge_upward:
            warnings.append(
                EmptySectionWarning(
                    code="empty-section-merged",
                    section_code=node.code,
                    message=(
                        f"Section §{node.code} '{node.title}' had no body prose; "
                        f"dropped per merge_upward policy."
                    ),
                )
            )
            continue  # not added to keep_codes -> dropped
        if node.code in policy.best_effort_fill:
            orphan_prose = _scan_orphan_prose(
                node, _page_text, already_claimed_by_page
            )
            if orphan_prose:
                fill_results[node.code] = orphan_prose
                section_metadata[node.code] = {"extraction_status": "merged-from-orphans"}
                keep_codes.add(node.code)
                # No warning -- the fill succeeded, no triage needed.
                continue
            # Fall through to default when no orphan prose found.
            warnings.append(
                EmptySectionWarning(
                    code="empty-section-kept",
                    section_code=node.code,
                    message=(
                        f"Section §{node.code} '{node.title}' had no body prose; "
                        f"best_effort_fill found no orphan paragraphs on the section's "
                        f"PDF pages; falling to default keep-with-placeholder."
                    ),
                )
            )
            section_metadata[node.code] = {"extraction_status": "no-body-content"}
            keep_codes.add(node.code)
            continue
        # Default: keep with placeholder.
        warnings.append(
            EmptySectionWarning(
                code="empty-section-kept",
                section_code=node.code,
                message=(
                    f"Section §{node.code} '{node.title}' had no body prose; "
                    f"kept with `extraction_status: no-body-content` placeholder."
                ),
            )
        )
        section_metadata[node.code] = {"extraction_status": "no-body-content"}
        keep_codes.add(node.code)

    # Apply fills + filter dropped rows.
    new_outline = [n for n in outline_nodes if n.code in keep_codes]
    new_bodies: list[SectionBody] = []
    for body in bodies:
        if body.node.code not in keep_codes:
            continue
        if body.node.code in fill_results:
            filled_md = fill_results[body.node.code]
            new_bodies.append(
                SectionBody(
                    node=body.node,
                    body_md=filled_md,
                    faa_page_start=body.faa_page_start,
                    faa_page_end=body.faa_page_end,
                    char_count=len(filled_md),
                )
            )
        else:
            new_bodies.append(body)

    return new_outline, new_bodies, section_metadata, warnings


def _scan_orphan_prose(
    node: OutlineNode,
    get_page_text,
    already_claimed_by_page: dict[int, str],
) -> str:
    """Scan the section's PDF page range for prose not attributed elsewhere.

    Conservative implementation: for each PDF page in the section's range,
    pull the raw text, drop any line that already appears in a sibling
    body, and keep what's left if it represents at least one substantive
    paragraph (at least one sentence ending in `.` / `?` / `!`).

    Returns the joined orphan prose, or empty string when no qualifying
    runs were found. The caller decides whether to attribute (>=
    `_ORPHAN_MIN_CHARS`) or fall through to the default policy.
    """
    out_parts: list[str] = []
    for pdf_page in range(node.page_start, node.page_end + 1):
        page_text = get_page_text(pdf_page)
        if not page_text:
            continue
        claimed = already_claimed_by_page.get(pdf_page, "")
        # Walk paragraphs; keep ones not present (substring) in claimed.
        # Paragraphs are separated by blank lines.
        for para in re.split(r"\n\s*\n", page_text):
            cleaned = para.strip()
            if not cleaned or len(cleaned) < _ORPHAN_MIN_CHARS:
                continue
            # Skip if the paragraph clearly already lives in a sibling body.
            if cleaned[:80] and cleaned[:80] in claimed:
                continue
            # Need at least one sentence-ending punctuation.
            if not re.search(r"[.!?]\s", cleaned):
                continue
            out_parts.append(cleaned)
            if sum(len(p) for p in out_parts) > _ORPHAN_MAX_CHARS:
                break
        if sum(len(p) for p in out_parts) > _ORPHAN_MAX_CHARS:
            break
    if not out_parts:
        return ""
    return "\n\n".join(out_parts)
