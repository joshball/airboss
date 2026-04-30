"""Unit tests for the TOC parser (Option 3) without a real PDF.

We exercise `_parse_toc_lines` against synthetic TocLine fixtures. The
heading-fingerprint verification is covered separately with mocks.
"""

from __future__ import annotations

from ingest.section_tree import SectionTreeNode
from ingest.sections_via_toc import TocLine, _parse_toc_lines, to_checklist_for_chapter


def L(text: str, x: float, page: int = 11) -> TocLine:
    return TocLine(text=text, x=x, page_num=page)


def test_parse_toc_basic_chapter_with_l1_l2() -> None:
    """Mirror of PHAK ToC for chapter 12: L1 at column-x, L2 at column-x+9."""
    column_x = 285.0
    lines = [
        L("Chapter 12", column_x),
        L("Weather Theory..................................................12-1", column_x),
        L("Introduction..................................................................12-1", column_x),
        L("Atmosphere...................................................................12-2", column_x),
        L("Composition of the Atmosphere...............................12-2", column_x + 9),
        L("Atmospheric Circulation...........................................12-3", column_x + 9),
        L("Coriolis Force...............................................................12-3", column_x),
    ]
    nodes, warnings = _parse_toc_lines(lines, known_chapter_ords={12})
    assert warnings == []
    titles_levels = [(n.title, n.level) for n in nodes]
    assert titles_levels == [
        # Chapter title is consumed (chapter row already exists), so first L1
        # entry emitted is "Introduction".
        ("Introduction", 1),
        ("Atmosphere", 1),
        ("Composition of the Atmosphere", 2),
        ("Atmospheric Circulation", 2),
        ("Coriolis Force", 1),
    ]
    # parent_title resolves up the indent stack.
    assert nodes[2].parent_title == "Atmosphere"
    assert nodes[3].parent_title == "Atmosphere"
    assert nodes[4].parent_title is None  # back to L1
    # Page anchors are preserved.
    assert nodes[2].page_anchor == "12-2"


def test_parse_toc_warns_on_chapter_not_in_outline() -> None:
    column_x = 285.0
    lines = [
        L("Chapter 99", column_x),
        L("Phantom Title..............................................99-1", column_x),
    ]
    nodes, warnings = _parse_toc_lines(lines, known_chapter_ords={1, 12})
    assert nodes == []
    assert any("Chapter 99" in w for w in warnings)


def test_parse_toc_handles_continuation_lines() -> None:
    """PHAK splits long titles; the parser coalesces them before emitting."""
    column_x = 285.0
    lines = [
        L("Chapter 12", column_x),
        L("Weather Theory..................................................12-1", column_x),
        L("Wind and Pressure Representation on Surface", column_x + 9),
        L("Weather Maps.........................................................12-12", column_x + 9),
    ]
    nodes, _warnings = _parse_toc_lines(lines, known_chapter_ords={12})
    titles = [n.title for n in nodes]
    assert any("Weather Maps" in t for t in titles)
    assert nodes[0].page_anchor == "12-12"


def test_parse_toc_three_level_indent_collapses_to_two() -> None:
    """PHAK occasionally indents a fourth level; the parser collapses to L2.

    The DB schema supports chapter / section / subsection (max 3-dot codes).
    L3 indents in the TOC become L2 under the nearest L1 ancestor.
    """
    column_x = 285.0
    lines = [
        L("Chapter 5", column_x),
        L("Aerodynamics of Flight..................................5-1", column_x),
        L("Forces on the Aircraft..............................5-1", column_x),  # L1
        L("Lift...........................................................5-2", column_x + 9),  # L2
        L("Angle of Attack.....................................5-3", column_x + 18),  # collapses to L2
    ]
    nodes, _w = _parse_toc_lines(lines, known_chapter_ords={5})
    levels = [n.level for n in nodes]
    assert levels == [1, 2, 2]
    # parent_title points at the most recent L1 for both L2 entries since
    # the indent stack pops back to L1 when the deeper L3 is rewritten as L2.
    assert nodes[1].parent_title == "Forces on the Aircraft"
    assert nodes[2].parent_title == "Forces on the Aircraft"


# ---------------------------------------------------------------------------
# to_checklist_for_chapter -- Phase 3 mutual-reviewer support
# ---------------------------------------------------------------------------


def _node(chap: int, level: int, title: str, anchor: str | None = None) -> SectionTreeNode:
    return SectionTreeNode(
        chapter_ordinal=chap,
        level=level,
        title=title,
        page_anchor=anchor,
        provenance="toc",
    )


def test_checklist_renders_indented_markdown_list() -> None:
    nodes = [
        _node(7, 1, "Powerplant", "7-1"),
        _node(7, 2, "Reciprocating Engines", "7-2"),
        _node(7, 2, "Propeller", "7-4"),
        _node(7, 1, "Induction Systems", "7-7"),
    ]
    out = to_checklist_for_chapter(nodes, chapter_ordinal=7)
    expected = (
        "- L1 Powerplant (7-1)\n"
        "  - L2 Reciprocating Engines (7-2)\n"
        "  - L2 Propeller (7-4)\n"
        "- L1 Induction Systems (7-7)\n"
    )
    assert out == expected


def test_checklist_filters_to_chapter() -> None:
    nodes = [
        _node(1, 1, "Introduction", "1-1"),
        _node(7, 1, "Powerplant", "7-1"),
        _node(7, 2, "Reciprocating Engines", "7-2"),
        _node(12, 1, "Atmosphere", "12-2"),
    ]
    out = to_checklist_for_chapter(nodes, chapter_ordinal=7)
    assert "Powerplant" in out
    assert "Reciprocating" in out
    assert "Introduction" not in out
    assert "Atmosphere" not in out


def test_checklist_omits_empty_anchor_in_parens() -> None:
    nodes = [
        _node(3, 1, "Aircraft Structure", None),
        _node(3, 2, "Fuselage", "3-3"),
    ]
    out = to_checklist_for_chapter(nodes, chapter_ordinal=3)
    # No-anchor entries render without the trailing "(...)".
    assert "- L1 Aircraft Structure\n" in out
    assert "  - L2 Fuselage (3-3)\n" in out


def test_checklist_returns_empty_string_when_chapter_absent() -> None:
    nodes = [_node(1, 1, "Introduction", "1-1")]
    out = to_checklist_for_chapter(nodes, chapter_ordinal=99)
    assert out == ""


def test_checklist_handles_l3_indent() -> None:
    nodes = [
        _node(17, 1, "Spatial Disorientation", "17-10"),
        _node(17, 2, "Vestibular Illusions", "17-11"),
        _node(17, 3, "The Leans", "17-11"),
        _node(17, 3, "Coriolis Illusion", "17-12"),
    ]
    out = to_checklist_for_chapter(nodes, chapter_ordinal=17)
    assert "    - L3 The Leans (17-11)\n" in out
    assert "    - L3 Coriolis Illusion (17-12)\n" in out
