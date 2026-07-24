const assert = require('assert');

// Mock DOM elements required by app.js during load
global.document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    documentElement: {
        getAttribute: () => null,
        setAttribute: () => null,
    }
};
global.window = {
    addEventListener: () => {},
    innerWidth: 1024
};
global.localStorage = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null
};

const { formatAlphabetPattern } = require('./app.js');

console.log("Testing formatAlphabetPattern...");

// 1. Happy path: valid pattern and valid length
assert.strictEqual(formatAlphabetPattern({0: 'A', 1: 'B', 2: 'C'}, 3), 'ABC', "Failed: Happy path");

// 2. Edge case: pattern is null/undefined
assert.strictEqual(formatAlphabetPattern(null, 5), 'Not Locked Yet', "Failed: pattern is null");
assert.strictEqual(formatAlphabetPattern(undefined, 5), 'Not Locked Yet', "Failed: pattern is undefined");

// 3. Edge case: length is 0
assert.strictEqual(formatAlphabetPattern({0: 'A'}, 0), 'Not Locked Yet', "Failed: length is 0");

// 4. Edge case: pattern object has gaps (should pad with '.')
assert.strictEqual(formatAlphabetPattern({0: 'A', 2: 'C'}, 3), 'A.C', "Failed: pattern with gaps");

// 5. Edge case: pattern object has indices >= length (should be ignored)
assert.strictEqual(formatAlphabetPattern({0: 'A', 1: 'B', 5: 'Z'}, 2), 'AB', "Failed: pattern with indices >= length");

// 6. Edge case: empty pattern {} with valid length
assert.strictEqual(formatAlphabetPattern({}, 3), '...', "Failed: empty pattern");

// 7. Edge case: negative length (should handle gracefully, return empty string)
assert.strictEqual(formatAlphabetPattern({0: 'A'}, -1), '', "Failed: negative length");

console.log("All tests passed successfully!");
