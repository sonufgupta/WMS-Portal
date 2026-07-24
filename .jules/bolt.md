## 2024-07-24 - O(N*M) Serial Grouping Anti-Pattern in UI Renders
**Learning:** Found a critical performance bottleneck in `app.js` where UI render functions (`renderBoxCards`, `renderOutboundBoxCards`) and compaction functions repeatedly used `Array.prototype.filter` and `Array.prototype.includes`/`indexOf` on large arrays inside `forEach` loops over products. This O(N*M) pattern blocks the main thread during high-volume scanning rounds.
**Action:** When filtering a large dataset multiple times based on a key (e.g., `itemName`), always group the dataset upfront using a `Map` (O(N) grouping, O(1) lookup). Use `Set` for fast uniqueness checks instead of arrays with `.includes`.
## 2026-07-24 - [Duplicate Serial Check Optimization]\n**Learning:** Replacing an array `.map` + `.includes` check followed by a `.find` with a single `.find` improves performance and reduces redundant operations in vanilla js.\n**Action:** Use single  check when finding object instances by specific fields instead of mapping first.
## 2026-07-24 - [Duplicate Serial Check Optimization]
**Learning:** Replacing an array `.map` + `.includes` check followed by a `.find` with a single `.find` improves performance and reduces redundant operations in vanilla js.
**Action:** Use single `.find()` check when finding object instances by specific fields instead of mapping first.
