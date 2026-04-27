"""Compose per-section markdown + emit the manifest.

After fetch + outline + sections + figures + tables run, this module is
responsible for:

1. Writing one markdown file per chapter / section / subsection at
   `handbooks/<doc>/<edition>/<chapter>/...`.
2. Emitting the per-edition `manifest.json` the seed reads in Phase 9.

Each markdown file carries YAML frontmatter matching
`handbookSectionFrontmatterSchema` in `libs/bc/study/src/handbook-validation.ts`.
The manifest matches `handbookManifestSchema`.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from .config_loader import HandbookConfig
from .fetch import FetchResult
from .figures import FigureRecord, FigureWarning
from .outline import OutlineNode
from .paths import edition_root, ensure_dir, relative_to_repo
from .sections import SectionBody
from .tables import TableRecord, TableWarning


@dataclass
class WriteSummary:
    sections_written: int
    figures_written: int
    tables_written: int
    warnings: int
    manifest_path: Path


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
    figures_by_section: dict[str, list[FigureRecord]] = {}
    for fig in figures:
        figures_by_section.setdefault(fig.section_code, []).append(fig)
    tables_by_section: dict[str, list[TableRecord]] = {}
    for tab in tables:
        tables_by_section.setdefault(tab.section_code, []).append(tab)

    manifest_sections: list[dict[str, object]] = []
    sections_written = 0

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

        markdown_text = _compose_markdown(config, node, body, section_figs, section_tables)
        out_path = _resolve_output_path(root, node)
        ensure_dir(out_path.parent)
        out_path.write_text(markdown_text, encoding="utf-8")

        content_hash = hashlib.sha256(markdown_text.encode("utf-8")).hexdigest()
        manifest_sections.append(
            {
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
        )
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

    manifest_warnings: list[dict[str, object]] = [
        {"code": w.code, "section_code": w.section_code, "message": w.message}
        for w in (*figure_warnings, *table_warnings)
    ]
    if extra_warnings:
        # Map structured warning prefixes from the section-strategy modules to
        # the manifest schema's enumerated codes. The schema now accepts
        # `toc`, `toc-verify`, `llm`, and `section-strategy`.
        allowed_codes = {
            "figure-without-caption",
            "caption-without-figure",
            "table-merge-failed",
            "table-empty",
            "cross-reference-unresolved",
            "toc",
            "toc-verify",
            "llm",
            "section-strategy",
            "page-label",
        }
        for msg in extra_warnings:
            prefix = msg.split(":", 1)[0].strip() if ":" in msg else ""
            code = prefix if prefix in allowed_codes else "section-strategy"
            manifest_warnings.append({"code": code, "section_code": None, "message": msg})

    manifest: dict[str, object] = {
        "document_slug": config.document_slug,
        "edition": config.edition,
        "kind": config.kind,
        "title": config.title,
        "publisher": config.publisher,
        "source_url": fetch_result.url,
        "source_checksum": fetch_result.sha256,
        "fetched_at": fetch_result.fetched_at,
        "sections": manifest_sections,
        "figures": manifest_figures,
        "warnings": manifest_warnings,
    }
    if extraction_metadata:
        manifest["extraction"] = extraction_metadata

    manifest_path = root / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    return WriteSummary(
        sections_written=sections_written,
        figures_written=len(figures),
        tables_written=len(tables),
        warnings=len(manifest_warnings),
        manifest_path=manifest_path,
    )


def _resolve_output_path(root: Path, node: OutlineNode) -> Path:
    """`<root>/<chapter>/index.md` for chapters; `<root>/<chapter>/<section>.md` for the rest."""
    code_parts = node.code.split(".")
    chapter = code_parts[0].zfill(2)
    if node.level == "chapter":
        return root / chapter / "index.md"
    section_filename_parts = code_parts[1:]
    file_slug = "-".join(p.zfill(2) for p in section_filename_parts)
    title_slug = _title_slug(node.title)
    return root / chapter / f"{file_slug}-{title_slug}.md"


def _source_locator(config: HandbookConfig, node: OutlineNode, body: SectionBody) -> str:
    """Compose the canonical citation string for display.

    The FAA page reference is rendered without a `p.`/`pp.` prefix because
    the surrounding context already implies "this is a page number" and
    the prefix interferes with column alignment in the chapter / section
    list views. Format: `PHAK Ch 12 §9 (12-7)` or `PHAK Ch 12 (12-1..12-26)`.
    """
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

    Two FAA cover-page styles bleed into the chapter index.md:

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
) -> str:
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
