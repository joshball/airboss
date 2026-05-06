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
    # 1-indexed PDF page where the caption was matched. Persisted so a
    # post-extraction re-scoping pass can re-attach the figure to the
    # deepest section whose page range covers the caption (the section
    # tree merge runs AFTER figure extraction; the chapter-level
    # ``section_code`` assigned at extraction time is overridden once
    # the deeper outline is available). ``None`` when extraction did
    # not record a page (callers using legacy paths or fixture data).
    caption_page_num: int | None = None


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
    figure_pattern: str = r"^\s*Figure (\d+)-(\d+)\.",
) -> tuple[list[FigureRecord], list[FigureWarning]]:
    """Extract every figure in the page ranges covered by `nodes`.

    The default ``figure_pattern`` anchors at the start of a line (with
    ``re.MULTILINE``). FAA caption headers always start their own line;
    sentence-internal references like "...as illustrated in Figure 3-4."
    sit mid-line and are correctly rejected. Per the figure-pairing WP
    spec (Mode A), this fixes the largest single class of false positives
    without losing real captions whose description starts with a
    digit / lowercase / glyph (e.g. "Figure 1-13. 45° procedure turn.").
    The optional ``\\s*`` tolerates PDF text-extraction quirks that emit
    a leading space before the caption.
    """
    figures_dir = ensure_dir(edition_root(document_slug, edition) / "figures")
    pattern = re.compile(figure_pattern, re.MULTILINE)
    records: list[FigureRecord] = []
    warnings: list[FigureWarning] = []

    # Compute the union of every section's page range. Images outside this
    # union are cover-page art, glossary illustrations, or other non-body
    # rasters that shouldn't surface as figure-pairing warnings (they
    # have no body section that could legitimately reference them). The
    # cross-section image dict still walks the whole document for the
    # pairing pass, but the orphan accounting trims to in-body pages.
    in_body_pages: set[int] = set()
    for node in nodes:
        for page_num in range(node.page_start - 1, node.page_end):
            in_body_pages.add(page_num)

    with fitz.open(pdf_path) as doc:
        # Build the doc-wide image dictionary ONCE. Per the figure-pairing
        # WP (Mode B / Fix 2): section page-ranges overlap and figures
        # frequently flow across the boundary between sections. The prior
        # implementation built this dict per-section, so an image extracted
        # under section A was invisible to section B's pairing pass even
        # though section B's caption resolved geometrically. The shared
        # ``used_image_keys`` set keeps a single image from pairing twice.
        images_by_page: dict[int, list[_ImageLoc]] = {}
        for page_num in range(doc.page_count):
            page = doc.load_page(page_num)
            page_images = _extract_images_on_page(doc, page, page_num)
            if page_images:
                images_by_page[page_num] = page_images

        used_image_keys: set[tuple[int, int]] = set()
        # Captions on overlap pages (a page that backs two sections,
        # common in handbooks where chapter intros and the first
        # sub-section share leading pages -- AvWX is the canonical
        # example) get walked once per claiming section. The first
        # section pairs the caption with its image; the second section
        # sees the same caption but the image is already consumed.
        # Track ``(page_num, rounded_top_y)`` so each physical caption
        # is only processed once, regardless of how many sections claim
        # the page.
        seen_caption_keys: set[tuple[int, int]] = set()
        # Track pages where at least one pairing succeeded. Composite
        # figures (one logical "Figure N-N" rendered as a multi-image
        # PDF page -- common in IAP plates, multi-panel charts) embed
        # many xref rasters, only one of which gets the caption. The
        # remaining images are sub-figures of the same composite, not
        # orphans, and shouldn't surface as warnings.
        pages_with_pairing: set[int] = set()
        for node in nodes:
            section_records, section_warnings = _extract_for_node(
                doc, node, pattern, figures_dir, images_by_page, used_image_keys, seen_caption_keys
            )
            records.extend(section_records)
            warnings.extend(section_warnings)
        for page_num, _idx in used_image_keys:
            pages_with_pairing.add(page_num)

        # Surface unused images as "figure-without-caption" warnings ONCE
        # at the document level. Per-section emission would double-count
        # images on overlap pages. Only count images on pages claimed by
        # at least one section -- cover / glossary / non-body images are
        # not expected to pair and shouldn't pollute the orphan count.
        #
        # Small images (32..63 px) only appear in the warning list when
        # they were close enough to a caption to pass the proximity gate
        # but lost the pairing race. Truly-decorative inline glyphs that
        # never came near a caption are not figure candidates and would
        # only be noise if surfaced. The original implementation also
        # silently dropped them via the 64-px floor; this preserves that
        # behavior while still rescuing legitimate symbol-legend figures.
        # Pre-compute, per page, the set of caption page_nums that the
        # regex matched (whether they paired or not). Pages with NO
        # caption match at all are chapter intros, "Part N:" cover
        # pages, glossary visuals, etc -- the embedded images on those
        # pages are decorative full-bleed art, not figure orphans.
        pages_with_caption_match: set[int] = {key[0] for key in seen_caption_keys}

        for cp, page_imgs in images_by_page.items():
            if cp not in in_body_pages:
                continue
            # If the page already had a successful caption pairing, the
            # remaining unpaired images are sub-figures of a composite
            # (one logical figure rendered as multiple PDF rasters).
            # These are not figure orphans; suppress them.
            if cp in pages_with_pairing:
                continue
            # If the page has no caption match at all, suppress all of
            # its image orphans. Chapter-cover and Part-divider pages
            # ship full-page decorative artwork that has no caption to
            # pair with by design; surfacing them inflates the orphan
            # count without identifying actionable bugs.
            if cp not in pages_with_caption_match:
                continue
            for idx, img in enumerate(page_imgs):
                if (cp, idx) in used_image_keys:
                    continue
                if _is_small(img):
                    continue
                warnings.append(
                    FigureWarning(
                        code="figure-without-caption",
                        section_code=_section_code_for_page(cp, nodes),
                        message=(
                            f"Image on page {cp + 1} (index {idx}, "
                            f"{img.width}x{img.height}) had no paired caption."
                        ),
                    )
                )

    return records, warnings


def _section_code_for_page(page_num: int, nodes: list[OutlineNode]) -> str:
    """Pick the deepest section whose page range covers ``page_num``.

    Falls back to the empty string when no section claims the page (cover
    pages, post-glossary appendices that aren't in the outline). The
    deepest match wins so an image on a sub-section page doesn't get
    blamed on the chapter root.
    """
    best_code = ""
    best_depth = -1
    for node in nodes:
        if node.page_start - 1 <= page_num < node.page_end:
            depth = node.code.count(".")
            if depth > best_depth:
                best_depth = depth
                best_code = node.code
    return best_code


@dataclass
class _CaptionLoc:
    """Caption + its position on the page (top-y of the caption text bbox)."""

    page_num: int
    caption: str
    top_y: float  # pdf coordinate (top edge of the caption text)


@dataclass
class _ImageLoc:
    """Image + its position on the page. `top_y` is the top edge of the image rect.

    PNG bytes are loaded lazily via :func:`_load_png_bytes` so we can keep
    the doc-wide ``images_by_page`` dict cheap (Mode B / Fix 2: a 500-page
    handbook would otherwise pin every embedded raster in memory for the
    whole pairing pass). The :attr:`xref` survives instead so the bytes
    can be resolved on demand once the pairing pass picks a winner.
    """

    page_num: int
    idx: int  # index within page.get_images(full=True)
    xref: int
    width: int
    height: int
    top_y: float
    bottom_y: float


def _extract_for_node(
    doc: fitz.Document,
    node: OutlineNode,
    pattern: re.Pattern[str],
    figures_dir: Path,
    images_by_page: dict[int, list[_ImageLoc]],
    used_image_keys: set[tuple[int, int]],
    seen_caption_keys: set[tuple[int, int]],
) -> tuple[list[FigureRecord], list[FigureWarning]]:
    records: list[FigureRecord] = []
    warnings: list[FigureWarning] = []

    # 1. Find every figure caption across the section's pages, with position.
    captions: list[_CaptionLoc] = []
    for page_num in range(node.page_start - 1, node.page_end):
        if page_num >= doc.page_count:
            break
        page = doc.load_page(page_num)
        for cap in _find_captions_on_page(page, page_num, pattern):
            # Round top_y to the nearest pdf-unit so floating-point
            # jitter across passes doesn't spoof the dedup gate.
            key = (cap.page_num, int(round(cap.top_y)))
            if key in seen_caption_keys:
                continue
            seen_caption_keys.add(key)
            captions.append(cap)

    # 2. Pair captions with images. Three-tier strategy:
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
    # Pre-compute, per page, the top-y of every caption on that page so
    # the Tier 4 page-region renderer can clip between consecutive
    # captions instead of always sweeping from the page header. Without
    # this, three vector-rendered figures on one page (PHAK 10.1 weight
    # and balance) would all render the SAME upper region.
    captions_by_page: dict[int, list[float]] = {}
    for c in captions:
        captions_by_page.setdefault(c.page_num, []).append(c.top_y)
    for page_caps in captions_by_page.values():
        page_caps.sort()

    ordinal = 0
    for cap in captions:
        chosen = _pair_caption_with_image(cap, images_by_page, used_image_keys)
        png_bytes: bytes | None = None
        if chosen is not None:
            png_bytes = _load_png_bytes(doc, chosen.xref)
            if png_bytes is None:
                # Pixmap could not be materialized at pair time. Surface
                # a focused warning so triage can locate the offending
                # xref and fall through to the page-region render.
                warnings.append(
                    FigureWarning(
                        code="caption-without-figure",
                        section_code=node.code,
                        message=(
                            f"Caption `{cap.caption[:80]}` on page {cap.page_num + 1} "
                            f"-> mode: image-pixmap-load-failed (xref={chosen.xref})"
                        ),
                    )
                )
                # Don't consume the image key; it stays available for the
                # next caption that might pair with it.
                continue
            used_image_keys.add((chosen.page_num, chosen.idx))
            extracted_width = chosen.width
            extracted_height = chosen.height
        else:
            # Tier 4: page-region render. Many FAA handbook figures
            # (PHAK weight-and-balance worksheets, performance charts,
            # most line-art diagrams) ship as PDF vector graphics with
            # no embedded raster. ``page.get_images()`` cannot see them,
            # so the prior pipeline left every such caption orphaned.
            # Rasterizing the page area above the caption recovers the
            # figure deterministically without changing the caption-side
            # logic.
            page_caps = captions_by_page.get(cap.page_num, [])
            prior_top_y = max(
                (y for y in page_caps if y < cap.top_y - 1.0),
                default=None,
            )
            png_bytes, extracted_width, extracted_height = _render_page_region(
                doc, cap, prior_caption_top_y=prior_top_y
            )
            if png_bytes is None:
                warnings.append(
                    FigureWarning(
                        code="caption-without-figure",
                        section_code=node.code,
                        message=_classify_caption_orphan(cap, images_by_page, node),
                    )
                )
                continue
        img = Image.open(io.BytesIO(png_bytes))
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
                caption_page_num=cap.page_num + 1,
            )
        )
        ordinal += 1

    return records, warnings


_CAPTION_NUMBER = re.compile(r"^\s*Figure\s+(\d+)-(\d+)\.")


def rescope_figures_to_deepest_section(
    figures: list[FigureRecord],
    nodes: list[OutlineNode],
) -> list[FigureRecord]:
    """Re-attach each figure to the deepest section that should own it.

    Two cascading signals decide ownership:

    1. Caption-number scoping. FAA caption numbers encode the section
       directly: "Figure 2-5" should belong to section ``2.5`` whenever
       the section tree has a node with that exact code. This is the
       authoritative signal -- the FAA author chose the number to match
       the section -- and beats geometric heuristics on boundary pages
       where the caption's page sits at a section transition.
    2. Page-range fallback. If no section's code matches the caption
       number (deep nesting, malformed caption, off-by-one editions),
       the deepest section whose page range covers the caption's PDF
       page wins.

    Called after the section-tree merge runs (sub-sections come from a
    sidecar parsed AFTER ``extract_figures``). Without this, every
    figure stays glued to the chapter row even when a more-specific
    section claims the caption; downstream the reader's section page
    won't see the figure inline. Returns a fresh list with
    ``section_code`` rewritten and ``ordinal`` reassigned per new
    section so per-section ordering is stable.

    Figures whose ``caption_page_num`` is ``None`` and whose caption
    number doesn't match any section keep their existing
    ``section_code``.
    """
    if not figures:
        return list(figures)
    section_codes = {n.code for n in nodes}
    by_section: dict[str, list[FigureRecord]] = {}
    rescoped: list[FigureRecord] = []
    for fig in figures:
        # Preferred: caption-number scoping.
        new_code: str | None = None
        match = _CAPTION_NUMBER.match(fig.caption)
        if match is not None:
            chapter, sub = match.group(1), match.group(2)
            candidate = f"{chapter}.{sub}"
            if candidate in section_codes:
                new_code = candidate
        if new_code is None and fig.caption_page_num is not None:
            # Fallback: deepest section whose page range covers the
            # caption.
            deepest = ""
            deepest_depth = -1
            page_idx = fig.caption_page_num - 1
            for node in nodes:
                if node.page_start - 1 <= page_idx < node.page_end:
                    depth = node.code.count(".")
                    if depth > deepest_depth:
                        deepest_depth = depth
                        deepest = node.code
            if deepest:
                new_code = deepest
        if new_code is None:
            new_code = fig.section_code
        rescoped.append(
            FigureRecord(
                section_code=new_code,
                ordinal=fig.ordinal,  # rewritten below
                caption=fig.caption,
                asset_path=fig.asset_path,
                width=fig.width,
                height=fig.height,
                caption_page_num=fig.caption_page_num,
            )
        )
    # Reassign per-section ordinals so renderers that key on
    # (section_code, ordinal) get a contiguous sequence.
    for fig in rescoped:
        by_section.setdefault(fig.section_code, []).append(fig)
    out: list[FigureRecord] = []
    for section_code, group in by_section.items():
        for new_ordinal, fig in enumerate(group):
            out.append(
                FigureRecord(
                    section_code=section_code,
                    ordinal=new_ordinal,
                    caption=fig.caption,
                    asset_path=fig.asset_path,
                    width=fig.width,
                    height=fig.height,
                    caption_page_num=fig.caption_page_num,
                )
            )
    return out


PAGE_REGION_RENDER_DPI = 150
"""Render resolution for vector-only figure capture (Tier 4).

150 DPI hits the sweet spot between file size and on-screen legibility
for line-art diagrams and performance charts. The output is later
re-encoded by Pillow with ``optimize=True`` so the on-disk PNG stays
trim.
"""

PAGE_REGION_TOP_MARGIN_PT = 36.0
"""Top of the rendered region: 36pt (0.5") below the page top edge.

Skips the running header / page number that would otherwise dominate
the captured rect on a vector-only figure page.
"""

PAGE_REGION_BOTTOM_PAD_PT = 4.0
"""Pad between the rendered region's bottom edge and the caption's top
edge so the caption text itself isn't burned into the figure raster.
"""


def _render_page_region(
    doc: fitz.Document,
    cap: _CaptionLoc,
    *,
    prior_caption_top_y: float | None = None,
) -> tuple[bytes | None, int, int]:
    """Rasterize the area above ``cap`` on its PDF page.

    The clip rect spans the full page width. Its bottom edge sits
    :data:`PAGE_REGION_BOTTOM_PAD_PT` above the caption's top edge.
    Its top edge is either :data:`PAGE_REGION_TOP_MARGIN_PT` (just
    below the running header) or, when another caption sits above this
    one on the same page, just below the prior caption -- so two
    vector-rendered figures stacked on one page don't both render the
    same upper region.

    Returns ``(png_bytes, width, height)`` on success or
    ``(None, 0, 0)`` if rendering fails or the available region is
    too small to be a real figure (fewer than 60 vertical pdf-units).
    """
    if cap.page_num >= doc.page_count or cap.page_num < 0:
        return None, 0, 0
    page = doc.load_page(cap.page_num)
    page_rect = page.rect
    if prior_caption_top_y is not None:
        # Skip past the prior caption's text. 18pt is roughly two
        # lines of body text, enough to clear the prior caption's
        # wrapped descriptive tail.
        top = prior_caption_top_y + 18.0
    else:
        top = PAGE_REGION_TOP_MARGIN_PT
    bottom = max(top, cap.top_y - PAGE_REGION_BOTTOM_PAD_PT)
    if bottom - top < 60:
        return None, 0, 0
    clip = fitz.Rect(page_rect.x0, top, page_rect.x1, bottom)
    matrix = fitz.Matrix(PAGE_REGION_RENDER_DPI / 72, PAGE_REGION_RENDER_DPI / 72)
    try:
        pix = page.get_pixmap(matrix=matrix, clip=clip, alpha=False)
        return pix.tobytes("png"), pix.width, pix.height
    except Exception:  # noqa: BLE001 - rendering is best-effort
        return None, 0, 0


def _classify_caption_orphan(
    cap: _CaptionLoc,
    images_by_page: dict[int, list[_ImageLoc]],
    node: OutlineNode,
) -> str:
    """Build the warning message for an unpaired caption, tagging the
    detected mode so future triage doesn't have to open the PDF.

    Modes (per the figure-pairing WP):

    - ``in-sentence-reference`` -- the regex match looks like a body-text
      reference (caption text doesn't begin with the literal ``Figure``
      sequence). Should be rare with the line-anchored regex; surfaces
      the residual long-tail where PDF text-extraction merges columns.
    - ``image-filtered-by-floor`` -- there IS a same-page image but it
      sits below the size floor. Phase 4's proximity allowlist may
      rescue these.
    - ``image-extracted-elsewhere`` -- there is no candidate image on
      the cap's page or its neighbors. The image was either dropped
      upstream or extracted under a different section.
    """
    cap_head = cap.caption.lstrip()[:80]
    if not cap_head.lower().startswith("figure"):
        mode = "in-sentence-reference"
    else:
        nearby = images_by_page.get(cap.page_num, []) + images_by_page.get(
            cap.page_num - 1, []
        ) + images_by_page.get(cap.page_num + 1, [])
        if any(img.width < 64 or img.height < 64 for img in nearby):
            mode = "image-filtered-by-floor"
        else:
            mode = "image-extracted-elsewhere"
    return (
        f"Caption `{cap.caption[:80]}` on page {cap.page_num + 1} had no paired image. "
        f"-> mode: {mode}"
    )


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


SMALL_IMAGE_FLOOR = 32
"""Hard minimum for keeping an embedded raster as a figure candidate.

Below this threshold the image is almost certainly a decorative inline
glyph (callout symbol, page ornament). The ``LARGE_IMAGE_FLOOR`` band
above is reserved for "small but possibly legitimate" symbol-legend
figures; those only survive if a caption sits next to them on the page
(see :func:`_pair_caption_with_image`).
"""

LARGE_IMAGE_FLOOR = 64
"""Original Mode-C threshold. Images at or above this size are kept
unconditionally; smaller images need the proximity allowlist to survive.
"""

PROXIMITY_ALLOWLIST_PT = 50.0
"""PDF-units distance below which a small image is considered close
enough to a caption to be a legitimate symbol-legend figure (Fix 3).
"""


def _extract_images_on_page(
    doc: fitz.Document,
    page: fitz.Page,
    page_num: int,
) -> list[_ImageLoc]:
    """Pull every embedded raster on the page that meets the size floor,
    along with its position (top/bottom y on the page).

    Per the figure-pairing WP (Mode C / Fix 3): the floor is lowered from
    64 to 32 so symbol-legend figures aren't silently dropped. Images in
    the 32..63 px band carry their dimensions on ``_ImageLoc`` so
    :func:`_pair_caption_with_image` can apply the proximity allowlist
    (only keep them if a caption sits within ~50 pdf-units).

    Pixmap extraction stays cheap: we read width/height from
    ``page.get_images(full=True)`` metadata (without materializing the
    full PNG) where possible, falling back to a Pixmap probe for
    pre-1.23 PyMuPDF tuples that don't expose width/height inline.
    """
    out: list[_ImageLoc] = []
    page_height = page.rect.height
    for idx, img_meta in enumerate(page.get_images(full=True)):
        xref = img_meta[0]
        # `img_meta` shape (PyMuPDF >= 1.18):
        #   (xref, smask, width, height, bpc, colorspace, ...)
        width = int(img_meta[2]) if len(img_meta) > 2 else 0
        height = int(img_meta[3]) if len(img_meta) > 3 else 0
        if width <= 0 or height <= 0:
            try:
                pix = fitz.Pixmap(doc, xref)
                width, height = pix.width, pix.height
            except Exception:  # noqa: BLE001 - PDF embedded images are noisy.
                continue
        if width < SMALL_IMAGE_FLOOR or height < SMALL_IMAGE_FLOOR:
            continue
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
                xref=xref,
                width=width,
                height=height,
                top_y=top_y,
                bottom_y=bottom_y,
            )
        )
    return out


def _load_png_bytes(doc: fitz.Document, xref: int) -> bytes | None:
    """Materialize the PNG bytes for an image xref.

    Deferring this until after the pairing pass keeps the doc-wide
    ``images_by_page`` dict cheap (Fix 2 / memory note in the WP risks
    section): only the chosen image of each pair pays the Pixmap cost.
    Returns ``None`` if the underlying Pixmap can't be opened (corrupt
    embedded image; very rare but happens in scanned PDFs).

    Colorspace handling: PNG only supports RGB / RGBA / Gray. CMYK PDFs
    (very common in FAA handbooks; PHAK / IPH / IFH all ship CMYK figure
    rasters) and other non-RGB spaces must be converted to RGB before
    ``tobytes("png")`` will succeed. The prior implementation only
    converted ``n > 4`` (which is rare), so CMYK images silently failed
    inside a bare ``except`` and never reached the manifest -- that's
    where the artifically-low pre-fix ``figure-without-caption`` count
    came from.
    """
    try:
        pix = fitz.Pixmap(doc, xref)
    except Exception:  # noqa: BLE001 - PDF embedded images are noisy.
        return None
    # Try the native colorspace first. If it isn't PNG-encodable
    # (CMYK, indexed RGB, indexed gray, exotic n>4 spaces), fall back
    # to a csRGB conversion. The two-step shape catches every flavor
    # the FAA handbook fleet ships without an a-priori colorspace
    # taxonomy.
    try:
        return pix.tobytes("png")
    except Exception:  # noqa: BLE001 - tobytes is colorspace-strict.
        pass
    try:
        rgb = fitz.Pixmap(fitz.csRGB, pix)
        return rgb.tobytes("png")
    except Exception:  # noqa: BLE001 - some Pixmaps are unsalvageable.
        return None


def _pair_caption_with_image(
    cap: _CaptionLoc,
    images_by_page: dict[int, list[_ImageLoc]],
    used: set[tuple[int, int]],
) -> _ImageLoc | None:
    """Return the best unused image to pair with `cap`, or None.

    Tier 1: same page, geometric proximity (smallest vertical edge-to-edge
            distance to the caption). Captions usually sit just above or
            just below their figure. Images in the 32..63 px band only
            survive this tier if their distance to the caption is under
            :data:`PROXIMITY_ALLOWLIST_PT` (Fix 3 / Mode C). Larger
            candidates win unconditionally.
    Tier 2: prior page, in encounter order. Small images are excluded
            here because the proximity check can only run on the same
            page; cross-page small-image pairing is too noisy.
    Tier 3 (wider-rect retry): next page, in encounter order. FAA AC docs
            sometimes paginate a figure after its caption. Small images
            excluded for the same reason as Tier 2.
    """
    # Tier 1 -- same-page geometric, with proximity allowlist for small images.
    same_page = images_by_page.get(cap.page_num, [])
    candidates: list[_ImageLoc] = []
    for img in same_page:
        if (img.page_num, img.idx) in used:
            continue
        if _is_small(img):
            distance = _vertical_distance(cap.top_y, img)
            if distance > PROXIMITY_ALLOWLIST_PT:
                continue
        candidates.append(img)
    if candidates:
        return min(candidates, key=lambda img: _vertical_distance(cap.top_y, img))

    # Tier 2 / 3 -- neighbor-page sweep. Walk ±1 then ±2 pages out from
    # the caption, in alternating prior/next order, picking the first
    # unused non-small image. Two-page reach catches FAA layouts where
    # the caption sits on a left-hand text page and the figure occupies
    # the next right-hand spread, plus the inverse where a chart appears
    # before its descriptive caption (PHAK 11.x performance charts).
    # Small images stay excluded across pages because the proximity
    # allowlist can only run on the caption's own page.
    for distance in (1, 2):
        for offset in (-distance, distance):
            neighbor = images_by_page.get(cap.page_num + offset, [])
            for img in neighbor:
                if (img.page_num, img.idx) in used:
                    continue
                if _is_small(img):
                    continue
                return img

    return None


def _is_small(img: _ImageLoc) -> bool:
    """``True`` for images that fall in the 32..63 px allowlist band.

    Used to gate the cross-page tiers and the same-page proximity
    check. Anything at or above :data:`LARGE_IMAGE_FLOOR` on either
    axis bypasses the proximity rule and pairs through normal geometry.
    """
    return img.width < LARGE_IMAGE_FLOOR or img.height < LARGE_IMAGE_FLOOR


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
