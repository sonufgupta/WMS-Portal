## 2024-07-24 - O(N*M) Serial Grouping Anti-Pattern in UI Renders
**Learning:** Found a critical performance bottleneck in `app.js` where UI render functions (`renderBoxCards`, `renderOutboundBoxCards`) and compaction functions repeatedly used `Array.prototype.filter` and `Array.prototype.includes`/`indexOf` on large arrays inside `forEach` loops over products. This O(N*M) pattern blocks the main thread during high-volume scanning rounds.
**Action:** When filtering a large dataset multiple times based on a key (e.g., `itemName`), always group the dataset upfront using a `Map` (O(N) grouping, O(1) lookup). Use `Set` for fast uniqueness checks instead of arrays with `.includes`.
## 2024-07-24 - JSON.parse in high-frequency functions
**Learning:** Found a performance bottleneck where `JSON.parse()` was repeatedly called in `getHistory()` for a large local storage string.
**Action:** When repeatedly reading a JSON string from `localStorage`, cache the raw string and the parsed object. Only re-parse if the raw string changes.
