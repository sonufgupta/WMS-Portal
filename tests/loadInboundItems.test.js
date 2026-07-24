const fs = require('fs');
const path = require('path');

// Read app.js code
const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

describe('loadInboundItems (from app.js)', () => {
    let localStorageMock;
    let firebaseSetMock;
    let env;

    beforeEach(() => {
        firebaseSetMock = jest.fn();

        let store = {};
        localStorageMock = {
            getItem: jest.fn(key => store[key] || null),
            setItem: jest.fn((key, value) => {
                store[key] = value.toString();
            }),
            clear: jest.fn(() => {
                store = {};
            })
        };

        // Extract the code block containing inboundItems, saveInboundItems, and loadInboundItems
        const regex = /(let inboundItems = \[\];[\s\S]*?function loadInboundItems\(\) {[\s\S]*?\n    })/;
        const match = appCode.match(regex);

        if (match) {
            const extractedCode = match[1];

            const setupFn = new Function('localStorage', 'firebaseSet', `
                ${extractedCode}

                return {
                    getInboundItems: () => inboundItems,
                    setInboundItems: (val) => { inboundItems = val; },
                    loadInboundItems,
                    saveInboundItems
                };
            `);

            env = setupFn(localStorageMock, firebaseSetMock);
        } else {
            throw new Error("Could not find the target functions in app.js");
        }
    });

    it('loads items from localStorage if they exist (happy path)', () => {
        const mockItems = [{ id: 1, name: 'Item A' }];
        localStorageMock.setItem('wms_inbound_items', JSON.stringify(mockItems));

        env.loadInboundItems();

        expect(localStorageMock.getItem).toHaveBeenCalledWith('wms_inbound_items');
        expect(env.getInboundItems()).toEqual(mockItems);
        expect(firebaseSetMock).not.toHaveBeenCalled();
    });

    it('initializes to empty array and saves if nothing in localStorage (fallback test)', () => {
        env.loadInboundItems();

        expect(localStorageMock.getItem).toHaveBeenCalledWith('wms_inbound_items');
        expect(env.getInboundItems()).toEqual([]);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('wms_inbound_items', '[]');
        expect(firebaseSetMock).toHaveBeenCalledWith('inbound_items', []);
    });

    it('handles malformed JSON in localStorage by resetting to empty array', () => {
        // If JSON.parse throws, it should recover gracefully by setting empty array and saving
        localStorageMock.setItem('wms_inbound_items', 'invalid-json');

        env.loadInboundItems();

        expect(localStorageMock.getItem).toHaveBeenCalledWith('wms_inbound_items');
        expect(env.getInboundItems()).toEqual([]);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('wms_inbound_items', '[]');
        expect(firebaseSetMock).toHaveBeenCalledWith('inbound_items', []);
    });
});
