const test = require('node:test');
const assert = require('node:assert');

// Mock browser globals to allow requiring app.js without errors
global.document = {
    addEventListener: () => {},
    documentElement: { getAttribute: () => 'light', setAttribute: () => {} },
    querySelectorAll: () => [],
    getElementById: () => null
};
global.window = {
    addEventListener: () => {},
    innerWidth: 1024
};
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};
global.navigator = { userAgent: 'test-agent' };

const { escapeHtmlAttr } = require('./app.js');

test('escapeHtmlAttr', async (t) => {
    await t.test('returns empty string for falsy values', () => {
        assert.strictEqual(escapeHtmlAttr(null), '');
        assert.strictEqual(escapeHtmlAttr(undefined), '');
        assert.strictEqual(escapeHtmlAttr(''), '');
        assert.strictEqual(escapeHtmlAttr(0), ''); // 0 is falsy
        assert.strictEqual(escapeHtmlAttr(false), ''); // false is falsy
    });

    await t.test('escapes double quotes correctly', () => {
        assert.strictEqual(escapeHtmlAttr('hello "world"'), 'hello &quot;world&quot;');
        assert.strictEqual(escapeHtmlAttr('""'), '&quot;&quot;');
        assert.strictEqual(escapeHtmlAttr('"start'), '&quot;start');
        assert.strictEqual(escapeHtmlAttr('end"'), 'end&quot;');
    });

    await t.test('leaves strings without double quotes untouched', () => {
        assert.strictEqual(escapeHtmlAttr('hello world'), 'hello world');
        assert.strictEqual(escapeHtmlAttr('hello \'world\''), 'hello \'world\''); // single quotes untouched
        assert.strictEqual(escapeHtmlAttr('hello & world'), 'hello & world'); // ampersands untouched
    });

    await t.test('handles non-string truthy values by converting to string', () => {
        assert.strictEqual(escapeHtmlAttr(123), '123');
        assert.strictEqual(escapeHtmlAttr(true), 'true');
        assert.strictEqual(escapeHtmlAttr({ toString: () => 'obj"quote' }), 'obj&quot;quote');
        assert.strictEqual(escapeHtmlAttr([1, 2]), '1,2');
    });
});
