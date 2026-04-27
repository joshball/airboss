"""Unit tests for the shared section-tree contract."""

from __future__ import annotations

from ingest.section_tree import SectionTreeNode, derive_codes


def _node(chap: int, level: int, title: str, parent: str | None = None) -> SectionTreeNode:
    return SectionTreeNode(
        chapter_ordinal=chap,
        level=level,
        title=title,
        parent_title=parent,
        provenance="toc",
    )


def test_derive_codes_simple_l1_walk() -> None:
    nodes = [_node(12, 1, "A"), _node(12, 1, "B"), _node(12, 1, "C")]
    codes = derive_codes(nodes)
    assert codes == {0: "12.1", 1: "12.2", 2: "12.3"}
    assert [n.ordinal for n in nodes] == [1, 2, 3]


def test_derive_codes_nested_levels() -> None:
    nodes = [
        _node(12, 1, "Aerodynamic Forces"),
        _node(12, 2, "Lift", parent="Aerodynamic Forces"),
        _node(12, 2, "Drag", parent="Aerodynamic Forces"),
        _node(12, 1, "Stability"),
        _node(12, 2, "Static", parent="Stability"),
    ]
    codes = derive_codes(nodes)
    assert codes == {0: "12.1", 1: "12.1.1", 2: "12.1.2", 3: "12.2", 4: "12.2.1"}


def test_derive_codes_resets_on_new_chapter() -> None:
    nodes = [
        _node(11, 1, "Eleven A"),
        _node(11, 1, "Eleven B"),
        _node(12, 1, "Twelve A"),
        _node(12, 2, "Twelve A.1", parent="Twelve A"),
    ]
    codes = derive_codes(nodes)
    assert codes == {0: "11.1", 1: "11.2", 2: "12.1", 3: "12.1.1"}


def test_derive_codes_three_levels() -> None:
    nodes = [
        _node(5, 1, "Forces"),
        _node(5, 2, "Lift", parent="Forces"),
        _node(5, 3, "AoA", parent="Lift"),
        _node(5, 3, "Speed", parent="Lift"),
        _node(5, 2, "Drag", parent="Forces"),
    ]
    codes = derive_codes(nodes)
    assert codes == {0: "5.1", 1: "5.1.1", 2: "5.1.1.1", 3: "5.1.1.2", 4: "5.1.2"}
