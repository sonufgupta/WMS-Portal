const fs = require('fs');
const assert = require('assert');

// 1. Mock browser APIs
global.localStorage = {
    store: {},
    getItem: function(key) {
        return this.store.hasOwnProperty(key) ? this.store[key] : null;
    },
    setItem: function(key, value) {
        this.store[key] = value.toString();
    },
    removeItem: function(key) {
        delete this.store[key];
    },
    clear: function() {
        this.store = {};
    }
};

const appCode = fs.readFileSync('./app.js', 'utf8');

// Rather than using brittle regexes, we will locate the function using brace matching
// which guarantees we extract the entire valid function block regardless of newlines or whitespace.
let startIndex = appCode.indexOf('function getHistory() {');
if (startIndex === -1) {
    console.error("getHistory function not found");
    process.exit(1);
}

let braceCount = 0;
let endIndex = -1;
let started = false;

for (let i = startIndex; i < appCode.length; i++) {
    if (appCode[i] === '{') {
        braceCount++;
        started = true;
    } else if (appCode[i] === '}') {
        braceCount--;
    }

    if (started && braceCount === 0) {
        endIndex = i;
        break;
    }
}

if (endIndex === -1) {
    console.error("Could not find end of getHistory function");
    process.exit(1);
}

const functionBody = appCode.substring(startIndex, endIndex + 1);

// We avoid `vm` module because arrays returned from the VM context
// are not reference-equal to arrays in the main context, causing
// `assert.deepStrictEqual(result, [])` to fail in Node.js.
// We use `new Function` with the accurately extracted body instead.
const getHistory = new Function('localStorage', `
    ${functionBody}
    return getHistory();
`);

function runTests() {
    console.log('Running tests for getHistory...');
    let passed = 0;
    let failed = 0;

    // Test 1: Empty storage (edge case)
    try {
        global.localStorage.clear();
        const result = getHistory(global.localStorage);
        assert.deepStrictEqual(result, [], 'Should return empty array when no history');
        console.log('✅ Test 1 Passed: Empty storage returns []');
        passed++;
    } catch (e) {
        console.error('❌ Test 1 Failed:', e.message);
        failed++;
    }

    // Test 2: Valid JSON storage (happy path)
    try {
        global.localStorage.clear();
        const mockData = [{ id: 1, item: 'Monitor' }, { id: 2, item: 'Keyboard' }];
        global.localStorage.setItem('wms_inbound_history', JSON.stringify(mockData));
        const result = getHistory(global.localStorage);
        assert.deepStrictEqual(result, mockData, 'Should return parsed history array');
        console.log('✅ Test 2 Passed: Valid JSON returns parsed array');
        passed++;
    } catch (e) {
        console.error('❌ Test 2 Failed:', e.message);
        failed++;
    }

    // Test 3: Invalid JSON storage (error condition)
    try {
        global.localStorage.clear();
        global.localStorage.setItem('wms_inbound_history', 'INVALID JSON{[');
        let errorThrown = false;
        try {
            getHistory(global.localStorage);
        } catch (err) {
            errorThrown = true;
            assert.ok(err instanceof SyntaxError, 'Should throw SyntaxError');
        }
        assert.strictEqual(errorThrown, true, 'Should throw an error for invalid JSON');
        console.log('✅ Test 3 Passed: Invalid JSON throws error');
        passed++;
    } catch (e) {
        console.error('❌ Test 3 Failed:', e.message);
        failed++;
    }

    console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
