---
title: Adjacency Fixture
week: 4
section_order: '06'
---

# Adjacency

The IFR fuel-and-alternate trio at
[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026),
[§91.168](airboss-ref:regs/cfr-14/91/168?at=2026), and
[§91.169](airboss-ref:regs/cfr-14/91/169?at=2026)
is a set of contiguous sections; the renderer should emit the range form.

A non-contiguous trio is at
[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026),
[§91.169](airboss-ref:regs/cfr-14/91/169?at=2026), and
[§91.171](airboss-ref:regs/cfr-14/91/171?at=2026);
the renderer should emit the comma-list form.

When prose separates two same-corpus same-pin links --
[§91.167](airboss-ref:regs/cfr-14/91/167?at=2026) covers fuel, while
[§91.171](airboss-ref:regs/cfr-14/91/171?at=2026) covers VOR checks --
the renderer should emit two separate anchors.
