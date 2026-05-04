"""Compose per-section markdown + emit the manifest.

After fetch + outline + sections + figures + tables run, this module is
responsible for:

1. Writing one markdown file per chapter / section / subsection at
   `handbooks/<doc>/<edition>/<chapter>/...`.
2. Emitting the per-edition `manifest.json` the seed reads in Phase 9.
3. Emitting the sibling per-edition `warnings.json` (the normalized
   triage-input file the hangar warning-triage dashboard reads, per
   WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1A).

Each markdown file carries YAML frontmatter matching
`handbookSectionFrontmatterSchema` in `libs/bc/study/src/handbook-validation.ts`.
The manifest matches `handbookManifestSchema`. The warnings sidecar matches
`handbookWarningsFileSchema` in the same module.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from .config_loader import HandbookConfig
from .fetch import FetchResult
from .figures import FigureRecord, FigureWarning
from .ocr_leak import detect_ocr_leaks, elide_ocr_leaks
from .outline import OutlineNode
from .paths import edition_root, ensure_dir, relative_to_repo
from .sections import SectionBody
from .tables import TableRecord, TableWarning

# Closed vocabulary of warning codes the section-tree extractor may emit.
# Mirrors `HANDBOOK_MANIFEST_WARNING_CODES` in
# `libs/bc/study/src/manifest-validation.ts`. Two families:
#
#   1. Extraction-quality codes (WP-HANDBOOK-RE-EXTRACTION-V2): targets the
#      v2 extractor improvements eliminate. The "fixable" set the WP's
#      success criterion measures against.
#   2. Strategy / parser instrumentation: TOC-vs-body disagreements,
#      page-label walk-back failures. Audit signal, not extraction quality.
#
# Keeping the two families in one set means the validator stays a single
# source of truth; classification (which codes count toward "<300 fixable
# warnings") happens at the dashboard / reporting layer via
# `WP_FIXABLE_WARNING_CODES` (TS) -- not enforced in the Python layer.
ALLOWED_WARNING_CODES: frozenset[str] = frozenset(
    {
        # v1 extraction-quality
        "figure-without-caption",
        "caption-without-figure",
        "table-merge-failed",
        "table-empty",
        "cross-reference-unresolved",
        # v2 extraction-quality (Phase 1B + 1C; the codes are reserved here
        # so 1B / 1C PRs only have to start emitting them, not re-extend
        # the validator).
        "table-cell-merge-ambiguity",
        "tablish-block-not-converted",
        "ocr-leak-in-section-body",
        "empty-section-kept",
        "empty-section-merged",
        "front-matter-page-range-not-declared",
        # Strategy / parser instrumentation
        "toc",
        "toc-verify",
        "llm",
        "section-strategy",
        "page-label",
    }
)

# Schema version for the sibling `warnings.json` file. Bump when the
# top-level shape changes; do NOT bump for additions to ALLOWED_WARNING_CODES
# (the schema stays at 1; new codes are additive).
WARNINGS_FILE_SCHEMA_VERSION = 1


def compute_warning_id(code: str, section_code: str | None, message: str) -> str:
    """Stable 16-char hex id for one warning.

    Hashes ``<code>|<section_code or "">|<message[:50]>`` so the same
    warning across re-extractions gets the same id, which the hangar
    triage dashboard uses as the persistence key for triage state
    (open / wontfix / fixed / duplicate).

    16 hex chars (64-bit hash prefix) trades collision risk for readability;
    the dashboard renders the id verbatim in the URL.

    Mirrors the regex `WARNING_ID_REGEX` (`^[0-9a-f]{16}$`) on the
    TS-side schema in `libs/bc/study/src/manifest-validation.ts`.
    """
    section = section_code or ""
    head = (message or "")[:50]
    payload = f"{code}|{section}|{head}".encode()
    digest = hashlib.sha256(payload).hexdigest()
    return digest[:16]


@dataclass
class WriteSummary:
    sections_written: int
    figures_written: int
    tables_written: int
    warnings: int
    manifest_path: Path
    warnings_path: Path


def write_outputs(
    config: HandbookConfig,
    fetch_result: FetchResult,
    outline_nodes: list[OutlineNode],
    bodies: list[SectionBody],
    figures: list[FigureRecord],
    figure_warnings: list[FigureWarning],
    tables: list[TableRecord],
    table_warnings: list[TableWarning],
    extraction_metadata: dict[str, object] | None = None,
    extra_warnings: list[str] | None = None,
    section_metadata: dict[str, dict[str, str]] | None = None,
) -> WriteSummary:
    root = ensure_dir(edition_root(config.document_slug, config.edition))

    bodies_by_code = {b.node.code: b for b in bodies}
    if config.chapter_cover_strip_enabled:
        for body in bodies:
            if body.node.level == "chapter":
                body.body_md = _strip_cover_residue(
                    body.body_md, body.node.title, config.chapter_cover_strip_max_lines
                )
                body.char_count = len(body.body_md)
    # OCR-leak elision: scan each body for runs of 8+ consecutive 1-2-character
    # tokens (the IFH 2/5 phonetic-alphabet figure-leak pattern). Runs the body
    # through `detect_ocr_leaks` -> `elide_ocr_leaks`; warnings carry the
    # section_code on the closed `ocr-leak-in-section-body` code so the hangar
    # triage dashboard can target the figure-pairing gap directly.
    # Per WP-HANDBOOK-RE-EXTRACTION-V2 sub-phase 1D.
    ocr_leak_warning_records: list[tuple[str, str]] = []  # (section_code, message)
    if config.ocr_leak_detection_enabled:
        for body in bodies:
            spans = detect_ocr_leaks(body.body_md)
            if not spans:
                continue
            cleaned, warnings = elide_ocr_leaks(body.body_md, spans, section_code=body.node.code)
            body.body_md = cleaned
            body.char_count = len(cleaned)
            for w in warnings:
                ocr_leak_warning_records.append((w.section_code, w.message))
    figures_by_section: dict[str, list[FigureRecord]] = {}
    for fig in figures:
        figures_by_section.setdefault(fig.section_code, []).append(fig)
    tables_by_section: dict[str, list[TableRecord]] = {}
    for tab in tables:
        tables_by_section.setdefault(tab.section_code, []).append(tab)

    manifest_sections: list[dict[str, object]] = []
    sections_written = 0
    # Warnings for raw-HTML table fallbacks that survived in section bodies.
    # `_compose_markdown` records one per HTML-embedded table so the hangar
    # triage dashboard can target the conversion gaps.
    tablish_block_warnings: list[TableWarning] = []

    # Chapter-slug lookup: non-chapter nodes need their parent chapter's slug
    # to produce `<NN>-<chapter-slug>/` directory names matching what the
    # rename-generic-content-files migration put on disk.
    chapter_slug_by_code: dict[str, str] = {
        node.code: _title_slug(node.title) for node in outline_nodes if node.level == "chapter"
    }

    for node in outline_nodes:
        body = bodies_by_code.get(node.code)
        if body is None:
            # Outline node without matching body -- skip, this is a soft case
            # that would only happen if the section walk failed for one node.
            continue
        section_figs = figures_by_section.get(node.code, [])
        section_figs.sort(key=lambda f: f.ordinal)
        section_tables = tables_by_section.get(node.code, [])
        section_tables.sort(key=lambda t: t.ordinal)

        markdown_text = _compose_markdown(
            config, node, body, section_figs, section_tables, tablish_block_warnings
        )
        out_path = _resolve_output_path(root, node, chapter_slug_by_code)
        ensure_dir(out_path.parent)
        out_path.write_text(markdown_text, encoding="utf-8")

        content_hash = hashlib.sha256(markdown_text.encode("utf-8")).hexdigest()
        section_entry: dict[str, object] = {
            "level": node.level,
            "code": node.code,
            "ordinal": node.ordinal,
            "parent_code": node.parent_code,
            "title": node.title,
            "faa_page_start": body.faa_page_start,
            "faa_page_end": body.faa_page_end,
            "source_locator": _source_locator(config, node, body),
            "body_path": relative_to_repo(out_path),
            "content_hash": content_hash,
            "has_figures": bool(section_figs),
            "has_tables": bool(section_tables),
        }
        # Attach soft-fail metadata when supplied (front-matter capture or
        # empty-section policy). The sectionMetadataSchema is the closed
        # contract on the TS side; only `extraction_status` is consumed today.
        meta = section_metadata.get(node.code) if section_metadata else None
        if meta:
            section_entry["metadata"] = dict(meta)
        manifest_sections.append(section_entry)
        sections_written += 1

    manifest_figures = [
        {
            "id": f"fig-{f.section_code.replace('.', '-')}-{f.ordinal:02d}",
            "section_code": f.section_code,
            "ordinal": f.ordinal,
            "caption": f.caption,
            "asset_path": relative_to_repo(f.asset_path),
            "width": f.width,
            "height": f.height,
        }
        for f in figures
    ]

    manifest_warnings: list[dict[str, object]] = []
    for w in (*figure_warnings, *table_warnings, *tablish_block_warnings):
        if w.code not in ALLOWED_WARNING_CODES:
            # Hard-fail loudly: an unrecognized code means the emitter and
            # the validator drifted. Add the code to ALLOWED_WARNING_CODES
            # AND to HANDBOOK_MANIFEST_WARNING_CODES on the TS side together.
            raise ValueError(
                f"normalize.write_outputs: unknown warning code {w.code!r} from "
                f"figures/tables emitter -- add to ALLOWED_WARNING_CODES in "
                f"normalize.py AND HANDBOOK_MANIFEST_WARNING_CODES in "
                f"libs/bc/study/src/manifest-validation.ts."
            )
        manifest_warnings.append(
            {
                "id": compute_warning_id(w.code, w.section_code, w.message),
                "code": w.code,
                "section_code": w.section_code,
                "message": w.message,
            }
        )
    if extra_warnings:
        # Map structured warning prefixes from the section-strategy modules to
        # the manifest schema's enumerated codes. Anything not recognized
        # falls back to `section-strategy` (the catch-all for parser
        # instrumentation messages without a more specific class).
        for msg in extra_warnings:
            prefix = msg.split(":", 1)[0].strip() if ":" in msg else ""
            code = prefix if prefix in ALLOWED_WARNING_CODES else "section-strategy"
            manifest_warnings.append(
                {
                    "id": compute_warning_id(code, None, msg),
                    "code": code,
                    "section_code": None,
                    "message": msg,
                }
            )
    # OCR-leak warnings: section_code is meaningful (the row whose body
    # carried the elided run), so they bypass the extra_warnings lane and
    # land directly with their section_code intact.
    for section_code, message in ocr_leak_warning_records:
        manifest_warnings.append(
            {
                "id": compute_warning_id("ocr-leak-in-section-body", section_code, message),
                "code": "ocr-leak-in-section-body",
                "section_code": section_code,
                "message": message,
            }
        )

    manifest: dict[str, object] = {
        "document_slug": config.document_slug,
        "edition": config.edition,
        "kind": config.kind,
        "title": config.title,
        "publisher": config.publisher,
        "source_url": fetch_result.url,
        "source_checksum": fetch_result.sha256,
        "fetched_at": fetch_result.fetched_at,
        "subjects": list(config.subjects),
        # `primary_cert` is the YAML-driven library-by-cert placement.
        # Always include the key so the manifest shape is uniform across
        # handbooks; null = cert-agnostic. Mirrors the optional/nullable
        # field on `sectionTreeManifestSchema`.
        "primary_cert": config.primary_cert,
        "sections": manifest_sections,
        "figures": manifest_figures,
        "warnings": manifest_warnings,
    }
    if extraction_metadata:
        manifest["extraction"] = extraction_metadata

    manifest_path = root / "manifest.json"
    manifest_text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    manifest_path.write_text(manifest_text, encoding="utf-8")

    # Sibling `warnings.json` -- the normalized triage-input file the hangar
    # warning-triage dashboard reads (WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase
    # 1A). Written deterministically: warnings sorted by `(code, section_code,
    # id)` so re-runs of the same extraction produce a byte-identical file
    # when nothing changed. The triage state file
    # (`validation/.../warnings-triage.json`) is keyed on `id`, so the order
    # in this file is purely for diff readability.
    manifest_sha256 = hashlib.sha256(manifest_text.encode("utf-8")).hexdigest()
    sorted_warnings = sorted(
        manifest_warnings,
        key=lambda w: (
            str(w.get("code", "")),
            str(w.get("section_code") or ""),
            str(w.get("id", "")),
        ),
    )
    warnings_payload: dict[str, object] = {
        "schema_version": WARNINGS_FILE_SCHEMA_VERSION,
        "document_slug": config.document_slug,
        "edition": config.edition,
        "manifest_sha256": manifest_sha256,
        "generated_at": _dt.datetime.now(tz=_dt.UTC).isoformat(),
        "warnings": sorted_warnings,
    }
    warnings_path = root / "warnings.json"
    warnings_path.write_text(
        json.dumps(warnings_payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return WriteSummary(
        sections_written=sections_written,
        figures_written=len(figures),
        tables_written=len(tables),
        warnings=len(manifest_warnings),
        manifest_path=manifest_path,
        warnings_path=warnings_path,
    )


def _resolve_output_path(
    root: Path,
    node: OutlineNode,
    chapter_slug_by_code: dict[str, str],
) -> Path:
    """Compute the on-disk path per the rename-generic-content-files convention.

    Chapter overview: `<root>/<NN>-<chapter-slug>/00-<chapter-slug>.md`.
    Section / subsection: `<root>/<NN>-<chapter-slug>/<MM[-PP]>-<title-slug>.md`.
    Front-matter: `<root>/front-matter/<NN>-<title-slug>.md` (peer to chapter
    dirs, not nested under one). The flat layout matches
    `front_matter_body_relpath_under_edition` in `ingest/front_matter.py`.

    The chapter slug is looked up from `chapter_slug_by_code`, keyed on the
    bare chapter code (`'1'`, not `'01'`). Falls back to `'section'` only if
    a non-chapter node has no recorded parent chapter (defensive; outline
    builder guarantees one).
    """
    if node.level == "front-matter":
        # Ordinal is 0-indexed per FrontMatterSection contract; pad to 2.
        title_slug = _title_slug(node.title)
        return root / "front-matter" / f"{node.ordinal:02d}-{title_slug}.md"
    code_parts = node.code.split(".")
    chapter_code = code_parts[0]
    chapter = chapter_code.zfill(2)
    chapter_slug = chapter_slug_by_code.get(chapter_code, "section")
    chapter_dir_name = f"{chapter}-{chapter_slug}"
    if node.level == "chapter":
        return root / chapter_dir_name / f"00-{chapter_slug}.md"
    section_filename_parts = code_parts[1:]
    file_slug = "-".join(p.zfill(2) for p in section_filename_parts)
    title_slug = _title_slug(node.title)
    return root / chapter_dir_name / f"{file_slug}-{title_slug}.md"


def _source_locator(config: HandbookConfig, node: OutlineNode, body: SectionBody) -> str:
    """Compose the canonical citation string for display.

    The FAA page reference is rendered without a `p.`/`pp.` prefix because
    the surrounding context already implies "this is a page number" and
    the prefix interferes with column alignment in the chapter / section
    list views. Format: `PHAK Ch 12 §9 (12-7)` or `PHAK Ch 12 (12-1..12-26)`.

    Front-matter sections sit outside the chapter ordinal namespace; their
    citation reads `PHAK Front Matter -- Cover` so the chapter-list view
    doesn't show `Ch 0 §1` for the cover page.
    """
    if node.level == "front-matter":
        return f"{config.document_slug.upper()} Front Matter -- {node.title}"
    code_parts = node.code.split(".")
    pieces: list[str] = [config.document_slug.upper()]
    pieces.append(f"Ch {code_parts[0]}")
    if len(code_parts) >= 2:
        pieces.append(f"§{code_parts[1]}")
    if len(code_parts) >= 3:
        pieces.append(f"({code_parts[2]})")
    if body.faa_page_start is not None:
        if body.faa_page_end and body.faa_page_end != body.faa_page_start:
            pieces.append(f"({body.faa_page_start}..{body.faa_page_end})")
        else:
            pieces.append(f"({body.faa_page_start})")
    return " ".join(pieces)


def _strip_cover_residue(body_md: str, chapter_title: str, max_lines: int) -> str:
    """Drop chapter-cover boilerplate from a chapter's body markdown.

    Two FAA cover-page styles bleed into the chapter overview body:

    - **PHAK style** -- chapter title repeated, a `Chapter N` sentinel, and
      an `Introduction` header before the first body paragraph.
    - **AFH 3C style** -- a banner ``"Airplane Flying Handbook (FAA-H-8083-3C)"``,
      a ``"Chapter N: Title"`` sentinel, and `Introduction`.

    We walk the leading lines and drop anything that matches:

    - the chapter title (case-insensitive, fuzzy on whitespace)
    - any line of ``Chapter \\d+`` or ``Chapter \\d+: Anything``
    - the literal `Introduction`
    - the handbook's full-name banner (anything containing ``Handbook``
      followed by an FAA document number)

    until we hit the first body line, defined as: a line of length > 80,
    OR a line whose first non-whitespace character is lowercase. We cap
    the strip window at `max_lines` so a malformed chapter never eats a
    paragraph.
    """
    lines = body_md.splitlines()
    if not lines:
        return body_md
    norm_title = " ".join(chapter_title.lower().split())
    chapter_re = re.compile(r"^Chapter\s+\d+(\s*[:,—–-].*)?\s*$", re.IGNORECASE)
    # Numeric prefix that some bookmark-driven handbooks emit at the top
    # of the chapter body (e.g. AvWX 28B "5 Heat and Temperature").
    code_prefix_re = re.compile(r"^\d+(?:\.\d+)*\s+\S")
    intro_literal = re.compile(r"^introduction\s*$", re.IGNORECASE)
    handbook_banner_re = re.compile(r"\bHandbook\b.*\bFAA-H-\d", re.IGNORECASE)
    keep_idx = 0
    for i, raw in enumerate(lines[:max_lines]):
        line = raw.strip()
        if not line:
            keep_idx = i + 1
            continue
        # First body paragraph: long line, OR starts with lowercase, OR ends
        # with sentence punctuation -- treat as content, stop stripping.
        first_char = line.lstrip()[:1]
        if len(line) > 80 or (first_char and first_char.islower()):
            break
        norm = " ".join(line.lower().split())
        # Bookmark-style "5 Heat and Temperature" leading chapter line:
        # accept when the trailing words case-insensitively match the
        # chapter title.
        if code_prefix_re.match(line):
            tail = line.split(None, 1)[1] if " " in line else ""
            tail_norm = " ".join(tail.lower().split())
            if tail_norm == norm_title or tail_norm in norm_title:
                keep_idx = i + 1
                continue
        if (
            norm == norm_title
            or norm in norm_title
            or chapter_re.match(line)
            or intro_literal.match(line)
            or handbook_banner_re.search(line)
        ):
            keep_idx = i + 1
            continue
        # Anything else (an unexpected residue line) -- bail out.
        break
    if keep_idx == 0:
        return body_md
    return "\n".join(lines[keep_idx:]).lstrip("\n")


_TITLE_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _title_slug(title: str) -> str:
    slug = _TITLE_SLUG_PATTERN.sub("-", title.lower()).strip("-")
    return (slug or "section")[:48]


def _compose_markdown(
    config: HandbookConfig,
    node: OutlineNode,
    body: SectionBody,
    figures: list[FigureRecord],
    tables: list[TableRecord],
    tablish_block_warnings: list[TableWarning],
) -> str:
    """Compose one section's markdown body.

    `tablish_block_warnings` is appended-to (caller-owned list) every time a
    table falls back to the raw-HTML embed because conversion failed -- this
    is the `tablish-block-not-converted` signal the WP-HANDBOOK-RE-EXTRACTION-V2
    success criterion measures (every raw HTML table block in section markdown
    counts as a fixable warning).
    """
    code_parts = node.code.split(".")
    frontmatter: dict[str, object] = {
        "handbook": config.document_slug,
        "edition": config.edition,
        "chapter_number": int(code_parts[0]),
        "section_title": node.title,
        "faa_pages": _faa_pages_str(body.faa_page_start, body.faa_page_end),
    }
    if len(code_parts) >= 2:
        frontmatter["section_number"] = int(code_parts[1])
    if len(code_parts) >= 3:
        frontmatter["subsection_number"] = int(code_parts[2])
    if config.source_url:
        frontmatter["source_url"] = config.source_url

    fm_yaml = yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True).rstrip()

    lines: list[str] = ["---", fm_yaml, "---", "", f"# {node.title}", ""]
    if body.body_md:
        lines.append(body.body_md)
        lines.append("")
    for fig in figures:
        rel = relative_to_repo(fig.asset_path)
        # Render figures inline below body. Caption is the alt text.
        lines.append(f"![{fig.caption}](/{rel})")
        lines.append("")
    for tab in tables:
        rel = relative_to_repo(tab.asset_path)
        if tab.markdown_text:
            # Simple table: inline markdown table with a one-line "open
            # original" link to the standalone HTML for fidelity-fallback
            # access through the reader's `/handbook-asset/[...path]` route.
            lines.append(tab.markdown_text)
            lines.append("")
            lines.append(f'<a class="handbook-table-source" href="/{rel}">Open original</a>')
            lines.append("")
        else:
            # Complex table: embed the standalone HTML inline so the reader
            # surfaces the printed shape verbatim. Record a
            # `tablish-block-not-converted` warning so the hangar dashboard
            # can target the table for manual review.
            tablish_block_warnings.append(
                TableWarning(
                    code='tablish-block-not-converted',
                    section_code=node.code,
                    message=(
                        f"Table {tab.ordinal} in §{node.code} kept as raw HTML embed: "
                        f"{tab.complexity_reason or 'conversion declined'}."
                    ),
                )
            )
            lines.append(f'<div class="handbook-table" data-source="/{rel}">')
            lines.append(tab.asset_path.read_text(encoding="utf-8"))
            lines.append("</div>")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def _faa_pages_str(start: str | None, end: str | None) -> str:
    """Format the YAML frontmatter `faa_pages` value.

    Input is the printed FAA page reference (e.g. `"12-7"`) for both ends.
    Empty string when unknown; single-page when start == end (or end is
    None); range form `<start>..<end>` otherwise.
    """
    if start is None:
        return ""
    if end is None or end == start:
        return start
    return f"{start}..{end}"
