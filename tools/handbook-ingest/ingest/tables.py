"""Table extraction.

PyMuPDF >= 1.23 exposes a `page.find_tables()` API that returns
`fitz.table.Table` objects with row / column data. We export each detected
table to HTML using a `<table><thead>` shape that the markdown renderer
embeds verbatim. Cross-page tables aren't merged in v1; merging is a Phase 7
follow-up that the spec records as a soft warning when it fails.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import fitz

from .outline import OutlineNode
from .paths import edition_root, ensure_dir


@dataclass
class TableRecord:
    section_code: str
    ordinal: int
    caption: str
    asset_path: Path
    rows: int
    columns: int


@dataclass
class TableWarning:
    code: str  # "table-merge-failed" | "table-empty"
    section_code: str
    message: str


def extract_tables(
    pdf_path: Path,
    nodes: list[OutlineNode],
    document_slug: str,
    edition: str,
    *,
    table_pattern: str = r"Table (\d+)-(\d+)\.",
) -> tuple[list[TableRecord], list[TableWarning]]:
    tables_dir = ensure_dir(edition_root(document_slug, edition) / "tables")
    caption_re = re.compile(table_pattern)
    records: list[TableRecord] = []
    warnings: list[TableWarning] = []

    with fitz.open(pdf_path) as doc:
        for node in nodes:
            ordinal = 0
            for page_num in range(node.page_start - 1, node.page_end):
                if page_num >= doc.page_count:
                    break
                page = doc.load_page(page_num)
                try:
                    detected = page.find_tables()
                except Exception:  # noqa: BLE001 - find_tables fails noisily on some PDFs.
                    continue
                tables_iter = detected.tables if hasattr(detected, "tables") else detected
                for table in tables_iter:
                    try:
                        data = table.extract()
                    except Exception:  # noqa: BLE001 - extract is similarly noisy.
                        continue
                    if not data or not any(any(cell for cell in row) for row in data):
                        warnings.append(
                            TableWarning(
                                code="table-empty",
                                section_code=node.code,
                                message=f"Empty table detected on page {page_num + 1}.",
                            )
                        )
                        continue
                    page_text = page.get_text("text")
                    caption = _nearest_caption(page_text, caption_re)
                    html = _to_html(data, caption)
                    slug = _table_slug(caption)
                    filename = f"tbl-{node.code.replace('.', '-')}-{ordinal:02d}-{slug}.html"
                    asset_path = tables_dir / filename
                    asset_path.write_text(html)
                    records.append(
                        TableRecord(
                            section_code=node.code,
                            ordinal=ordinal,
                            caption=caption,
                            asset_path=asset_path,
                            rows=len(data),
                            columns=max(len(r) for r in data),
                        )
                    )
                    ordinal += 1
    return records, warnings


def _nearest_caption(page_text: str, caption_re: re.Pattern[str]) -> str:
    match = caption_re.search(page_text)
    if not match:
        return ""
    tail = page_text[match.start() : match.start() + 200]
    first_break = tail.find("\n\n")
    return tail[:first_break].strip() if first_break >= 0 else tail.strip()


def _to_html(rows: list[list[str | None]], caption: str) -> str:
    if not rows:
        return ""
    header, *body = rows
    parts: list[str] = ["<table>"]
    if caption:
        parts.append(f"<caption>{_escape(caption)}</caption>")
    parts.append("<thead><tr>")
    for cell in header:
        parts.append(f"<th>{_escape(cell or '')}</th>")
    parts.append("</tr></thead>")
    parts.append("<tbody>")
    for row in body:
        parts.append("<tr>")
        for cell in row:
            parts.append(f"<td>{_escape(cell or '')}</td>")
        parts.append("</tr>")
    parts.append("</tbody></table>")
    return "".join(parts)


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _table_slug(caption: str) -> str:
    after_dot = caption.split(".", 1)[1] if "." in caption else caption
    slug = _SLUG_PATTERN.sub("-", after_dot.lower()).strip("-")
    return (slug or "untitled")[:48]
