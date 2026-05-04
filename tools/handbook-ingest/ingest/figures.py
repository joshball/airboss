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


@dataclass
class _CaptionLoc:
    """Caption + its position on the page (top-y of the caption text bbox)."""

    page_num: int
    caption: str
    top_y: float  # pdf coordinate (top edge of the caption text)


@dataclass
class _ImageLoc:
    """Image + its position on the page. `top_y` is the top edge of the image rect."""

    page_num: int
    idx: int  # index within page.get_images(full=True)
    png_bytes: bytes
    width: int
    height: int
    top_y: float
    bottom_y: float


def _extract_for_node(
    doc: fitz.Document,
    node: OutlineNode,
    pattern: re.Pattern[str],
    figures_dir: Path,
) -> tuple[list[FigureRecord], list[FigureWarning]]:
    records: list[FigureRecord] = []
    warnings: list[FigureWarning] = []

    # 1. Find every figure caption across the section's pages, with position.
    captions: list[_CaptionLoc] = []
    for page_num in range(node.page_start - 1, node.page_end):
        if page_num >= doc.page_count:
            break
        page = doc.load_page(page_num)
        captions.extend(_find_captions_on_page(page, page_num, pattern))

    # 2. Walk page images, capturing position so geometric pairing can run.
    images_by_page: dict[int, list[_ImageLoc]] = {}
    for page_num in range(node.page_start - 1, node.page_end):
        if page_num >= doc.page_count:
            break
        page = doc.load_page(page_num)
        page_images = _extract_images_on_page(doc, page, page_num)
        if page_images:
            images_by_page[page_num] = page_images

    # 3. Pair captions with images. Three-tier strategy:
    #    a. Same page, geometric proximity: caption is usually directly above
    #       or below its figure. Pick the unused image on the same page whose
    #       vertical-edge-to-edge distance to the caption is smallest. This
    #       fixes the encounter-order failure mode where images and captions
    #       are interleaved on a multi-figure page.
    #    b. Prior page: figure on the page that came before its caption (FAA
    #       handbooks frequently flow a figure across a page break with the
    #       caption on the next page).
    #    c. Next page: figure paginated after its caption (less common but
    #       happens in FAA AC documents). This is the WIDER-RECT retry the
    #       WP spec calls for.
    used_image_keys: set[tuple[int, int]] = set()
    ordinal = 0
    for cap in captions:
        chosen = _pair_caption_with_image(cap, images_by_page, used_image_keys)
        if chosen is None:
            warnings.append(
                FigureWarning(
                    code="caption-without-figure",
                    section_code=node.code,
                    message=f"Caption `{cap.caption[:80]}` on page {cap.page_num + 1} had no paired image.",
                )
            )
            continue
        used_image_keys.add((chosen.page_num, chosen.idx))
        img = Image.open(io.BytesIO(chosen.png_bytes))
        slug = _figure_slug(cap.caption)
        filename = f"fig-{node.code.replace('.', '-')}-{ordinal:02d}-{slug}.png"
        asset_path = figures_dir / filename
        img.save(asset_path, format="PNG", optimize=True)
        records.append(
            FigureRecord(
                section_code=node.code,
                ordinal=ordinal,
                caption=cap.caption,
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


def _find_captions_on_page(
    page: fitz.Page,
    page_num: int,
    pattern: re.Pattern[str],
) -> list[_CaptionLoc]:
    """Return one `_CaptionLoc` per `Figure N-N.` match found on the page."""
    out: list[_CaptionLoc] = []
    text = page.get_text("text")
    if not pattern.search(text):
        return out

    # `dict` mode gives us the bbox per text block so we can know where the
    # caption sits on the page. Fall back to the bare-text path when blocks
    # aren't available.
    blocks = page.get_text("dict").get("blocks", [])
    for block in blocks:
        for line in block.get("lines", []):
            line_text = "".join(span.get("text", "") for span in line.get("spans", []))
            match = pattern.search(line_text)
            if not match:
                continue
            # Line bbox is (x0, y0, x1, y1) in PDF coords.
            bbox = line.get("bbox")
            top_y = float(bbox[1]) if bbox else 0.0
            # Stitch full caption from this line + following lines until blank.
            caption = _stitch_caption(blocks, block, line)
            out.append(_CaptionLoc(page_num=page_num, caption=caption, top_y=top_y))
    return out


def _stitch_caption(
    blocks: list[dict],  # type: ignore[type-arg]
    start_block: dict,  # type: ignore[type-arg]
    start_line: dict,  # type: ignore[type-arg]
) -> str:
    """Stitch a caption by collecting the matched line plus continuation lines.

    Continuation = subsequent line in the same block whose top-y is within
    a normal line-height of the previous line. Stops on the first paragraph
    break or 320-char cap to mirror the prior text-mode behavior.
    """
    text = "".join(span.get("text", "") for span in start_line.get("spans", []))
    started = False
    last_y: float = float(start_line.get("bbox", [0, 0, 0, 0])[3])
    for block in blocks:
        if block is start_block:
            for line in block.get("lines", []):
                if line is start_line:
                    started = True
                    continue
                if not started:
                    continue
                line_text = "".join(span.get("text", "") for span in line.get("spans", []))
                line_top = float(line.get("bbox", [0, 0, 0, 0])[1])
                # Hard stop on a clearly new paragraph (gap > ~24pt).
                if line_top - last_y > 24:
                    break
                text = f"{text} {line_text.strip()}"
                last_y = float(line.get("bbox", [0, 0, 0, 0])[3])
                if len(text) >= 320:
                    break
    return text.strip()[:320]


def _extract_images_on_page(
    doc: fitz.Document,
    page: fitz.Page,
    page_num: int,
) -> list[_ImageLoc]:
    """Pull every embedded raster on the page that meets size threshold,
    along with its position (top/bottom y on the page)."""
    out: list[_ImageLoc] = []
    page_height = page.rect.height
    for idx, img_meta in enumerate(page.get_images(full=True)):
        xref = img_meta[0]
        try:
            pix = fitz.Pixmap(doc, xref)
            if pix.colorspace and pix.colorspace.n > 4:
                pix = fitz.Pixmap(fitz.csRGB, pix)
            if pix.width < 64 or pix.height < 64:
                continue
            png_bytes = pix.tobytes("png")
        except Exception:  # noqa: BLE001 - PDF embedded images are noisy.
            continue
        # `page.get_image_rects(xref)` (if available) gives the on-page rect.
        # Fall back to the page-bottom hint when the API isn't present (older
        # PyMuPDF) -- pairs to the nearest caption regardless of geometry.
        rect_iter = page.get_image_rects(xref) if hasattr(page, "get_image_rects") else []
        if rect_iter:
            r = rect_iter[0]
            top_y, bottom_y = float(r.y0), float(r.y1)
        else:
            top_y, bottom_y = 0.0, page_height
        out.append(
            _ImageLoc(
                page_num=page_num,
                idx=idx,
                png_bytes=png_bytes,
                width=pix.width,
                height=pix.height,
                top_y=top_y,
                bottom_y=bottom_y,
            )
        )
    return out


def _pair_caption_with_image(
    cap: _CaptionLoc,
    images_by_page: dict[int, list[_ImageLoc]],
    used: set[tuple[int, int]],
) -> _ImageLoc | None:
    """Return the best unused image to pair with `cap`, or None.

    Tier 1: same page, geometric proximity (smallest vertical edge-to-edge
            distance to the caption). Captions usually sit just above or
            just below their figure.
    Tier 2: prior page, in encounter order.
    Tier 3 (wider-rect retry): next page, in encounter order. FAA AC docs
            sometimes paginate a figure after its caption.
    """
    # Tier 1 -- same-page geometric.
    same_page = images_by_page.get(cap.page_num, [])
    candidates = [img for img in same_page if (img.page_num, img.idx) not in used]
    if candidates:
        return min(candidates, key=lambda img: _vertical_distance(cap.top_y, img))

    # Tier 2 -- prior page, encounter order.
    prior_page = images_by_page.get(cap.page_num - 1, [])
    for img in prior_page:
        if (img.page_num, img.idx) not in used:
            return img

    # Tier 3 -- next page, encounter order (wider-rect retry).
    next_page = images_by_page.get(cap.page_num + 1, [])
    for img in next_page:
        if (img.page_num, img.idx) not in used:
            return img

    return None


def _vertical_distance(caption_top_y: float, img: _ImageLoc) -> float:
    """Edge-to-edge vertical distance between caption baseline and image rect.

    A caption directly above its figure has distance ~0 (caption.top_y close
    to image.top_y). A caption directly below the figure has distance equal
    to the gap between the image bottom and the caption top. The pairing
    minimizes whichever distance is smaller -- so figures whose caption sits
    *above* them still pair correctly even when the page also has a different
    figure below the caption.
    """
    if caption_top_y >= img.top_y and caption_top_y <= img.bottom_y:
        # Caption falls inside the image rect (rare, but a legitimate signal).
        return 0.0
    above = abs(caption_top_y - img.top_y)
    below = abs(caption_top_y - img.bottom_y)
    return min(above, below)


_SLUG_PATTERN = re.compile(r"[^a-z0-9]+")


def _figure_slug(caption: str) -> str:
    # Take the descriptive tail after "Figure N-N. " for the filename slug.
    after_dot = caption.split(".", 1)[1] if "." in caption else caption
    slug = _SLUG_PATTERN.sub("-", after_dot.lower()).strip("-")
    return (slug or "untitled")[:48]
