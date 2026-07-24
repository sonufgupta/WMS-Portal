const test = require('node:test');
const assert = require('node:assert');

// Mock browser objects before requiring app.js
global.document = {
    addEventListener: () => {}
};
global.window = {};
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
};

const { extractAlphabetPattern } = require('./app.js');

test('extractAlphabetPattern', async (t) => {
    await t.test('basic alphanumeric strings', () => {
        const result = extractAlphabetPattern('ABC123DEF');
        assert.deepStrictEqual(result, {
            '0': 'A',
            '1': 'B',
            '2': 'C',
            '6': 'D',
            '7': 'E',
            '8': 'F'
        });
    });

    await t.test('strings with only letters', () => {
        const result = extractAlphabetPattern('hello');
        assert.deepStrictEqual(result, {
            '0': 'H',
            '1': 'E',
            '2': 'L',
            '3': 'L',
            '4': 'O'
        });
    });

    await t.test('strings with only numbers', () => {
        const result = extractAlphabetPattern('123456');
        assert.deepStrictEqual(result, {});
    });

    await t.test('empty string', () => {
        const result = extractAlphabetPattern('');
        assert.deepStrictEqual(result, {});
    });

    await t.test('string with special characters', () => {
        const result = extractAlphabetPattern('A-B_C@1');
        assert.deepStrictEqual(result, {
            '0': 'A',
            '2': 'B',
            '4': 'C'
        });
    });

    await t.test('string with mixed cases ensuring all letters are uppercased', () => {
        const result = extractAlphabetPattern('aBcDeF');
        assert.deepStrictEqual(result, {
            '0': 'A',
            '1': 'B',
            '2': 'C',
            '3': 'D',
            '4': 'E',
            '5': 'F'
        });
    });
});
