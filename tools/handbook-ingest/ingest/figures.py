"""Figure extraction.

Iterates pages within each section's page range, extracts embedded raster
images, locates "Figure N-N." caption strings, and binds caption to image.

Output:
    FigureRecord(
        section_code: str,
        ordinal: int,
        caption: str,
        asset_path: Path,
        width: int,
        height: int,
    )

Captions without a paired image (and images without a paired caption) are
recorded as warnings in the manifest; the affected section markdown is still
written but with the inline figure missing.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path

import fitz
from PIL import Image

from .outline import OutlineNode
from .paths import edition_root, ensure_dir


@dataclass
class FigureRecord:
    section_code: str
    ordinal: int
    caption: str
    asset_path: Path
    width: int
    height: int


@dataclass
class FigureWarning:
    code: str  # "figure-without-caption" | "caption-without-figure"
    section_code: str
    message: str


def extract_figures(
    pdf_path: Path,
    nodes: list[OutlineNode],
    document_slug: str,
    edition: str,
    *,
    figure_pattern: str = r"Figure (\d+)-(\d+)\.",
) -> tuple[list[FigureRecord], list[FigureWarning]]:
    """Extract every figure in the page ranges covered by `nodes`."""
    figures_dir = ensure_dir(edition_root(document_slug, edition) / "figures")
    pattern = re.compile(figure_pattern)
    records: list[FigureRecord] = []
    warnings: list[FigureWarning] = []

    with fitz.open(pdf_path) as doc:
        for node in nodes:
            section_records, section_warnings = _extract_for_node(doc, node, pattern, figures_dir)
            records.extend(section_records)
            warnings.extend(section_warnings)

    return records, warnings


def _extract_for_node(
    doc: fitz.Document,
    node: OutlineNode,
    pattern: re.Pattern[str],
    figures_dir: Path,
) -> tuple[list[FigureRecord], list[FigureWarning]]:
    records: list[FigureRecord] = []
    warnings: list[FigureWarning] = []
    captions: list[tuple[int, str]] = []  # (page_num, caption_text)

    # 1. Find every figure caption across the section's pages.
    for page_num in range(node.page_start - 1, node.page_end):
        if page_num >= doc.page_count:
            break
        page = doc.load_page(page_num)
        text = page.get_text("text")
        for match in pattern.finditer(text):
            caption_start = match.start()
            # Capture the rest of the line (or until the next blank line) as
            # the caption body.
            tail = text[caption_start : caption_start + 320]
            first_break = tail.find("\n\n")
            caption = tail[:first_break].strip() if first_break >= 0 else tail.strip()
            captions.append((page_num, caption))

    # 2. Walk page images, paired in order with captions on the same page.
    images_by_page: dict[int, list[bytes]] = {}
    for page_num in range(node.page_start - 1, node.page_end):
        if page_num >= doc.page_count:
            break
        page = doc.load_page(page_num)
        page_images: list[bytes] = []
        for img_meta in page.get_images(full=True):
            xref = img_meta[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.colorspace and pix.colorspace.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                if pix.width < 64 or pix.height < 64:
                    continue
                page_images.append(pix.tobytes("png"))
            except Exception:  # noqa: BLE001 - PDF embedded images are noisy.
                continue
        if page_images:
            images_by_page[page_num] = page_images

    # 3. Pair captions with images on the same page (then on the prior page).
    used_image_keys: set[tuple[int, int]] = set()
    ordinal = 0
    for page_num, caption in captions:
        candidate_pages = [page_num, page_num - 1]
        chosen: tuple[int, int] | None = None
        for cp in candidate_pages:
            if cp not in images_by_page:
                continue
            for idx in range(len(images_by_page[cp])):
                if (cp, idx) not in used_image_keys:
                    chosen = (cp, idx)
                    break
            if chosen is not None:
                break
        if chosen is None:
            warnings.append(
                FigureWarning(
                    code="caption-without-figure",
                    section_code=node.code,
                    message=f"Caption `{caption[:80]}` on page {page_num + 1} had no paired image.",
                )
            )
            continue
        used_image_keys.add(chosen)
        cp, idx = chosen
        png_bytes = images_by_page[cp][idx]
        img = Image.open(io.BytesIO(png_bytes))
        slug = _figure_slug(caption)
        filename = f"fig-{node.code.replace('.', '-')}-{ordinal:02d}-{slug}.png"
        asset_path = figures_dir / filename
        img.save(asset_path, format="PNG", optimize=True)
        records.append(
            FigureRecord(
                section_code=node.code,
                ordinal=ordinal,
                caption=caption,
                asset_path=asset_path,
                width=img.width,
                height=img.height,
            )
        )
        ordinal += 1

    # 4. Surface unused images as "figure-without-caption" warnings.
    for cp, page_imgs in images_by_page.items():
        for idx in range(len(page_imgs)):
            if (cp, idx) in used_image_keys:
                continue
            warnings.append(
                FigureWarning(
                    code="figure-without-caption",
                    section_code=node.code,
                    message=f"Image on page {cp + 1} (index {idx}) had no paired caption.",
                )
            )

    return records, warnings


_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _figure_slug(caption: str) -> str:
    # Take the descriptive tail after "Figure N-N. " for the filename slug.
    after_dot = caption.split(".", 1)[1] if "." in caption else caption
    slug = _SLUG_PATTERN.sub("-", after_dot.lower()).strip("-")
    return (slug or "untitled")[:48]
