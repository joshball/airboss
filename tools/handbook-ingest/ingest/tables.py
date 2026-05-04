"""Table extraction.

PyMuPDF >= 1.23 exposes a `page.find_tables()` API that returns
`fitz.table.Table` objects with row / column data. We export each detected
table to two artifacts:

1. **Standalone HTML** in `<doc>/<edition>/tables/` -- the canonical fidelity
   render. The reader's "open original" link surfaces it via
   `/handbook-asset/[...path]`.
2. **Inline markdown** when the table is "simple" (single thead row, no
   merged cells, no blank padding). `normalize.write_outputs` reads
   `TableRecord.markdown_text` and embeds it directly in the section body.

Cross-page tables aren't merged in v1; merging is a Phase 7 follow-up that
the spec records as a soft warning when it fails.

WP-HANDBOOK-RE-EXTRACTION-V2 Sub-phase 1B:

- Convert simple HTML tables (1 header row, no rowspans/colspans) to clean
  markdown tables. Caption renders as a markdown line above the table
  prefixed with `**Table N-M.**`.
- For complex tables (`None` cells in non-edge positions, shape-imbalance,
  rowspan/colspan derivation uncertain): emit `table-cell-merge-ambiguity`
  warning and keep the standalone HTML as the canonical render. The reader's
  "open original" link bridges the gap.
- Drop empty `<th></th>` / `<td></td>` cells that are pure column-padding
  artifacts (single-cell rows, all-empty rows, leading/trailing empty cols).
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
    # When the table converted cleanly to a markdown table, this carries the
    # rendered markdown (caption + table grid). `normalize.write_outputs`
    # embeds it inline in the section body. `None` means the converter
    # rejected the table as too complex; the section body keeps the
    # standalone HTML embed (current behavior) and a
    # `tablish-block-not-converted` warning fires.
    markdown_text: str | None = None
    # Reason the converter rejected the table, used for warning messages.
    # Populated only when `markdown_text is None`.
    complexity_reason: str | None = None


@dataclass
class TableWarning:
    # "table-merge-failed" | "table-empty" | "table-cell-merge-ambiguity"
    # | "tablish-block-not-converted"
    code: str
    section_code: str
    message: str


# Public conversion-failure reasons. Stable strings the warning messages and
# tests can match against.
class _ComplexityReason:
    INCONSISTENT_COLUMNS = 'inconsistent column counts'
    EMPTY_HEADER = 'header row is empty after padding strip'
    INTERIOR_NONE_CELL = 'interior None cell suggests merged span'
    INTERIOR_EMPTY_CELL = 'interior empty cell after strip'
    ZERO_ROWS = 'no body rows after padding strip'


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
                    cleaned = _drop_empty_padding(data)
                    html = _to_html(cleaned, caption)
                    slug = _table_slug(caption)
                    filename = f"tbl-{node.code.replace('.', '-')}-{ordinal:02d}-{slug}.html"
                    asset_path = tables_dir / filename
                    asset_path.write_text(html)

                    markdown_text, complexity_reason = convert_to_markdown_table(
                        cleaned, caption
                    )
                    if markdown_text is None and complexity_reason is not None:
                        # Track the ambiguity so the reader can surface it
                        # alongside the embedded HTML fallback.
                        warnings.append(
                            TableWarning(
                                code="table-cell-merge-ambiguity",
                                section_code=node.code,
                                message=(
                                    f"Table on page {page_num + 1} kept as HTML fallback: "
                                    f"{complexity_reason}."
                                ),
                            )
                        )

                    records.append(
                        TableRecord(
                            section_code=node.code,
                            ordinal=ordinal,
                            caption=caption,
                            asset_path=asset_path,
                            rows=len(cleaned),
                            columns=max(len(r) for r in cleaned) if cleaned else 0,
                            markdown_text=markdown_text,
                            complexity_reason=complexity_reason,
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


def _drop_empty_padding(rows: list[list[str | None]]) -> list[list[str | None]]:
    """Strip pure column-padding artifacts from a `find_tables` extraction.

    Three shapes count as padding noise the converter never wants to render:

    1. **All-empty rows** -- every cell is None or empty after strip. PyMuPDF
       sometimes emits a trailing blank row when the table grid extends a
       row past the printed body. Drops these.
    2. **All-empty trailing columns** -- when a table's right edge has a
       column where every cell is None or empty, that column is a grid
       artifact (the find_tables grid extended past the printed cells).
       Drops them.
    3. **All-empty leading columns** -- a phantom gutter column some PDFs
       emit on the left side. Same treatment as trailing.

    Rows with at least one cell containing text are kept verbatim. Returns
    a new list (never mutates the input).
    """
    if not rows:
        return []
    # Drop all-empty rows.
    filtered_rows: list[list[str | None]] = []
    for row in rows:
        if any((cell or '').strip() for cell in row):
            filtered_rows.append(list(row))
    if not filtered_rows:
        return []
    # Normalize column count to the widest row.
    width = max(len(r) for r in filtered_rows)
    for row in filtered_rows:
        while len(row) < width:
            row.append('')
    # Drop all-empty trailing columns.
    while width > 0 and all(
        not (row[width - 1] or '').strip() for row in filtered_rows
    ):
        for row in filtered_rows:
            del row[width - 1]
        width -= 1
    # Drop all-empty leading columns (some PDFs prepend a phantom gutter col).
    while width > 0 and all(
        not (row[0] or '').strip() for row in filtered_rows
    ):
        for row in filtered_rows:
            del row[0]
        width -= 1
    return filtered_rows


def convert_to_markdown_table(
    rows: list[list[str | None]], caption: str
) -> tuple[str | None, str | None]:
    """Convert a cleaned table to a markdown table.

    Returns `(markdown_text, None)` when conversion succeeded; `(None, reason)`
    when the table is too complex (caller emits a
    `table-cell-merge-ambiguity` warning and keeps the HTML fallback).

    Markdown table rules:

    - First row is treated as the header (PyMuPDF's `find_tables()` puts
      the column labels there).
    - Cell text has newlines replaced with `<br>` and pipes escaped (`\\|`).
    - Caption renders as `**Table N-M.** <description>` on the line above
      the table, matching the figure-caption convention.
    - Refuse to convert when the body has interior `None` cells (PyMuPDF
      uses None for merged-span continuations) or the column count is
      inconsistent across rows -- these signal the table has rowspans /
      colspans markdown can't represent without a renderer extension.
    """
    if not rows:
        return None, _ComplexityReason.ZERO_ROWS
    column_counts = {len(r) for r in rows}
    if len(column_counts) != 1:
        return None, _ComplexityReason.INCONSISTENT_COLUMNS
    width = next(iter(column_counts))
    if width == 0:
        return None, _ComplexityReason.ZERO_ROWS
    header, *body = rows
    # Header may have None entries when find_tables marks an empty grid
    # cell as a merged-span continuation. Markdown can't represent that;
    # bail to the HTML fallback.
    if any(cell is None for cell in header):
        return None, _ComplexityReason.INTERIOR_NONE_CELL
    if not any((cell or '').strip() for cell in header):
        return None, _ComplexityReason.EMPTY_HEADER
    if not body:
        return None, _ComplexityReason.ZERO_ROWS
    # Detect cell-merge ambiguity in the body: a `None` anywhere is
    # PyMuPDF's signal that this cell continues a rowspan from above.
    # Markdown tables can't express that without HTML escape hatches.
    for row in body:
        for cell in row:
            if cell is None:
                return None, _ComplexityReason.INTERIOR_NONE_CELL
    # Refuse if a body row has every cell empty (a structural ghost row
    # PyMuPDF emitted as separator). Treat as ambiguity.
    for row in body:
        if not any((c or '').strip() for c in row):
            return None, _ComplexityReason.INTERIOR_EMPTY_CELL

    lines: list[str] = []
    if caption:
        lines.append(_format_markdown_caption(caption))
        lines.append('')
    lines.append('| ' + ' | '.join(_md_escape(c or '') for c in header) + ' |')
    lines.append('|' + '|'.join([' --- '] * width) + '|')
    for row in body:
        lines.append('| ' + ' | '.join(_md_escape(c or '') for c in row) + ' |')
    return '\n'.join(lines), None


_TABLE_PREFIX_RE = re.compile(r'^(Table\s+\d+-\d+\.)\s*(.*)$', re.DOTALL)


def _format_markdown_caption(caption: str) -> str:
    """Format the caption line above a markdown table.

    Matches the figure-caption convention: bolded `**Table N-M.**` token
    followed by the description text. If the caption text doesn't carry the
    `Table N-M.` prefix (shouldn't happen given how `_nearest_caption` works
    but defended for safety), the whole caption is bolded.
    """
    # Collapse internal whitespace so the caption stays on one line.
    flat = ' '.join(caption.split())
    match = _TABLE_PREFIX_RE.match(flat)
    if match:
        prefix, body = match.group(1), match.group(2).strip()
        return f'**{prefix}** {body}' if body else f'**{prefix}**'
    return f'**{flat}**'


def _md_escape(text: str) -> str:
    """Escape characters that would corrupt a markdown table cell.

    `|` is the column separator, so escape it. Newlines become `<br>` so a
    multi-line cell stays in one row. `\\` is escaped to keep
    backslash-pipe literals from re-introducing column breaks via
    chain-escaping after rendering.
    """
    return (
        text.replace('\\', '\\\\')
        .replace('|', '\\|')
        .replace('\n', '<br>')
        .replace('\r', '')
        .strip()
    )


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
