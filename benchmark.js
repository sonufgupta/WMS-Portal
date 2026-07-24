const { performance } = require('perf_hooks');

// Mock localStorage
let storage = {};
global.localStorage = {
    getItem: (key) => storage[key] || null,
    setItem: (key, val) => { storage[key] = val; }
};

// Create a large mock history array
const mockHistory = [];
for (let i = 0; i < 5000; i++) {
    mockHistory.push({
        id: `log_${i}_${Date.now()}`,
        item: `Product ${i % 100}`,
        count: 10,
        expected: 10,
        serials: Array.from({length: 10}, (_, j) => ({
            serial: `SN-${i}-${j}`,
            boxNo: 1,
            timestamp: Date.now()
        }))
    });
}

const historyStr = JSON.stringify(mockHistory);
localStorage.setItem('wms_inbound_history', historyStr);

function getHistoryBaseline() {
    const saved = localStorage.getItem('wms_inbound_history');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

let _cachedStr = null;
let _cachedObj = null;
function getHistoryOptimized() {
    const saved = localStorage.getItem('wms_inbound_history');
    if (saved) {
        if (saved === _cachedStr) {
            return _cachedObj;
        }
        _cachedStr = saved;
        _cachedObj = JSON.parse(saved);
        return _cachedObj;
    }
    return [];
}

// Warmup
for (let i = 0; i < 10; i++) {
    getHistoryBaseline();
    getHistoryOptimized();
}

const ITERATIONS = 100;

let start1 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    getHistoryBaseline();
}
let end1 = performance.now();
console.log(`Baseline (JSON.parse every time): ${end1 - start1} ms`);

let start2 = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
    getHistoryOptimized();
}
let end2 = performance.now();
console.log(`Optimized (Cached parsed obj): ${end2 - start2} ms`);
