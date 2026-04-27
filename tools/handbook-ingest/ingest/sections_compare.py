"""Diff TOC and LLM section trees per chapter and emit a markdown report.

The user reads the report and decides per-chapter (or globally) which
strategy to trust. The decision is captured in `phak.yaml` as
`section_strategy: toc | llm | per_chapter` with optional
`per_chapter_override: { 1: toc, 12: llm, ... }`.

Determinism: same inputs (same TOC tree, same LLM tree) = byte-identical
report. Sort everything; never iterate dicts in insertion order; pin
section ordering by `(chapter_ordinal, level, ordinal-walk)`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from difflib import SequenceMatcher

from .config_loader import HandbookConfig
from .section_tree import SectionTreeNode

# Title-similarity floor for matching cross-strategy. Two tactics produce
# the same heading text most of the time; allow minor whitespace and
# punctuation drift before declaring a mismatch.
_TITLE_MATCH_THRESHOLD = 0.92


@dataclass
class ChapterAgreement:
    chapter_ordinal: int
    chapter_title: str
    toc_count_l1: int
    llm_count_l1: int
    toc_total: int
    llm_total: int
    matches: list[tuple[SectionTreeNode, SectionTreeNode]] = field(default_factory=list)
    toc_only: list[SectionTreeNode] = field(default_factory=list)
    llm_only: list[SectionTreeNode] = field(default_factory=list)
    parent_disagreements: list[tuple[SectionTreeNode, SectionTreeNode]] = field(default_factory=list)
    level_disagreements: list[tuple[SectionTreeNode, SectionTreeNode]] = field(default_factory=list)

    @property
    def agreement(self) -> str:
        toc_titles = {self._normalize(n.title) for n in (n for m in self.matches for n in (m[0],))}
        toc_titles |= {self._normalize(n.title) for n in self.toc_only}
        llm_titles = {self._normalize(n.title) for n in (n for m in self.matches for n in (m[1],))}
        llm_titles |= {self._normalize(n.title) for n in self.llm_only}
        if not toc_titles and not llm_titles:
            return "n/a"
        if not self.toc_only and not self.llm_only and not self.level_disagreements and not self.parent_disagreements:
            return "full"
        union = max(1, len(toc_titles | llm_titles))
        intersection = len(toc_titles & llm_titles)
        ratio = intersection / union
        if ratio >= 0.85:
            return "partial"
        return "low"

    @staticmethod
    def _normalize(title: str) -> str:
        return " ".join(title.lower().split())


@dataclass
class CompareResult:
    chapters: list[ChapterAgreement]
    generated_at: str

    def to_markdown(self, config: HandbookConfig) -> str:
        title = f"# {config.document_slug.upper()} {config.edition} section-tree comparison"
        lines: list[str] = [
            title,
            "",
            f"Generated: {self.generated_at}",
            "",
            "| Chapter | Title | TOC L1 | LLM L1 | TOC total | LLM total | Agreement | Notes |",
            "| ------- | ----- | ------ | ------ | --------- | --------- | --------- | ----- |",
        ]
        for ch in self.chapters:
            notes = self._summary_notes(ch)
            lines.append(
                f"| {ch.chapter_ordinal} | {ch.chapter_title} | {ch.toc_count_l1} | {ch.llm_count_l1} "
                f"| {ch.toc_total} | {ch.llm_total} | {ch.agreement} | {notes} |"
            )
        lines.append("")
        lines.append("## Per-chapter detail")
        lines.append("")
        for ch in self.chapters:
            lines.extend(self._render_chapter(ch))
        return "\n".join(lines).rstrip() + "\n"

    @staticmethod
    def _summary_notes(ch: ChapterAgreement) -> str:
        bits: list[str] = []
        if ch.toc_only:
            bits.append(f"TOC only: {len(ch.toc_only)}")
        if ch.llm_only:
            bits.append(f"LLM only: {len(ch.llm_only)}")
        if ch.level_disagreements:
            bits.append(f"level diff: {len(ch.level_disagreements)}")
        if ch.parent_disagreements:
            bits.append(f"parent diff: {len(ch.parent_disagreements)}")
        return "; ".join(bits) if bits else ""

    @staticmethod
    def _render_chapter(ch: ChapterAgreement) -> list[str]:
        lines: list[str] = []
        lines.append(f"### Chapter {ch.chapter_ordinal} -- {ch.chapter_title}")
        lines.append("")
        lines.append(f"**TOC strategy** ({ch.toc_total} entries):")
        lines.append("")
        if ch.toc_total == 0:
            lines.append("- (none)")
        for n in [m[0] for m in ch.matches] + ch.toc_only:
            lines.append(f"- L{n.level} {n.title} ({n.page_anchor or 'no-anchor'})")
        lines.append("")
        lines.append(f"**LLM strategy** ({ch.llm_total} entries):")
        lines.append("")
        if ch.llm_total == 0:
            lines.append("- (none)")
        for n in [m[1] for m in ch.matches] + ch.llm_only:
            lines.append(f"- L{n.level} {n.title} ({n.page_anchor or 'no-anchor'})")
        lines.append("")
        if ch.toc_only or ch.llm_only or ch.level_disagreements or ch.parent_disagreements:
            lines.append("**Diff:**")
            lines.append("")
            for n in ch.toc_only:
                lines.append(f"- TOC only: L{n.level} {n.title}")
            for n in ch.llm_only:
                lines.append(f"- LLM only: L{n.level} {n.title}")
            for toc_n, llm_n in ch.level_disagreements:
                lines.append(
                    f"- level mismatch: {toc_n.title!r} -- TOC L{toc_n.level} vs LLM L{llm_n.level}"
                )
            for toc_n, llm_n in ch.parent_disagreements:
                lines.append(
                    f"- parent mismatch: {toc_n.title!r} -- TOC parent={toc_n.parent_title!r} "
                    f"vs LLM parent={llm_n.parent_title!r}"
                )
        else:
            lines.append("**Diff:** full agreement.")
        lines.append("")
        return lines


def compare_strategies(
    toc_nodes: list[SectionTreeNode],
    llm_nodes: list[SectionTreeNode],
    chapter_titles: dict[int, str],
) -> CompareResult:
    """Diff the two trees per chapter."""
    chapter_ords = sorted({n.chapter_ordinal for n in toc_nodes} | {n.chapter_ordinal for n in llm_nodes})
    chapters: list[ChapterAgreement] = []
    for chap in chapter_ords:
        toc_chap = [n for n in toc_nodes if n.chapter_ordinal == chap]
        llm_chap = [n for n in llm_nodes if n.chapter_ordinal == chap]
        ch_agree = _diff_chapter(chap, chapter_titles.get(chap, f"Chapter {chap}"), toc_chap, llm_chap)
        chapters.append(ch_agree)
    return CompareResult(
        chapters=chapters,
        generated_at=datetime.now(tz=UTC).strftime("%Y-%m-%d %H:%M:%S UTC"),
    )


def _diff_chapter(
    chapter_ordinal: int,
    chapter_title: str,
    toc: list[SectionTreeNode],
    llm: list[SectionTreeNode],
) -> ChapterAgreement:
    """Greedy title-match within (chapter, level)."""
    toc_count_l1 = sum(1 for n in toc if n.level == 1)
    llm_count_l1 = sum(1 for n in llm if n.level == 1)

    matches: list[tuple[SectionTreeNode, SectionTreeNode]] = []
    parent_disagreements: list[tuple[SectionTreeNode, SectionTreeNode]] = []
    level_disagreements: list[tuple[SectionTreeNode, SectionTreeNode]] = []

    used_llm: set[int] = set()
    toc_only: list[SectionTreeNode] = []

    # Match by best title similarity within the same chapter, preferring same-level.
    for toc_n in toc:
        best_idx = -1
        best_score = 0.0
        for i, llm_n in enumerate(llm):
            if i in used_llm:
                continue
            sim = SequenceMatcher(None, _norm(toc_n.title), _norm(llm_n.title)).ratio()
            # Same-level boost so we prefer L1 -> L1 when titles tie.
            if toc_n.level == llm_n.level:
                sim += 0.05
            if sim > best_score:
                best_score = sim
                best_idx = i
        if best_idx >= 0 and best_score >= _TITLE_MATCH_THRESHOLD:
            llm_n = llm[best_idx]
            used_llm.add(best_idx)
            matches.append((toc_n, llm_n))
            if toc_n.level != llm_n.level:
                level_disagreements.append((toc_n, llm_n))
            if _norm(toc_n.parent_title or "") != _norm(llm_n.parent_title or ""):
                parent_disagreements.append((toc_n, llm_n))
        else:
            toc_only.append(toc_n)
    llm_only = [llm[i] for i in range(len(llm)) if i not in used_llm]

    return ChapterAgreement(
        chapter_ordinal=chapter_ordinal,
        chapter_title=chapter_title,
        toc_count_l1=toc_count_l1,
        llm_count_l1=llm_count_l1,
        toc_total=len(toc),
        llm_total=len(llm),
        matches=matches,
        toc_only=toc_only,
        llm_only=llm_only,
        parent_disagreements=parent_disagreements,
        level_disagreements=level_disagreements,
    )


def _norm(s: str) -> str:
    return " ".join(s.lower().split())
