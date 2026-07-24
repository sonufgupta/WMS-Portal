const fs = require('fs');
const path = require('path');
const assert = require('assert');

const appJsPath = path.resolve(__dirname, 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

appJs = appJs.replace(
    'checkDeviceApprovalStatus();',
    'checkDeviceApprovalStatus();\n    global.testFunctions = { saveHistory, firebaseSet };'
);

global.window = {
    addEventListener: () => {},
    innerWidth: 1024,
    location: { search: '', reload: () => {} }
};
global.firebase = {
    initializeApp: () => {},
    database: () => ({
        ref: (path) => ({
            on: () => {},
            set: (data) => {
                global.mockSetData = { path, data };
                return Promise.resolve();
            }
        })
    })
};
global.window.firebase = global.firebase;

global.document = {
    addEventListener: (event, cb) => {
        if (event === 'DOMContentLoaded') {
            global.__triggerDOMContentLoad = cb;
        }
    },
    getElementById: (id) => ({ addEventListener: () => {}, value: '', innerHTML: '', style: {} }),
    createElement: (tag) => ({ classList: { add: () => {}, remove: () => {} }, style: {} }),
    querySelector: () => null,
    querySelectorAll: () => []
};

let localStorageData = {};
global.localStorage = {
    getItem: function(key) {
        return localStorageData[key] || null;
    },
    setItem: function(key, value) {
        localStorageData[key] = String(value);
    },
    removeItem: function(key) {
        delete localStorageData[key];
    },
    clear: function() {
        localStorageData = {};
    }
};

global.navigator = { userAgent: '' };

try {
    eval(appJs);

    if (typeof global.__triggerDOMContentLoad === 'function') {
        global.__triggerDOMContentLoad();
    }

    const testFunctions = global.testFunctions;
    assert(testFunctions && typeof testFunctions.saveHistory === 'function', 'saveHistory function should be exposed');

    let localStorageSetArgs = [];
    const originalSetItem = global.localStorage.setItem;
    global.localStorage.setItem = function(key, val) {
        localStorageSetArgs = [key, val];
        originalSetItem.call(this, key, val);
    };

    // Test 1
    global.mockSetData = null;
    const historyData1 = [{ id: 1, action: 'test' }];
    testFunctions.saveHistory(historyData1);

    assert.deepStrictEqual(localStorageSetArgs, ['wms_inbound_history', JSON.stringify(historyData1)], 'localStorage.setItem called correctly');
    assert.ok(global.mockSetData, 'firebase set should be called');
    assert.strictEqual(global.mockSetData.path, 'wms_data/inbound_history', 'Firebase path should be correct');
    assert.deepStrictEqual(global.mockSetData.data, historyData1, 'Firebase data should match');

    console.log('✅ Test 1 Passed: Basic saveHistory functionality');

    // Test 2
    localStorageSetArgs = [];
    global.mockSetData = null;
    const historyData2 = [
        { sku: "SKU123", qty: 5, user: "testuser" },
        { sku: "SKU456", qty: 10, user: "testuser" }
    ];
    testFunctions.saveHistory(historyData2);

    assert.deepStrictEqual(localStorageSetArgs, ['wms_inbound_history', JSON.stringify(historyData2)], 'localStorage.setItem called correctly for complex data');
    assert.strictEqual(global.mockSetData.path, 'wms_data/inbound_history', 'Firebase path should be correct for complex data');
    assert.deepStrictEqual(global.mockSetData.data, historyData2, 'Firebase data should match for complex data');

    console.log('✅ Test 2 Passed: Complex data structures');

    // Test 3
    localStorageSetArgs = [];
    global.mockSetData = null;
    const historyData3 = [];
    testFunctions.saveHistory(historyData3);

    assert.deepStrictEqual(localStorageSetArgs, ['wms_inbound_history', JSON.stringify(historyData3)], 'localStorage.setItem called correctly for empty arrays');
    assert.strictEqual(global.mockSetData.path, 'wms_data/inbound_history', 'Firebase path should be correct for empty arrays');
    assert.deepStrictEqual(global.mockSetData.data, historyData3, 'Firebase data should match for empty arrays');

    console.log('✅ Test 3 Passed: Empty array data');

    console.log('🎉 All tests passed successfully!');
    process.exit(0);
} catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
}
