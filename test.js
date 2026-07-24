const assert = require('assert');

// Simple mock for browser-specific objects to let app.js load without errors in Node
global.window = {};
global.document = {
    addEventListener: () => {}
};
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

const { extractAlphabetPattern } = require('./app.js');

function runTests() {
    console.log("Running tests for extractAlphabetPattern...");
    let passed = 0;
    let failed = 0;

    const testCases = [
        {
            name: "Pure alphabet string",
            input: "abcDEF",
            expected: { 0: "A", 1: "B", 2: "C", 3: "D", 4: "E", 5: "F" }
        },
        {
            name: "Mixed alphanumeric string",
            input: "a1B2c3D4",
            expected: { 0: "A", 2: "B", 4: "C", 6: "D" }
        },
        {
            name: "Empty string",
            input: "",
            expected: {}
        },
        {
            name: "String with no letters",
            input: "1234567890!@#$%",
            expected: {}
        },
        {
            name: "String with symbols",
            input: "AB-CD_EF",
            expected: { 0: "A", 1: "B", 3: "C", 4: "D", 6: "E", 7: "F" }
        }
    ];

    testCases.forEach((tc) => {
        try {
            const result = extractAlphabetPattern(tc.input);
            assert.deepStrictEqual(result, tc.expected);
            passed++;
            console.log(`✅ Passed: ${tc.name}`);
        } catch (error) {
            failed++;
            console.error(`❌ Failed: ${tc.name}`);
            console.error(`   Input:    "${tc.input}"`);
            console.error(`   Expected:`, tc.expected);
            console.error(`   Actual:  `, extractAlphabetPattern(tc.input));
        }
    });

    console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
