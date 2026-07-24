const fs = require('fs');
const assert = require('assert');

// Read app.js and extract the function to test
const appJs = fs.readFileSync('app.js', 'utf8');
const match = appJs.match(/function matchesAlphabetPattern\([\s\S]*?\n    \}/);
if (!match) {
    console.error("Could not find function matchesAlphabetPattern");
    process.exit(1);
}

// Use eval to make the function available in this context
eval(match[0]);

console.log("Running matchesAlphabetPattern tests...");

// Valid Matches
assert.strictEqual(matchesAlphabetPattern("ABC", {0: "A", 1: "B"}), true, "Valid match 1 failed");
assert.strictEqual(matchesAlphabetPattern("ABC", {1: "B", 2: "C"}), true, "Valid match 2 failed");
assert.strictEqual(matchesAlphabetPattern("X123", {0: "X"}), true, "Valid match with numbers failed");
assert.strictEqual(matchesAlphabetPattern("abc", {0: "A", 1: "B"}), true, "Case-insensitive match failed");

// Invalid Matches
assert.strictEqual(matchesAlphabetPattern("ABC", {0: "B"}), false, "Invalid match 1 failed to return false");
assert.strictEqual(matchesAlphabetPattern("ABC", {1: "A"}), false, "Invalid match 2 failed to return false");
assert.strictEqual(matchesAlphabetPattern("123", {0: "A"}), false, "Invalid match with numbers failed to return false");

// Missing or Empty Patterns - BEHAVIOR BASED ON CURRENT CODE
assert.strictEqual(matchesAlphabetPattern("ABC", null), true, "Null pattern failed to return true");
assert.strictEqual(matchesAlphabetPattern("ABC", undefined), true, "Undefined pattern failed to return true");
assert.strictEqual(matchesAlphabetPattern("ABC", {}), true, "Empty object pattern should return true");
assert.strictEqual(matchesAlphabetPattern("ABC", ""), true, "Empty string pattern failed to return true");

// Edge Cases
assert.strictEqual(matchesAlphabetPattern("", {0: "A"}), false, "Empty serial string should return false if pattern exists");
assert.strictEqual(matchesAlphabetPattern("A", {1: "B"}), false, "Pattern index out of bounds should return false");

// Pattern has null/undefined value (Current logic strictly compares so expected false because 'X' !== null)
// But wait, the function does: char of Object.entries -> char is the value.
// 'A'.toUpperCase() !== null -> true, so it returns false.
assert.strictEqual(matchesAlphabetPattern("ABC", {0: null, 1: undefined, 2: ''}), false, "Pattern with null/undefined values should return false");

// Serial shorter than pattern index
assert.strictEqual(matchesAlphabetPattern("A", {0: "A", 1: "B"}), false, "Serial shorter than pattern index should return false");

// Tests with real patterns from app.js context (extracted pattern formats)
assert.strictEqual(matchesAlphabetPattern("AB123CD", {0: "A", 1: "B", 5: "C", 6: "D"}), true, "Real world pattern match failed");
assert.strictEqual(matchesAlphabetPattern("AB123CD", {0: "A", 1: "B", 5: "X"}), false, "Real world pattern mismatch failed to return false");

console.log("✅ All tests passed successfully.");
