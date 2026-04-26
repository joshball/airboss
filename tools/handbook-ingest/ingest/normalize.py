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
) -> WriteSummary:
    root = ensure_dir(edition_root(config.document_slug, config.edition))

    bodies_by_code = {b.node.code: b for b in bodies}
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

    manifest_warnings = [
        {"code": w.code, "section_code": w.section_code, "message": w.message}
        for w in (*figure_warnings, *table_warnings)
    ]

    manifest = {
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
    code_parts = node.code.split(".")
    pieces: list[str] = [config.document_slug.upper()]
    pieces.append(f"Ch {code_parts[0]}")
    if len(code_parts) >= 2:
        pieces.append(f"§{code_parts[1]}")
    if len(code_parts) >= 3:
        pieces.append(f"({code_parts[2]})")
    if body.faa_page_start is not None:
        if body.faa_page_end and body.faa_page_end != body.faa_page_start:
            pieces.append(f"(pp. {body.faa_page_start}..{body.faa_page_end})")
        else:
            pieces.append(f"(p. {body.faa_page_start})")
    return " ".join(pieces)


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


def _faa_pages_str(start: int | None, end: int | None) -> str:
    if start is None:
        return ""
    if end is None or end == start:
        return str(start)
    return f"{start}..{end}"
