/**
 * Warehouse Activity Portal - Application JavaScript (app.js)
 * Basic structure controls (clock, sidebar, navigation, theme toggle)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Cache upgrade check for mock data
    const existingHist = localStorage.getItem('wms_inbound_history');
    if (existingHist && !existingHist.includes("inbound_mock_1")) {
        localStorage.removeItem('wms_inbound_history');
    }

    function escapeHtmlAttr(str) {
        if (!str) return '';
        return str.replace(/"/g, '&quot;');
    }

    // --- Firebase Configuration & Realtime Sync Integration ---
    const firebaseConfig = {
        apiKey: "AIzaSyALpgMRgKEz93jKhmXRevHO0L87lDkeiCI",
        authDomain: "wms-portal-g.firebaseapp.com",
        databaseURL: "https://wms-portal-g-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "wms-portal-g",
        storageBucket: "wms-portal-g.firebasestorage.app",
        messagingSenderId: "9299535740",
        appId: "1:9299535740:web:9d2f620aa536a96d6fe6f9",
        measurementId: "G-LW16F1YZ6P"
    };

    let isFirebaseConnected = false;
    let db = null;

    if (window.firebase) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            isFirebaseConnected = true;
            console.log("Firebase Realtime Database initialized successfully!");
        } catch (err) {
            console.error("Firebase initialization failed. Falling back to local storage.", err);
        }
    } else {
        console.warn("Firebase SDK script not loaded. Running in local-only mode.");
    }

    function firebaseSet(node, data) {
        if (isFirebaseConnected && db) {
            try {
                db.ref('wms_data/' + node).set(data).catch(err => {
                    console.error("Firebase write error for node '" + node + "':", err);
                });
            } catch (err) {
                console.error("Firebase synchronous write error for node '" + node + "':", err);
            }
        }
    }

    function syncCloudDataToLocal(key, value) {
        if (value === null || value === undefined) {
            return false;
        }
        const currentLocal = localStorage.getItem(key);
        const newStr = JSON.stringify(value);
        if (currentLocal !== newStr) {
            localStorage.setItem(key, newStr);
            return true;
        }
        return false;
    }

    if (isFirebaseConnected && db) {
        // 0. Sync Reset Timestamp to clear local storage on Factory Reset
        db.ref('wms_data/reset_timestamp').on('value', (snapshot) => {
            const cloudResetTime = snapshot.val();
            if (cloudResetTime) {
                const localResetTime = parseInt(localStorage.getItem('wms_reset_timestamp')) || 0;
                if (cloudResetTime > localResetTime) {
                    localStorage.clear();
                    localStorage.setItem('wms_reset_timestamp', cloudResetTime.toString());
                    console.log("Factory reset signal received from cloud. Clearing cache...");
                    window.location.reload();
                }
            }
        });

        // 1. Sync Active Inbound Session (High Frequency, Small Size)
        db.ref('wms_data/active_inbound_session').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.removeItem('wms_active_inbound_session');
                activeSession = null;
                restoreSessionState();
            } else {
                if (syncCloudDataToLocal('wms_active_inbound_session', val)) {
                    restoreSessionState();
                    console.log("Active Inbound Session synchronized.");
                }
            }
        });

        // 2. Sync Active Outbound Session (High Frequency, Small Size)
        db.ref('wms_data/active_outbound_session').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.removeItem('wms_active_outbound_session');
                activeOutboundSession = null;
                restoreOutboundSessionState();
            } else {
                if (syncCloudDataToLocal('wms_active_outbound_session', val)) {
                    restoreOutboundSessionState();
                    console.log("Active Outbound Session synchronized.");
                }
            }
        });

        // 3. Sync Product Weights (Low Frequency, Small Size)
        db.ref('wms_data/product_weights').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_product_weights', '{}');
                renderHistoryTable();
                renderInventoryPanel();
                renderOutboundHistoryTable();
            } else {
                if (syncCloudDataToLocal('wms_product_weights', val)) {
                    renderHistoryTable();
                    renderInventoryPanel();
                    renderOutboundHistoryTable();
                    console.log("Product Weights synchronized.");
                }
            }
        });

        // 4. Sync WOS Items (Low Frequency, Small Size)
        db.ref('wms_data/wos_items').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_wos_items', '[]');
                renderWosDropdownItems();
            } else {
                if (syncCloudDataToLocal('wms_wos_items', val)) {
                    renderWosDropdownItems();
                    console.log("WOS Items synchronized.");
                }
            }
        });

        // 5. Sync Inbound Items (Low Frequency, Small Size)
        db.ref('wms_data/inbound_items').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_inbound_items', '[]');
                renderDropdownItems();
            } else {
                if (syncCloudDataToLocal('wms_inbound_items', val)) {
                    renderDropdownItems();
                    console.log("Inbound Items synchronized.");
                }
            }
        });

        // 6. Sync Inbound History (Medium Frequency, Medium Size)
        db.ref('wms_data/inbound_history').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_inbound_history', '[]');
                renderHistoryTable();
                renderInventoryPanel();
            } else {
                if (syncCloudDataToLocal('wms_inbound_history', val)) {
                    renderHistoryTable();
                    renderInventoryPanel();
                    console.log("Inbound History synchronized.");
                }
            }
        });

        // 7. Sync Outbound History (Medium Frequency, Medium Size)
        db.ref('wms_data/outbound_history').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_outbound_history', '[]');
                renderOutboundHistoryTable();
                renderInventoryPanel();
            } else {
                if (syncCloudDataToLocal('wms_outbound_history', val)) {
                    renderOutboundHistoryTable();
                    renderInventoryPanel();
                    console.log("Outbound History synchronized.");
                }
            }
        });

        // 8. Sync Deleted Serials (Trash Bin)
        db.ref('wms_data/deleted_serials').on('value', (snapshot) => {
            const val = snapshot.val();
            if (val === null) {
                localStorage.setItem('wms_deleted_serials', '[]');
                renderDeletedSerialsPanel();
            } else {
                if (syncCloudDataToLocal('wms_deleted_serials', val)) {
                    renderDeletedSerialsPanel();
                    console.log("Deleted Serials synchronized.");
                }
            }
        });
    }

    // 1. Time Widget / Local Clock
    const clockWidget = document.getElementById('headerClockWidget');
    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        if (clockWidget) {
            clockWidget.textContent = timeString;
        }
    }
    setInterval(updateClock, 1000);
    updateClock(); // Initial run

    // 2. Sidebar Navigation Click Handlers (Page Toggling)
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            if (link.id === 'navMisReport') {
                const pwd = prompt("Enter password to access MIS Reports:");
                if (pwd === '1998') {
                    window.open('https://geonix-desk.vercel.app/', '_blank');
                } else if (pwd !== null) {
                    alert("Incorrect password! Access denied.");
                }
                return;
            }
            const targetSectionId = link.id.replace('nav', 'section');
            if (targetSectionId === 'sectionInventory') {
                const isUnlocked = localStorage.getItem('wms_inventory_unlocked') === 'true';
                if (!isUnlocked) {
                    const pwd = prompt("Enter passcode to access Inventory:");
                    if (pwd === '2026' || pwd === '1998') {
                        localStorage.setItem('wms_inventory_unlocked', 'true');
                    } else {
                        if (pwd !== null) alert("Incorrect passcode! Access denied.");
                        return;
                    }
                }
            }

            // Remove active class from all navigation links
            navLinks.forEach(item => item.classList.remove('active'));
            // Add to currently clicked navigation link
            link.classList.add('active');
            // Deactivate and hide all sections
            sections.forEach(sec => {
                sec.classList.remove('active');
                sec.style.display = 'none';
            });
            
            // Activate and show target section
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.style.display = 'flex';
                // Small delay to allow CSS transitions to trigger
                setTimeout(() => {
                    targetSection.classList.add('active');
                }, 20);
            }

            if (targetSectionId === 'sectionInventory' || targetSectionId === 'sectionOverview') {
                renderInventoryPanel();
            } else if (targetSectionId === 'sectionMisReport') {
                populateMisProductsDropdown();
            }
            
            console.log(`Navigated to section: ${targetSectionId}`);
        });
    });

    // Excel Stock Report Download Handler
    const btnDownloadStockReportExcel = document.getElementById('btnDownloadStockReportExcel');
    if (btnDownloadStockReportExcel) {
        btnDownloadStockReportExcel.addEventListener('click', () => {
            if (!window.XLSX) {
                alert('Excel utility library not loaded.');
                return;
            }

            // Get current stock calculations
            const history = getHistory();
            const outboundHistory = getOutboundHistory();
            const weights = getProductWeights();

            // 1. Map outbound dispatches count by product
            const outboundCountsByProduct = {};
            outboundHistory.forEach(log => {
                if (log.serials) {
                    log.serials.forEach(s => {
                        if (!outboundCountsByProduct[s.itemName]) {
                            outboundCountsByProduct[s.itemName] = 0;
                        }
                        outboundCountsByProduct[s.itemName]++;
                    });
                }
            });

            // 2. Map inbound arrivals and box counts
            const productStock = {};
            history.forEach(log => {
                const name = log.item;
                if (log.serials && log.serials.length > 0) {
                    log.serials.forEach(s => {
                        const itemName = s.itemName || name;
                        if (!productStock[itemName]) {
                            productStock[itemName] = {
                                name: itemName,
                                inboundCount: 0,
                                boxNumbers: new Set()
                            };
                        }
                        productStock[itemName].inboundCount++;
                        if (!outboundHistory.some(ol => ol.serials && ol.serials.some(os => os.serial === s.serial))) {
                            productStock[itemName].boxNumbers.add(s.boxNo);
                        }
                    });
                } else {
                    // Support non-serial inbound
                    if (name && log.count > 0) {
                        if (!productStock[name]) {
                            productStock[name] = {
                                name: name,
                                inboundCount: 0,
                                boxNumbers: new Set()
                            };
                        }
                        productStock[name].inboundCount += log.count;
                    }
                }
            });

            // 3. Compile stock rows list
            const sheetRows = [];
            let rowIdx = 1;
            let sumPcs = 0;
            let sumBoxes = 0;
            let sumWeight = 0.0;

            Object.values(productStock).forEach(item => {
                const outboundCount = outboundCountsByProduct[item.name] || 0;
                const currentPcQty = Math.max(0, item.inboundCount - outboundCount);
                if (currentPcQty > 0) {
                    const currentBoxQty = item.boxNumbers.size;
                    const itemWeight = parseFloat(weights[item.name]) || 0;
                    const totalWeight = currentPcQty * itemWeight;

                    sheetRows.push({
                        "S.No.": rowIdx++,
                        "Product Name": item.name,
                        "Piece Quantity (PCs)": currentPcQty,
                        "Total Weight (kg)": totalWeight > 0 ? parseFloat(totalWeight.toFixed(3)) : 0
                    });

                    sumPcs += currentPcQty;
                    sumBoxes += currentBoxQty;
                    sumWeight += totalWeight;
                }
            });

            if (sheetRows.length === 0) {
                alert('No active stock items to export.');
                return;
            }

            // Append spacer row & total summary row at the bottom
            sheetRows.push({
                "S.No.": "",
                "Product Name": "",
                "Piece Quantity (PCs)": "",
                "Total Weight (kg)": ""
            });

            sheetRows.push({
                "S.No.": "",
                "Product Name": "TOTAL",
                "Piece Quantity (PCs)": sumPcs,
                "Total Weight (kg)": parseFloat(sumWeight.toFixed(3))
            });

            // Create new sheet
            const ws = XLSX.utils.json_to_sheet(sheetRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Current Stock");

            // Format Filename: mumbai stock report ( bhiwandi ) DD-MM-YYYY HH-MM-SS
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false }).replace(/\:/g, '-'); // HH-MM-SS
            const filename = `mumbai stock report ( bhiwandi ) ${dateStr} ${timeStr}`.toUpperCase() + ".xlsx";

            XLSX.writeFile(wb, filename);
        });
    }

    // Administrative Workspace Factory Reset Handler
    const btnAdminResetPortal = document.getElementById('btnAdminResetPortal');
    if (btnAdminResetPortal) {
        btnAdminResetPortal.addEventListener('click', () => {
            const pwd = prompt("Enter administrator password to factory reset and clear all workspace data:");
            if (pwd === '1998') {
                if (confirm("Are you absolutely sure? This will delete all completed Inbound history, Outbound history, product weights, items configs, and active sessions. This action CANNOT be undone!")) {
                    localStorage.removeItem('wms_inbound_history');
                    localStorage.removeItem('wms_outbound_history');
                    localStorage.removeItem('wms_product_weights');
                    localStorage.removeItem('wms_inbound_items');
                    localStorage.removeItem('wms_wos_items');
                    localStorage.removeItem('wms_active_inbound_session');
                    localStorage.removeItem('wms_active_outbound_session');
                    localStorage.removeItem('wms_deleted_serials');
                    localStorage.clear(); // Complete browser clear fallback

                    const resetTime = Date.now();
                    localStorage.setItem('wms_reset_timestamp', resetTime.toString());

                    if (isFirebaseConnected && db) {
                        const resetPayload = {
                            active_inbound_session: null,
                            active_outbound_session: null,
                            inbound_history: null,
                            outbound_history: null,
                            product_weights: null,
                            wos_items: null,
                            inbound_items: null,
                            deleted_serials: null,
                            reset_timestamp: resetTime
                        };

                        db.ref('wms_data').update(resetPayload).then(() => {
                            alert("Workspace reset successful! Reloading page...");
                            window.location.reload();
                        }).catch(err => {
                            console.error("Firebase reset error:", err);
                            alert("Firebase reset failed, but local storage was cleared. Reloading page...");
                            window.location.reload();
                        });
                    } else {
                        alert("Workspace reset successful! Reloading page...");
                        window.location.reload();
                    }
                }
            } else if (pwd !== null) {
                alert("Incorrect password! Reset authorization denied.");
            }
        });
    }

    // 3. Responsive Menu Toggle for Mobile Views
    const menuToggleButton = document.getElementById('menuToggleButton');
    const appSidebar = document.getElementById('appSidebar');

    if (menuToggleButton && appSidebar) {
        menuToggleButton.addEventListener('click', () => {
            appSidebar.classList.toggle('active');
        });

        // Close sidebar if user clicks outside on mobile view
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!appSidebar.contains(e.target) && !menuToggleButton.contains(e.target)) {
                    appSidebar.classList.remove('active');
                }
            }
        });
    }

    // 4. Dark / Light Theme Toggler
    const themeTogglerButton = document.getElementById('themeTogglerButton');
    const htmlElement = document.documentElement;

    if (themeTogglerButton) {
        themeTogglerButton.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            htmlElement.setAttribute('data-theme', newTheme);
            console.log(`Theme toggled to: ${newTheme}`);
        });
    }

    // 5. Inbound Log Session & Scanner / Sequence Logic
    const startInboundSessionBtn = document.getElementById('startInboundSessionBtn');
    const endInboundSessionBtn = document.getElementById('endInboundSessionBtn');
    const cancelActiveInboundSessionBtn = document.getElementById('cancelActiveInboundSessionBtn');
    const inboundInactiveState = document.getElementById('inboundInactiveState');
    const inboundActiveState = document.getElementById('inboundActiveState');
    
    // Modals & Controls
    const inboundConfigModal = document.getElementById('inboundConfigModal');
    const closeInboundConfigModalBtn = document.getElementById('closeInboundConfigModalBtn');
    const cancelInboundConfigModalBtn = document.getElementById('cancelInboundConfigModalBtn');
    const inboundConfigForm = document.getElementById('inboundConfigForm');
    
    const addItemModal = document.getElementById('addItemModal');
    const openAddItemModalBtnInModal = document.getElementById('openAddItemModalBtnInModal');
    const closeAddItemModalBtn = document.getElementById('closeAddItemModalBtn');
    const cancelAddItemModalBtn = document.getElementById('cancelAddItemModalBtn');
    
    const newItemForm = document.getElementById('newItemForm');
    const newItemNameInput = document.getElementById('newItemName');
    const configItemSelect = document.getElementById('configItemSelect');
    const configItemDropdownContainer = document.getElementById('configItemDropdownContainer');
    const configItemDropdownTrigger = document.getElementById('configItemDropdownTrigger');
    const configItemDropdownSelectedText = document.getElementById('configItemDropdownSelectedText');
    const configItemDropdownMenu = document.getElementById('configItemDropdownMenu');
    const configItemDropdownList = document.getElementById('configItemDropdownList');
    
    // SKU Warning Reject Modal elements
    const skuWarningModal = document.getElementById('skuWarningModal');
    const warningTitleText = document.getElementById('warningTitleText');
    const warningDescText = document.getElementById('warningDescText');
    const warningExpectedLabel = document.getElementById('warningExpectedLabel');
    const warningExpectedSku = document.getElementById('warningExpectedSku');
    const warningScannedLabel = document.getElementById('warningScannedLabel');
    const warningScannedSerial = document.getElementById('warningScannedSerial');
    const rejectScanBtn = document.getElementById('rejectScanBtn');
    const allowLengthBtn = document.getElementById('allowLengthBtn');
    const warningAddProductBtn = document.getElementById('warningAddProductBtn');
    const warningModalConfirmInput = document.getElementById('warningModalConfirmInput');
    const configSkuPatternInput = document.getElementById('configSkuPattern');
    let deletedSerialDismissTimer = null;

    const productWeightModal = document.getElementById('productWeightModal');
    const weightModalProductDesc = document.getElementById('weightModalProductDesc');
    const weightInputVal = document.getElementById('weightInputVal');
    const productWeightForm = document.getElementById('productWeightForm');
    const closeWeightModalBtn = document.getElementById('closeWeightModalBtn');
    const cancelWeightModalBtn = document.getElementById('cancelWeightModalBtn');

    // Active Session HTML details
    const activeSessionVehicle = document.getElementById('activeSessionVehicle');
    const activeSessionProgress = document.getElementById('activeSessionProgress');
    const activeSessionRowsContainer = document.getElementById('activeSessionRowsContainer');
    const sessionScannedCount = document.getElementById('sessionScannedCount');
    const sessionBoxesContainer = document.getElementById('sessionBoxesContainer');
    const inboundHistoryBody = document.getElementById('inboundHistoryBody');

    // Add Product to Active Session Modal elements
    const openAddProductToActiveSessionModalBtn = document.getElementById('openAddProductToActiveSessionModalBtn');
    const addProductToActiveSessionModal = document.getElementById('addProductToActiveSessionModal');
    const closeAddProductToActiveSessionModalBtn = document.getElementById('closeAddProductToActiveSessionModalBtn');
    const cancelAddProductToActiveSessionModalBtn = document.getElementById('cancelAddProductToActiveSessionModalBtn');
    const addProductToActiveSessionForm = document.getElementById('addProductToActiveSessionForm');
    
    // Add product custom dropdown select fields
    const activeConfigItemSelect = document.getElementById('activeConfigItemSelect');
    const activeConfigItemDropdownContainer = document.getElementById('activeConfigItemDropdownContainer');
    const activeConfigItemDropdownTrigger = document.getElementById('activeConfigItemDropdownTrigger');
    const activeConfigItemDropdownSelectedText = document.getElementById('activeConfigItemDropdownSelectedText');
    const activeConfigItemDropdownMenu = document.getElementById('activeConfigItemDropdownMenu');
    const activeConfigItemDropdownList = document.getElementById('activeConfigItemDropdownList');
    const openAddItemModalBtnInActiveModal = document.getElementById('openAddItemModalBtnInActiveModal');

    // Unified Scanning elements
    const unifiedScanForm = document.getElementById('unifiedScanForm');
    const sequenceToggle = document.getElementById('sequenceToggle');
    const unifiedSerialInput = document.getElementById('unifiedSerialInput');
    const qtyInputGroup = document.getElementById('qtyInputGroup');
    const unifiedQtyInput = document.getElementById('unifiedQtyInput');
    const unifiedScanSubmitBtn = document.getElementById('unifiedScanSubmitBtn');
    const inputLabel = document.getElementById('inputLabel');
    const inputHelper = document.getElementById('inputHelper');
    const submitBtnText = document.getElementById('submitBtnText');
    const submitBtnIcon = document.getElementById('submitBtnIcon');

    // Global Active Session State
    let activeSession = null;
    let lastRejectedSerial = '';
    let lastRejectedItemName = '';
    let lastRejectedIsSequence = false;
    let lastRejectedSeqBase = '';
    let lastRejectedSeqCount = 0;
    let selectedWeightItemName = '';

    // --- Product Weight Storage Helpers ---
    function getProductWeights() {
        const saved = localStorage.getItem('wms_product_weights');
        if (!saved) return {};
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                const dict = {};
                parsed.forEach(w => {
                    if (w && w.name) {
                        dict[w.name] = parseFloat(w.weight) || 0;
                    }
                });
                return dict;
            }
            return parsed; // Fallback to old object structure
        } catch (e) {
            return {};
        }
    }

    function saveProductWeight(itemName, weight) {
        const weights = getProductWeights();
        const parsed = parseFloat(weight);
        if (weight === null || weight === undefined || weight === '' || isNaN(parsed) || parsed <= 0) {
            delete weights[itemName];
        } else {
            weights[itemName] = parsed;
        }
        
        // Convert dictionary to array of objects to bypass Firebase path segment key restrictions
        const weightsArray = Object.keys(weights).map(name => ({
            name: name,
            weight: weights[name]
        }));
        
        localStorage.setItem('wms_product_weights', JSON.stringify(weightsArray));
        firebaseSet('product_weights', weightsArray);
    }

    // --- Auto-SKU Alphabet Pattern Extraction and Matching Helpers ---
    function extractAlphabetPattern(serial) {
        const pattern = {};
        for (let i = 0; i < serial.length; i++) {
            const char = serial[i];
            // Check if it is a letter (A-Z, a-z)
            if (/[a-zA-Z]/.test(char)) {
                pattern[i] = char.toUpperCase();
            }
        }
        return pattern;
    }

    function matchesAlphabetPattern(serial, pattern) {
        if (!pattern) return false;
        for (const index in pattern) {
            const idx = parseInt(index);
            if (idx >= serial.length) return false;
            const expectedChar = pattern[index];
            if (expectedChar !== null && expectedChar !== undefined && expectedChar !== '') {
                if (serial[idx].toUpperCase() !== expectedChar) {
                    return false;
                }
            }
        }
        return true;
    }

    function matchesAlphabetPatternPartial(serial, pattern) {
        if (!pattern) return false;
        let checkedCount = 0;
        for (const index in pattern) {
            const idx = parseInt(index);
            // Only verify if index is within scanned serial range
            if (idx < serial.length) {
                const char = serial[idx];
                const expectedChar = pattern[index];
                if (expectedChar !== null && expectedChar !== undefined && expectedChar !== '') {
                    // Only verify if the scanned serial also has a letter at this position
                    if (/[a-zA-Z]/.test(char)) {
                        checkedCount++;
                        if (char.toUpperCase() !== expectedChar) {
                            return false;
                        }
                    }
                }
            }
        }
        return checkedCount >= 3; // Ensure at least 3 letters match
    }

    function formatAlphabetPattern(pattern, length) {
        if (!pattern || length === 0) return 'Not Locked Yet';
        let str = '';
        for (let i = 0; i < length; i++) {
            if (pattern[i]) {
                str += pattern[i];
            } else {
                str += '.';
            }
        }
        return str;
    }

    // --- State Persistence & LocalStorage Helpers ---

    function saveActiveSession() {
        if (activeSession) {
            localStorage.setItem('wms_active_inbound_session', JSON.stringify(activeSession));
            firebaseSet('active_inbound_session', activeSession);
        } else {
            localStorage.removeItem('wms_active_inbound_session');
            localStorage.removeItem('wms_inbound_joined');
            firebaseSet('active_inbound_session', null);
        }
    }

    // Custom Warning Modal triggers
    function showScanWarning(type, expected, scanned, isSameProductLengthError) {
        if (!skuWarningModal) return;

        const modalContainer = skuWarningModal.querySelector('.modal-card');
        const modalHeader = skuWarningModal.querySelector('.modal-header');
        const rejectBtn = document.getElementById('rejectScanBtn');

        // Hide allowLengthBtn and warningAddProductBtn by default
        if (allowLengthBtn) {
            allowLengthBtn.style.display = 'none';
        }
        if (warningAddProductBtn) {
            warningAddProductBtn.style.display = 'none';
        }

        // Apply dynamic theme styling based on warning type
        let themeColor = 'var(--accent-rose)';
        let themeGlow = 'rgba(244, 63, 94, 0.15)';
        let btnText = 'Reject & Dismiss Scan';

        if (type === 'length') {
            if (isSameProductLengthError) {
                themeColor = 'var(--accent-amber)';
                themeGlow = 'rgba(245, 158, 11, 0.15)';
                btnText = 'Dismiss & Re-scan';

                // Display allowLengthBtn and capture state
                if (allowLengthBtn) {
                    allowLengthBtn.style.display = 'block';
                    allowLengthBtn.style.borderColor = 'var(--accent-emerald)';
                    allowLengthBtn.style.color = 'var(--accent-emerald)';
                    allowLengthBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                    allowLengthBtn.textContent = 'Allow & Save SKU Pattern';
                }

                lastRejectedSerial = scanned;
                const workstationProductSelect = document.getElementById('workstationProductSelect');
                if (activeSession.items.length === 1) {
                    lastRejectedItemName = activeSession.items[0].name;
                } else if (workstationProductSelect) {
                    lastRejectedItemName = workstationProductSelect.value;
                }
            } else {
                themeColor = 'var(--accent-rose)';
                themeGlow = 'rgba(244, 63, 94, 0.15)';
                btnText = 'Reject & Dismiss Scan';
            }
        } else if (type === 'duplicate' || type === 'duplicate-seq' || type === 'duplicate-batch') {
            themeColor = 'var(--accent-purple)';
            themeGlow = 'rgba(139, 92, 246, 0.15)';
            btnText = 'Dismiss Duplicate Scan';
        } else if (type === 'sku') {
            themeColor = 'var(--accent-rose)';
            themeGlow = 'rgba(244, 63, 94, 0.15)';
            btnText = 'Reject & Dismiss Scan';
        }

        // Apply styles to elements
        if (modalContainer) {
            modalContainer.style.borderColor = themeColor;
            modalContainer.style.boxShadow = `0 20px 50px ${themeGlow}`;
        }
        if (modalHeader) {
            modalHeader.style.color = themeColor;
        }
        if (rejectBtn) {
            rejectBtn.style.backgroundColor = themeColor;
            rejectBtn.style.borderColor = themeColor;
            rejectBtn.textContent = btnText;
        }

        if (type === 'sku') {
            warningTitleText.textContent = "Another Item Detected!";
            warningDescText.textContent = "Scanned serial barcode does not belong to this shipment item's SKU pattern.";
            warningExpectedLabel.textContent = "EXPECTED SKU FILTER:";
            warningExpectedSku.textContent = expected;
            warningScannedLabel.textContent = "SCANNED BARCODE:";
            warningScannedSerial.textContent = scanned;
        } else if (type === 'length') {
            if (isSameProductLengthError) {
                warningTitleText.textContent = "Incomplete Barcode Scan!";
                warningDescText.textContent = "Barcode letters match this product, but some characters are missing (short length).";
            } else {
                warningTitleText.textContent = "Incorrect Barcode Format!";
                warningDescText.textContent = "Scanned serial barcode length does not match the locked session length.";
            }

            warningExpectedLabel.textContent = "EXPECTED LENGTH:";
            warningExpectedSku.textContent = `${expected} Characters`;
            warningScannedLabel.textContent = "SCANNED BARCODE:";
            warningScannedSerial.textContent = `${scanned} (${scanned.length} Characters)`;
        } else if (type === 'duplicate') {
            warningTitleText.textContent = "Duplicate Barcode Detected!";
            warningDescText.textContent = "This serial barcode is already scanned in a previous Box in this session.";
            warningExpectedLabel.textContent = "ALREADY REGISTERED IN:";
            warningExpectedSku.textContent = `Box ${expected}`;
            warningScannedLabel.textContent = "DUPLICATE BARCODE:";
            warningScannedSerial.textContent = scanned;
        } else if (type === 'duplicate-seq') {
            warningTitleText.textContent = "Duplicate Barcode in Sequence!";
            warningDescText.textContent = "A generated sequence barcode matches a previously scanned item.";
            warningExpectedLabel.textContent = "CONFLICTING BOX:";
            warningExpectedSku.textContent = `Box ${expected}`;
            warningScannedLabel.textContent = "DUPLICATE BARCODE:";
            warningScannedSerial.textContent = scanned;
        } else if (type === 'duplicate-batch') {
            warningTitleText.textContent = "Duplicate in Generator Batch!";
            warningDescText.textContent = "The sequence generator created duplicate barcodes within this batch.";
            warningExpectedLabel.textContent = "CURRENT BOX:";
            warningExpectedSku.textContent = `Box ${expected}`;
            warningScannedLabel.textContent = "DUPLICATE BARCODE:";
            warningScannedSerial.textContent = scanned;
        }

        skuWarningModal.classList.add('active');
    }

    // Generic SKU Warning Modal for Outbound Workstation
    function showSkuWarningModal(title, desc, expectedLabel, expectedVal, scannedLabel, scannedVal, showAllowLengthBtn, showAddBtn, extraVal) {
        if (!skuWarningModal) return;
        if (!title.includes('Deleted') && deletedSerialDismissTimer) {
            clearTimeout(deletedSerialDismissTimer);
            deletedSerialDismissTimer = null;
        }

        const modalContainer = skuWarningModal.querySelector('.modal-card');
        const modalHeader = skuWarningModal.querySelector('.modal-header');
        const rejectBtn = document.getElementById('rejectScanBtn');

        // Apply theme styling based on warning type
        let themeColor = 'var(--accent-rose)';
        let themeGlow = 'rgba(244, 63, 94, 0.15)';
        let btnText = 'Reject & Dismiss Scan';
        if (title.includes('Duplicate')) {
            themeColor = 'var(--accent-purple)';
            themeGlow = 'rgba(139, 92, 246, 0.15)';
            btnText = 'Dismiss Duplicate Scan';
        } else if (title.includes('Incomplete')) {
            themeColor = 'var(--accent-amber)';
            themeGlow = 'rgba(245, 158, 11, 0.15)';
            btnText = 'Dismiss & Re-scan';
        } else if (title.includes('Deleted')) {
            themeColor = 'var(--accent-rose)';
            themeGlow = 'rgba(244, 63, 94, 0.15)';
            btnText = 'Reject';
        } else if (showAddBtn) {
            themeColor = 'var(--accent-rose)';
            themeGlow = 'rgba(244, 63, 94, 0.15)';
            btnText = 'Reject Scan';
        }
        if (modalContainer) {
            modalContainer.style.borderColor = themeColor;
            modalContainer.style.boxShadow = `0 20px 50px ${themeGlow}`;
        }
        if (modalHeader) {
            modalHeader.style.color = themeColor;
        }
        if (rejectBtn) {
            rejectBtn.style.backgroundColor = themeColor;
            rejectBtn.style.borderColor = themeColor;
            rejectBtn.textContent = btnText;
        }

        // Make modal card wider if adding another product to outbound session
        if (showAddBtn) {
            if (modalContainer) {
                modalContainer.style.maxWidth = '620px';
            }
            
            // Raw detected serial is passed in extraVal
            const detectedSerial = extraVal || scannedVal;
            let detectedProduct = lookupProductBySerial(detectedSerial) || lookupProductBySkuPattern(detectedSerial) || 'Unknown Product';
            
            // Find box number of the detected serial from Inbound history
            let detectedBoxNo = 'N/A';
            const inboundHistory = getHistory();
            for (const log of inboundHistory) {
                if (log.serials) {
                    const match = log.serials.find(s => s.serial === detectedSerial);
                    if (match) {
                        detectedBoxNo = match.boxNo || 'N/A';
                        break;
                    }
                }
            }

            // Find last scan details of the active outbound session
            const lastSerialObj = (activeOutboundSession && activeOutboundSession.serials.length > 0)
                ? activeOutboundSession.serials[activeOutboundSession.serials.length - 1]
                : null;
            desc = `
                <div style="font-size: 0.9rem; line-height: 1.4; color: var(--text-secondary); margin-bottom: 12px;">
                    Warning: Scanned serial barcode does not belong to any of the products currently in this outbound dispatch.
                </div>
                <div style="display: flex; gap: 16px; margin: 12px 0; width: 100%; text-align: left;">
                    <!-- Last Scan Card -->
                    <div style="flex: 1; background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.15); padding: 12px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 6px;">
                        <span style="font-size: 0.72rem; color: var(--accent-blue); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Last Session Scan</span>
                        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary); word-break: break-all; font-family: var(--font-mono);">${lastSerialObj ? lastSerialObj.serial : 'N/A'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600;">${lastSerialObj ? lastSerialObj.itemName : 'No items scanned yet'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">Box Number: <strong style="color: var(--text-secondary);">${lastSerialObj ? lastSerialObj.boxNo : 'N/A'}</strong></div>
                    </div>
                </div>
            `;
        } else {
            if (modalContainer) {
                modalContainer.style.maxWidth = '460px';
            }
        }

        if (warningTitleText) warningTitleText.textContent = title;
        if (warningDescText) warningDescText.innerHTML = desc;
        if (warningExpectedLabel) warningExpectedLabel.textContent = expectedLabel;
        if (warningExpectedSku) warningExpectedSku.textContent = expectedVal;
        if (warningScannedLabel) warningScannedLabel.textContent = scannedLabel;
        if (warningScannedSerial) warningScannedSerial.textContent = scannedVal;

        const warningExtraRow = document.getElementById('warningExtraRow');
        const warningExtraLabel = document.getElementById('warningExtraLabel');
        const warningExtraSerial = document.getElementById('warningExtraSerial');
        if (warningExtraRow && warningExtraLabel && warningExtraSerial) {
            if (extraVal) {
                warningExtraRow.style.display = 'flex';
                warningExtraLabel.textContent = 'SCANNED BARCODE:';
                warningExtraSerial.textContent = extraVal;
            } else {
                warningExtraRow.style.display = 'none';
            }
        }

        if (allowLengthBtn) {
            if (showAllowLengthBtn) {
                allowLengthBtn.style.display = 'block';
                allowLengthBtn.style.borderColor = 'var(--accent-emerald)';
                allowLengthBtn.style.color = 'var(--accent-emerald)';
                allowLengthBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
                allowLengthBtn.textContent = 'Allow & Save SKU Pattern';
            } else {
                allowLengthBtn.style.display = 'none';
            }
        }

        if (warningAddProductBtn) {
            if (showAddBtn) {
                warningAddProductBtn.style.display = 'block';
                warningAddProductBtn.style.borderColor = 'var(--accent-blue)';
                warningAddProductBtn.style.color = 'var(--accent-blue)';
                warningAddProductBtn.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                warningAddProductBtn.textContent = 'Add Product';
            } else {
                warningAddProductBtn.style.display = 'none';
            }
        }

        // Setup double-scan gesture inputs inside the warning modal
        const warningModalInputContainer = document.getElementById('warningModalInputContainer');
        if (warningModalInputContainer) {
            warningModalInputContainer.style.display = showAddBtn ? 'flex' : 'none';
        }

        if (warningModalConfirmInput) {
            warningModalConfirmInput.value = '';
            warningModalConfirmInput.onkeydown = null;
            if (showAddBtn) {
                setTimeout(() => {
                    warningModalConfirmInput.focus();
                }, 50);

                let sequenceStep = 1; 
                const lastSessionSerial = (activeOutboundSession && activeOutboundSession.serials.length > 0)
                    ? activeOutboundSession.serials[activeOutboundSession.serials.length - 1].serial
                    : null;
                const detectedSerial = extraVal || scannedVal;

                // Configure guidance label
                const guidanceLabel = document.querySelector('label[for="warningModalConfirmInput"]');
                if (guidanceLabel) {
                    if (lastSessionSerial) {
                        guidanceLabel.innerHTML = `To confirm add, scan <strong>Last Session Serial (${lastSessionSerial})</strong> first:`;
                        sequenceStep = 1;
                    } else {
                        guidanceLabel.innerHTML = `To confirm add, scan <strong>Detected Serial (${detectedSerial})</strong> to complete:`;
                        sequenceStep = 2; // skip to step 2 if no last scanned item exists
                    }
                }

                warningModalConfirmInput.onkeydown = (evt) => {
                    if (evt.key === 'Enter') {
                        evt.preventDefault();
                        const val = warningModalConfirmInput.value.trim();
                        if (!val) return;
                        
                        // 1. Check for reject scan gesture (scanning the same detected serial while in Step 1)
                        if (sequenceStep === 1 && val === detectedSerial) {
                            skuWarningModal.classList.remove('active');
                            if (deletedSerialDismissTimer) {
                                clearTimeout(deletedSerialDismissTimer);
                                deletedSerialDismissTimer = null;
                            }
                            refocusOutboundInput();
                            return;
                        }

                        // 2. Sequence verification (Step 1 or Step 2)
                        if (sequenceStep === 1) {
                            if (val === lastSessionSerial) {
                                sequenceStep = 2;
                                warningModalConfirmInput.value = '';
                                if (guidanceLabel) {
                                    guidanceLabel.innerHTML = `<span style="color: var(--accent-emerald); font-weight: 700;">Step 1 Confirmed!</span> Now scan <strong>Detected Serial (${detectedSerial})</strong> to complete:`;
                                }
                                if (warningDescText) {
                                    warningDescText.innerHTML += `<br><strong style="color: var(--accent-emerald); display: block; margin-top: 10px;">Step 1 Verified! Please scan detected serial next...</strong>`;
                                }
                                return;
                            }
                        } else if (sequenceStep === 2) {
                            if (val === detectedSerial) {
                                // Add product!
                                if (warningAddProductBtn) warningAddProductBtn.click();
                                return;
                            }
                        }
                        
                        // 3. Bypass check (if they scan another valid serial of an existing product in the session)
                        let matchedOutboundProduct = null;
                        if (activeOutboundSession) {
                            let testProduct = lookupProductBySerial(val);
                            if (!testProduct) {
                                testProduct = lookupProductBySkuPattern(val);
                            }
                            if (testProduct && activeOutboundSession.items.some(i => i.name === testProduct)) {
                                matchedOutboundProduct = testProduct;
                            }
                        }
                        
                        if (matchedOutboundProduct) {
                            // Close popup and process scan immediately
                            skuWarningModal.classList.remove('active');
                            warningModalConfirmInput.onkeydown = null;
                            if (outboundSequenceToggle && outboundSequenceToggle.checked) {
                                generateOutboundSequenceSerials(val, 5);
                            } else {
                                addOutboundSerialToSession(val);
                            }
                            return;
                        }

                        // 4. Incorrect scan alerts for sequence steps
                        if (sequenceStep === 1) {
                            warningModalConfirmInput.value = '';
                            alert(`Incorrect scan. Please scan Last Session Serial: ${lastSessionSerial} or same Detected Serial to Reject.`);
                        } else if (sequenceStep === 2) {
                            warningModalConfirmInput.value = '';
                            alert(`Incorrect scan. Please scan Detected Serial: ${detectedSerial}`);
                        }
                    }
                };
            }
        }

        skuWarningModal.classList.add('active');
    }

    function saveHistory(historyData) {
        localStorage.setItem('wms_inbound_history', JSON.stringify(historyData));
        firebaseSet('inbound_history', historyData);
    }

    function getHistory() {
        const saved = localStorage.getItem('wms_inbound_history');
        if (saved) {
            return JSON.parse(saved);
        }
        return [];
    }

    function renderHistoryTable() {
        if (!inboundHistoryBody) return;
        inboundHistoryBody.innerHTML = '';
        const historyData = getHistory();
        let needsUpdate = false;
        
        historyData.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const vehicleDisplay = row.vehicle === 'Not Specified' ? '<span class="text-muted">Not Specified</span>' : row.vehicle;
            
            // Assign unique ID to legacy mock logs if missing
            if (!row.id) {
                row.id = `log_${idx}_${Date.now()}`;
                row.items = [{ name: row.item, expectedQty: row.expected }];
                row.serials = [];
                needsUpdate = true;
                // generate dummy serials for default rows
                for (let i = 1; i <= row.count; i++) {
                    row.serials.push({
                        serial: `GXTFT185VCPB${602280 + i}`,
                        boxNo: Math.ceil(i / 5),
                        itemName: row.item
                    });
                }
            }
            
            const productWeights = getProductWeights();
            const itemsList = row.items || [{ name: row.item, expectedQty: row.expected }];
            const itemsHtml = itemsList.map(item => {
                const weight = productWeights[item.name];
                const weightLabel = weight ? ` (${weight} kg)` : ' (Set Weight)';
                const badgeStyle = weight 
                    ? 'background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: var(--accent-emerald);' 
                    : 'background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); color: var(--accent-blue);';
                
                return `
                    <button type="button" class="btn-item-weight-trigger" data-item-name="${escapeHtmlAttr(item.name)}" style="${badgeStyle} padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; transition: var(--transition-smooth); gap: 4px; margin-right: 6px; margin-bottom: 4px; border-style: solid;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 12px; height: 12px; stroke-width: 2.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1M12 20v1M4 12H3m18 0h-1M6.343 6.343l.707.707M16.95 16.95l.707.707M6.343 17.657l-.707-.707m11.314-11.314l-.707.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
                        </svg>
                        ${item.name}${weightLabel}
                    </button>
                `;
            }).join('');

            let finalBoxCount = row.boxCount;
            if ((!finalBoxCount || finalBoxCount <= 0) && row.serials && row.serials.length > 0) {
                const uniqueBoxes = new Set(row.serials.map(s => s.boxNo));
                finalBoxCount = uniqueBoxes.size;
            }
            if (!finalBoxCount || finalBoxCount < 0) {
                finalBoxCount = 0;
            }

            let countDisplay = `${row.count} PCs (${finalBoxCount} Boxes)`;
            if (row.expected > 0) {
                countDisplay = `${row.count} / ${row.expected} PCs (${finalBoxCount} Boxes)`;
            }

            tr.innerHTML = `
                <td class="font-mono">${row.timestamp}</td>
                <td>${vehicleDisplay}</td>
                <td style="max-width: 240px; white-space: normal; word-break: break-word;">${itemsHtml}</td>
                <td class="font-mono">${countDisplay}</td>
                <td>
                    <button type="button" class="btn-download-excel" data-id="${row.id}" title="Download Excel Report" style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent-emerald); color: var(--accent-emerald); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: var(--transition-smooth); border-style: solid;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px; stroke-width: 2.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Excel
                    </button>
                    <button type="button" class="btn-delete-inbound-log" data-id="${row.id}" title="Delete Inbound Session" style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: var(--accent-rose); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: var(--transition-smooth); border-style: solid; margin-left: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px; stroke-width: 2.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                    </button>
                </td>
            `;
            inboundHistoryBody.appendChild(tr);
        });

        // Save updated mock logs back to storage only if we modified them
        if (needsUpdate) {
            saveHistory(historyData);
        }
    }

    // --- Excel Report Download (SheetJS Multiple Tabs integration) ---
    function downloadLogExcel(log) {
        if (!window.XLSX) {
            alert('Excel utility library not loaded. Please verify internet connection.');
            return;
        }

        // Create new Excel Workbook
        const wb = XLSX.utils.book_new();
        
        const items = log.items || [{ name: log.item || 'Product', expectedQty: log.expected }];
        const serials = log.serials || [];

        items.forEach(item => {
            // Filter serials matching this item name
            const itemSerials = serials.filter(s => s.itemName === item.name);
            
            // Map serial data to sheet rows
            let sheetRows = [];
            if (itemSerials.length > 0) {
                sheetRows = itemSerials.map((s, idx) => ({
                    "S.No.": idx + 1,
                    "Box Number": `Box ${s.boxNo}`,
                    "Serial Number": s.serial,
                    "Product Name": s.itemName
                }));
            } else if (log.count > 0) {
                // If it is a WOS log, generate rows distributed across box count
                const boxCount = log.boxCount || 1;
                const baseQtyPerBox = Math.floor(log.count / boxCount);
                let remainder = log.count % boxCount;

                let rowIdx = 1;
                for (let b = 1; b <= boxCount; b++) {
                    const pcsInThisBox = baseQtyPerBox + (remainder > 0 ? 1 : 0);
                    remainder--;

                    for (let p = 1; p <= pcsInThisBox; p++) {
                        sheetRows.push({
                            "S.No.": rowIdx++,
                            "Box Number": `Box ${b}`,
                            "Serial Number": "Without Serial Number",
                            "Product Name": item.name
                        });
                    }
                }
            } else {
                sheetRows.push({
                    "S.No.": 1,
                    "Box Number": "N/A",
                    "Serial Number": "No serial numbers scanned",
                    "Product Name": item.name
                });
            }

            const ws = XLSX.utils.json_to_sheet(sheetRows);
            
            // Clean sheet name (SheetJS limits sheet tab names to max 31 characters)
            let sheetName = item.name.replace(/[\\\/\?\*\[\]\:]/g, "").substring(0, 30);
            if (!sheetName.trim()) {
                sheetName = "Scanned Serials";
            }

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // Generate download filename based on vehicle and timestamp
        const safeVehicle = (log.vehicle || 'Not_Specified').replace(/[^a-zA-Z0-9]/g, '_');
        const safeTime = log.timestamp.replace(/\:/g, '-');
        const filename = `Inbound_Report_${safeVehicle}_${safeTime}`.toUpperCase() + ".xlsx";

        // Write file and trigger save prompt in browser
        XLSX.writeFile(wb, filename);
        console.log(`Excel file "${filename}" downloaded successfully with ${items.length} product sheets.`);
    }

    function deleteInboundSessionFromHistory(logId) {
        if (!confirm("Are you sure you want to permanently delete this completed inbound session? All scanned serials in this session will be removed from the stock register.")) {
            return;
        }

        const historyData = getHistory();
        const updated = historyData.filter(log => log.id !== logId);
        
        saveHistory(updated);
        renderHistoryTable();
        renderInventoryPanel();
    }

    // Bind event listener to Completed logs list for Excel downloads and Deletions
    if (inboundHistoryBody) {
        inboundHistoryBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-download-excel');
            if (btn) {
                e.stopPropagation();
                const logId = btn.getAttribute('data-id');
                const historyData = getHistory();
                const logItem = historyData.find(item => item.id === logId);
                
                if (logItem) {
                    downloadLogExcel(logItem);
                } else {
                    alert('Completed log entry not found.');
                }
            }

            const deleteBtn = e.target.closest('.btn-delete-inbound-log');
            if (deleteBtn) {
                e.stopPropagation();
                const logId = deleteBtn.getAttribute('data-id');
                deleteInboundSessionFromHistory(logId);
            }
        });
    }

    // Render scanned serials grouped by Box Card inside product columns
    function renderBoxCards() {
        if (!sessionBoxesContainer) return;
        sessionBoxesContainer.innerHTML = '';

        if (!activeSession || activeSession.serials.length === 0) {
            sessionBoxesContainer.innerHTML = `
                <div id="emptyScannedState" style="text-align: center; color: var(--text-muted); padding: 48px 24px; width: 100%;">
                    No serials scanned yet. Start scanning or generating above.
                </div>
            `;
            return;
        }

        const itemsList = activeSession.items || [];

        itemsList.forEach(activeItem => {
            // Find all scanned serials belonging to this item
            const itemSerials = activeSession.serials.filter(s => s.itemName === activeItem.name);
            
            // Calculate item-specific pieces and unique boxes count
            const itemPieces = itemSerials.length;
            const uniqueBoxesSet = new Set(itemSerials.map(s => s.boxNo));
            const itemBoxes = uniqueBoxesSet.size;

            // Create column container element
            const col = document.createElement('div');
            col.className = 'product-scan-column';
            col.style.cssText = 'display: flex; flex-direction: column; gap: 16px; border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); background: rgba(255,255,255,0.01); min-width: 300px; flex: 1 1 0px; height: 100%; overflow: hidden;';

            // Column Header
            col.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;" title="${activeItem.name}">
                        ${activeItem.name}
                    </div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0;">
                        <span class="count-badge-pcs" style="font-size: 0.7rem; font-weight: 700; background: rgba(59,130,246,0.1); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(59,130,246,0.2);">
                            PCs: ${itemPieces}
                        </span>
                        <span class="count-badge-boxes" style="font-size: 0.7rem; font-weight: 700; background: rgba(16,185,129,0.1); color: var(--accent-emerald); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2);">
                            BOXes: ${itemBoxes}
                        </span>
                    </div>
                </div>
            `;

            // Scrollable list container for Box cards of this product
            const boxListWrapper = document.createElement('div');
            boxListWrapper.className = 'product-boxes-list';
            boxListWrapper.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-right: 4px; margin-top: 10px;';

            if (itemSerials.length === 0) {
                boxListWrapper.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 48px 12px;">
                        No serials scanned for this item yet.
                    </div>
                `;
            } else {
                // Group itemSerials by boxNo: { boxNo: [item1, item2] }
                const groups = {};
                itemSerials.forEach(s => {
                    if (!groups[s.boxNo]) {
                        groups[s.boxNo] = [];
                    }
                    groups[s.boxNo].push(s);
                });

                // Sort box numbers from highest to lowest (newest box on top)
                const boxNumbers = Object.keys(groups).map(Number).sort((a, b) => b - a);

                boxNumbers.forEach(boxNo => {
                    const boxItems = groups[boxNo];
                    const boxCard = document.createElement('div');
                    boxCard.className = 'box-card';
                    boxCard.style.cssText = 'margin-bottom: 0;';
                    boxCard.id = `box-card-${boxNo}-${activeItem.name.replace(/\s+/g, '-')}`;

                    // Box Card Header
                    boxCard.innerHTML = `
                        <div class="box-card-header" style="padding-bottom: 8px; margin-bottom: 8px;">
                            <div class="box-card-title">
                                <h3 style="font-size: 0.95rem;">Box ${boxNo}</h3>
                                <span class="box-badge" style="font-size: 0.7rem; padding: 2px 6px;">${boxItems.length} ${boxItems.length === 1 ? 'Item' : 'Items'}</span>
                            </div>
                            <button type="button" class="btn-delete-box" data-box="${boxNo}" data-item-name="${escapeHtmlAttr(activeItem.name)}" title="Delete items of this product from Box ${boxNo}" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    `;

                    // Serials List
                    const listContainer = document.createElement('div');
                    listContainer.className = 'box-serials-list';

                    boxItems.forEach(s => {
                        const row = document.createElement('div');
                        row.className = 'serial-item-row';
                        row.style.cssText = 'padding: 6px 8px; font-size: 0.85rem;';
                        row.innerHTML = `
                            <span class="serial-item-text font-mono">${s.serial}</span>
                            <button type="button" class="btn-delete-serial" data-serial="${s.serial}" title="Remove serial">&times;</button>
                        `;
                        listContainer.appendChild(row);
                    });

                    boxCard.appendChild(listContainer);
                    boxListWrapper.appendChild(boxCard);
                });
            }

            col.appendChild(boxListWrapper);
            sessionBoxesContainer.appendChild(col);
        });
    }

    function updateWorkstationProductSelector() {
        if (!activeSession) return;

        const workstationProductSelectorGroup = document.getElementById('workstationProductSelectorGroup');
        const workstationProductSelect = document.getElementById('workstationProductSelect');

        if (!workstationProductSelectorGroup || !workstationProductSelect) return;

        const items = activeSession.items || [];

        if (items.length > 1) {
            // Show the selector group
            workstationProductSelectorGroup.style.display = 'block';
            
            // Re-populate options, keeping current selection if valid
            const currentVal = workstationProductSelect.value;
            workstationProductSelect.innerHTML = '';

            items.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item.name;
                const patternStr = item.skuAlphabetPattern ? formatAlphabetPattern(item.skuAlphabetPattern, item.lockedLength) : 'Not Locked';
                opt.textContent = `${item.name} (${patternStr})`;
                workstationProductSelect.appendChild(opt);
            });

            // Restore selection if possible, otherwise default to first item
            const itemExists = items.some(i => i.name === currentVal);
            if (itemExists) {
                workstationProductSelect.value = currentVal;
            } else {
                workstationProductSelect.value = items[0].name;
            }
        } else {
            // Hide if single product session
            workstationProductSelectorGroup.style.display = 'none';
        }
    }

    // Load Session State on Reload
    function restoreSessionState() {
        const savedSession = localStorage.getItem('wms_active_inbound_session');
        if (savedSession) {
            activeSession = JSON.parse(savedSession);
            if (activeSession && !activeSession.items) {
                activeSession.items = [];
            }
            
            // Backward compatibility conversion of legacy format to items array format
            if (!activeSession.items && activeSession.item) {
                activeSession.items = [{
                    name: activeSession.item,
                    expectedQty: activeSession.expectedQty || 10,
                    skuAlphabetPattern: activeSession.skuAlphabetPattern || null,
                    lockedLength: activeSession.lockedLength || null,
                    scannedCount: activeSession.serials ? activeSession.serials.length : 0
                }];
            }

            // Lock and update active session display labels
            if (activeSessionVehicle) {
                activeSessionVehicle.textContent = activeSession.vehicle || 'Not Specified';
            }

            // Sanitize activeSession.items properties to prevent undefined/NaN errors
            if (activeSession.items) {
                activeSession.items.forEach(item => {
                    if (item) {
                        item.expectedQty = parseInt(item.expectedQty) || 0;
                        if (item.skuAlphabetPattern && !item.allowedPatterns) {
                            item.allowedPatterns = [{
                                pattern: item.skuAlphabetPattern,
                                length: item.lockedLength || 15
                            }];
                        }
                        if (item.allowedPatterns) {
                            item.allowedPatterns = item.allowedPatterns.filter(cfg => cfg && cfg.length <= 50);
                        }
                        if (item.lockedLength > 50) {
                            item.lockedLength = null;
                            item.skuAlphabetPattern = null;
                            if (item.allowedPatterns) {
                                item.allowedPatterns = item.allowedPatterns.filter(cfg => cfg && cfg.length <= 50);
                            }
                        }
                    }
                });
            }

            if (!activeSession.serials) {
                activeSession.serials = [];
            }

            // Convert old string-array format to object-array format if loaded from old cache
            if (activeSession.serials && activeSession.serials.length > 0) {
                activeSession.serials = activeSession.serials.map((item, index) => {
                    if (typeof item === 'string') {
                        return { serial: item, boxNo: index + 1, itemName: activeSession.items[0].name };
                    }
                    if (!item.itemName) {
                        item.itemName = activeSession.items[0].name;
                    }
                    return item;
                });
            }

            if (activeSession.serials) {
                activeSession.serials = activeSession.serials.filter(s => s && s.serial && s.serial.length <= 50);
            }

            compactBoxNumbers();
            updateSessionProgress();
            updateWorkstationProductSelector();
            
            // Render restored cards
            renderBoxCards();
            // Check join authorization
            const isJoined = localStorage.getItem('wms_inbound_joined') === 'true';
            if (isJoined) {
                inboundInactiveState.style.display = 'none';
                inboundActiveState.style.display = 'flex';
            } else {
                inboundActiveState.style.display = 'none';
                inboundInactiveState.style.display = 'block';
                // Show warning banner and hide start button/welcome
                const banner = document.getElementById('inboundAlreadyWorkingBanner');
                const welcome = document.getElementById('inboundWelcomeContainer');
                if (banner) banner.style.display = 'flex';
                if (welcome) welcome.style.display = 'none';
            }
        } else {
            localStorage.removeItem('wms_inbound_joined');
            inboundActiveState.style.display = 'none';
            inboundInactiveState.style.display = 'block';
            const banner = document.getElementById('inboundAlreadyWorkingBanner');
            const welcome = document.getElementById('inboundWelcomeContainer');
            if (banner) banner.style.display = 'none';
            if (welcome) welcome.style.display = 'flex';
        }
        renderHistoryTable();
    }

    // --- Modal Configuration Handlers ---
    // Open Inbound Configuration Modal or block if active session exists on another device
    if (startInboundSessionBtn && inboundConfigModal) {
        startInboundSessionBtn.addEventListener('click', () => {
            if (activeSession) {
                // If there's an active session on another device, click acts as Join Session prompt
                const pwd = prompt('Enter passcode (2026) to join the active Inbound session:');
                if (pwd === '2026') {
                    localStorage.setItem('wms_inbound_joined', 'true');
                    restoreSessionState();
                } else {
                    alert('Incorrect passcode.');
                }
            } else {
                inboundConfigModal.classList.add('active');
            }
        });
    }

    // Join Inbound Session Event Listener
    const btnJoinInboundSession = document.getElementById('btnJoinInboundSession');
    if (btnJoinInboundSession) {
        btnJoinInboundSession.addEventListener('click', () => {
            const pwd = prompt('Enter passcode (2026) to join the active Inbound session:');
            if (pwd === '2026') {
                localStorage.setItem('wms_inbound_joined', 'true');
                restoreSessionState();
            } else {
                alert('Incorrect passcode.');
            }
        });
    }
    // --- Custom Dropdown Item List Logic ---
    let inboundItems = [];

    function saveInboundItems() {
        localStorage.setItem('wms_inbound_items', JSON.stringify(inboundItems));
        firebaseSet('inbound_items', inboundItems);
    }

    function loadInboundItems() {
        const saved = localStorage.getItem('wms_inbound_items');
        if (saved) {
            inboundItems = JSON.parse(saved);
        } else {
            inboundItems = [];
            saveInboundItems();
        }
    }

    function renderDropdownItems() {
        if (!configItemDropdownList) return;
        configItemDropdownList.innerHTML = '';

        inboundItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-item';
            li.setAttribute('data-value', item);
            
            li.innerHTML = `
                <span class="custom-dropdown-item-text">${item}</span>
                <button type="button" class="btn-delete-dropdown-item" data-item="${item}" title="Delete Item">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;

            // Selection trigger on text click
            const textSpan = li.querySelector('.custom-dropdown-item-text');
            if (textSpan) {
                textSpan.addEventListener('click', () => {
                    selectDropdownItem(item);
                    closeDropdownMenu();
                });
            }

            // Secure deletion trigger on delete button click
            const deleteBtn = li.querySelector('.btn-delete-dropdown-item');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Avoid triggering trigger toggle or selection click
                    
                    const pwd = prompt(`Enter password to delete item "${item}":`);
                    if (pwd === '2026') {
                        inboundItems = inboundItems.filter(i => i !== item);
                        saveInboundItems();
                        renderDropdownItems();
                        
                        // Reset if active item was deleted
                        if (configItemSelect && configItemSelect.value === item) {
                            configItemSelect.value = '';
                            if (configItemDropdownSelectedText) configItemDropdownSelectedText.textContent = 'Choose an item...';
                        }
                    } else if (pwd !== null) {
                        alert('Incorrect password! Item was not deleted.');
                    }
                });
            }

            configItemDropdownList.appendChild(li);
        });
    }

    function selectDropdownItem(item) {
        if (configItemSelect) configItemSelect.value = item;
        if (configItemDropdownSelectedText) configItemDropdownSelectedText.textContent = item;
    }

    function toggleDropdownMenu() {
        if (configItemDropdownContainer) {
            configItemDropdownContainer.classList.toggle('active');
        }
    }

    // Close Dropdown Menu Helper
    function closeDropdownMenu() {
        if (configItemDropdownContainer) {
            configItemDropdownContainer.classList.remove('active');
        }
    }

    // Bind trigger toggle click
    if (configItemDropdownTrigger) {
        configItemDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdownMenu();
        });
    }



    // Initialize custom dropdown
    loadInboundItems();
    renderDropdownItems();

    // Close Inbound Configuration Modal
    function closeConfigModal() {
        if (inboundConfigModal) {
            inboundConfigModal.classList.remove('active');
            inboundConfigForm.reset();
            // Reset custom selection state
            if (configItemSelect) configItemSelect.value = '';
            if (configItemDropdownSelectedText) configItemDropdownSelectedText.textContent = 'Choose an item...';
            closeDropdownMenu();
        }
    }
    if (closeInboundConfigModalBtn) closeInboundConfigModalBtn.addEventListener('click', closeConfigModal);
    if (cancelInboundConfigModalBtn) cancelInboundConfigModalBtn.addEventListener('click', closeConfigModal);

    // Open Add Item Modal from config
    if (openAddItemModalBtnInModal && addItemModal) {
        openAddItemModalBtnInModal.addEventListener('click', () => {
            addItemModal.classList.add('active');
            if (newItemNameInput) newItemNameInput.focus();
        });
    }

    // Close Add Item Modal
    function closeAddItemModal() {
        if (addItemModal) {
            addItemModal.classList.remove('active');
            newItemForm.reset();
        }
    }
    if (closeAddItemModalBtn) closeAddItemModalBtn.addEventListener('click', closeAddItemModal);
    if (cancelAddItemModalBtn) cancelAddItemModalBtn.addEventListener('click', closeAddItemModal);
    
    // Save New Item and Add to selector dropdown
    if (newItemForm && newItemNameInput) {
        newItemForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const itemName = newItemNameInput.value.trim();
            if (itemName) {
                if (!inboundItems.includes(itemName)) {
                    inboundItems.push(itemName);
                    saveInboundItems();
                    renderDropdownItems();
                }
                selectDropdownItem(itemName);
                closeAddItemModal();
            }
        });
    }

    // Close Modals & Dropdowns on Outer Click
    window.addEventListener('click', (e) => {
        if (e.target === inboundConfigModal) closeConfigModal();
        if (e.target === addItemModal) closeAddItemModal();
        if (e.target === addProductToActiveSessionModal) closeActiveProductModal();
        if (e.target === productWeightModal) closeWeightModal();
        
        if (configItemDropdownContainer && !configItemDropdownContainer.contains(e.target)) {
            closeDropdownMenu();
        }
        if (activeConfigItemDropdownContainer && !activeConfigItemDropdownContainer.contains(e.target)) {
            closeActiveDropdownMenu();
        }
    });

    // Close Active Product Modal Helper
    function closeActiveProductModal() {
        if (addProductToActiveSessionModal) {
            addProductToActiveSessionModal.classList.remove('active');
            addProductToActiveSessionForm.reset();
            if (activeConfigItemSelect) activeConfigItemSelect.value = '';
            if (activeConfigItemDropdownSelectedText) activeConfigItemDropdownSelectedText.textContent = 'Choose an item...';
            closeActiveDropdownMenu();
        }
    }

    // Confirm and Start Session
    if (inboundConfigForm) {
        inboundConfigForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const vehicleVal = document.getElementById('configVehicleNo').value.trim();
            const itemVal = configItemSelect.value;
            const parsed = parseInt(document.getElementById('configExpectedQty').value);
            const expectedQtyVal = isNaN(parsed) ? 0 : parsed;

            if (!itemVal) {
                alert('Please select an item first.');
                return;
            }

            // Initialize Active Session with items array format
            activeSession = {
                vehicle: vehicleVal || 'Not Specified',
                items: [{
                    name: itemVal,
                    expectedQty: expectedQtyVal,
                    skuAlphabetPattern: null,
                    lockedLength: null,
                    scannedCount: 0
                }],
                serials: []
            };

            // Lock and update active session display
            if (activeSessionVehicle) activeSessionVehicle.textContent = activeSession.vehicle;
            updateSessionProgress();
            
            // Render empty box cards container
            renderBoxCards();
            // Toggle dashboard states & set joined status
            localStorage.setItem('wms_inbound_joined', 'true');
            inboundInactiveState.style.display = 'none';
            inboundActiveState.style.display = 'flex';
            
            // Save state to localStorage
            saveActiveSession();
            // Cleanup modals & autofocus unified scan input
            closeConfigModal();
            setTimeout(() => {
                if (unifiedSerialInput) unifiedSerialInput.focus();
            }, 100);
        });
    }

    // Update progress numbers and count badge
    function updateSessionProgress() {
        if (!activeSession) return;

        // Ensure activeSession.items exists (fallback conversion)
        if (!activeSession.items && activeSession.item) {
            activeSession.items = [{
                name: activeSession.item,
                expectedQty: activeSession.expectedQty || 10,
                skuAlphabetPattern: activeSession.skuAlphabetPattern || null,
                lockedLength: activeSession.lockedLength || null,
                scannedCount: 0
            }];
        }

        const items = activeSession.items || [];
        
        let totalExpected = 0;
        let totalScanned = 0;
        
        items.forEach(item => {
            totalExpected += parseInt(item.expectedQty) || 0;
            // Count scanned serials for this product
            const itemScans = activeSession.serials.filter(s => s.itemName === item.name).length;
            item.scannedCount = itemScans;
            totalScanned += itemScans;
        });

        // Set total session progress text
        if (activeSessionProgress) {
            if (totalExpected > 0) {
                activeSessionProgress.textContent = `${totalScanned} / ${totalExpected} Scanned`;
            } else {
                activeSessionProgress.textContent = `${totalScanned} Scanned`;
            }
        }
        
        // Pieces count
        const sessionScannedCount = document.getElementById('sessionScannedCount');
        if (sessionScannedCount) sessionScannedCount.textContent = totalScanned;

        // Boxes count
        const sessionScannedBoxesCount = document.getElementById('sessionScannedBoxesCount');
        if (sessionScannedBoxesCount) {
            let totalBoxesCount = 0;
            items.forEach(activeItem => {
                const itemSerials = activeSession.serials.filter(s => s.itemName === activeItem.name);
                const uniqueBoxes = new Set(itemSerials.map(s => s.boxNo));
                totalBoxesCount += uniqueBoxes.size;
            });
            sessionScannedBoxesCount.textContent = totalBoxesCount;
        }

        // Render table rows inside activeSessionRowsContainer
        if (activeSessionRowsContainer) {
            activeSessionRowsContainer.innerHTML = '';
            
            items.forEach(item => {
                const tr = document.createElement('tr');
                tr.style.cssText = 'border-bottom: 1px solid rgba(255, 255, 255, 0.05); font-size: 0.9rem;';
                
                const progressColor = item.expectedQty > 0 
                    ? (item.scannedCount >= item.expectedQty ? 'var(--accent-emerald)' : 'var(--text-secondary)')
                    : 'var(--accent-blue)';
                
                // Initialize allowedPatterns if missing (legacy recovery)
                if (!item.allowedPatterns) {
                    item.allowedPatterns = item.skuAlphabetPattern ? [{
                        pattern: item.skuAlphabetPattern,
                        length: item.lockedLength || 15
                    }] : [];
                }

                // Get accepted lengths list
                const lengthsList = item.allowedPatterns.map(cfg => cfg.length);
                const lengthVal = lengthsList.length > 0 ? `${lengthsList.join(', ')} Chars` : 'Not Locked Yet';
                
                const patternStyle = 'background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: var(--accent-blue); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8rem; font-family: var(--font-mono); display: block; margin-bottom: 4px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';

                let patternCellHtml = '';
                if (item.allowedPatterns.length > 0) {
                    const badgesHtml = item.allowedPatterns.map(cfg => {
                        const patStr = formatAlphabetPattern(cfg.pattern, cfg.length);
                        return `<span style="${patternStyle}" title="${patStr}">${patStr}</span>`;
                    }).join('');
                    
                    patternCellHtml = `
                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 250px; overflow: hidden;">
                            ${badgesHtml}
                            <button type="button" class="btn-add-alternative-sku" title="Add alternative accepted SKU pattern structure" style="background: rgba(59, 130, 246, 0.15); border: 1px solid var(--accent-blue); color: var(--accent-blue); cursor: pointer; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; transition: var(--transition-smooth); white-space: nowrap; margin-top: 2px;">
                                + SKU
                            </button>
                        </div>
                    `;
                } else {
                    patternCellHtml = `<span style="color: var(--text-muted); font-style: italic; font-size: 0.85rem;">Not Locked Yet</span>`;
                }

                let progressText = `<span style="color: ${progressColor}; font-weight: 700;">${item.scannedCount}</span> / ${item.expectedQty} Scanned`;
                if (item.expectedQty === 0) {
                    progressText = `<span style="color: ${progressColor}; font-weight: 700;">${item.scannedCount}</span> Scanned`;
                }

                tr.innerHTML = `
                    <td style="padding: 12px 8px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0;">
                        <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;" title="${item.name}">${item.name}</span>
                        <button type="button" class="btn-delete-active-item" data-item-name="${escapeHtmlAttr(item.name)}" title="Remove this product from session" style="background: none; border: none; color: var(--accent-rose); cursor: pointer; padding: 2px; display: flex; align-items: center;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px;">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </td>
                    <td style="padding: 12px 8px; color: var(--text-secondary);" class="font-mono">
                        ${progressText}
                    </td>
                    <td style="padding: 12px 8px; color: var(--text-secondary);" class="font-mono">
                        ${lengthVal}
                    </td>
                    <td style="padding: 12px 8px;">
                        ${patternCellHtml}
                    </td>
                `;

                // Bind add alternative SKU pattern button click
                const addSkuBtn = tr.querySelector('.btn-add-alternative-sku');
                if (addSkuBtn) {
                    addSkuBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        const pwd = prompt(`Enter password to authorize adding a new SKU pattern structure (e.g. 2026):`);
                        if (pwd === '2026') {
                            const refSerial = prompt(`Scan or enter a reference serial number representing the new SKU format for "${item.name}":`);
                            if (refSerial) {
                                const cleanRef = refSerial.trim();
                                if (cleanRef) {
                                    const newPattern = extractAlphabetPattern(cleanRef);
                                    const newConfig = { pattern: newPattern, length: cleanRef.length };
                                    
                                    if (!item.allowedPatterns) {
                                        item.allowedPatterns = item.skuAlphabetPattern ? [{
                                            pattern: item.skuAlphabetPattern,
                                            length: item.lockedLength || 15
                                        }] : [];
                                    }
                                    
                                    // Avoid duplicates
                                    const exists = item.allowedPatterns.some(cfg => {
                                        return cfg.length === cleanRef.length && matchesAlphabetPattern(cleanRef, cfg.pattern);
                                    });
                                    
                                    if (!exists) {
                                        item.allowedPatterns.push(newConfig);
                                        // update legacy fields for safety
                                        item.skuAlphabetPattern = newPattern;
                                        item.lockedLength = cleanRef.length;
                                        
                                        updateSessionProgress();
                                        saveActiveSession();
                                        alert(`Success! Registered new SKU format of ${cleanRef.length} characters.`);
                                    } else {
                                        alert('This exact SKU format/length is already registered.');
                                    }
                                }
                            }
                        } else if (pwd !== null) {
                            alert('Incorrect password! Access denied.');
                        }
                    });
                }

                // Bind active item deletion click listener
                const deleteBtn = tr.querySelector('.btn-delete-active-item');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        
                        if (activeSession.items.length <= 1) {
                            alert('Cannot delete the last remaining product in the session. Please use "Cancel Session" if you want to discard the entire session.');
                            return;
                        }

                        const pwd = prompt(`Enter password to delete "${item.name}" from active session:`);
                        if (pwd === '2026') {
                            // 1. Remove product item
                            activeSession.items = activeSession.items.filter(i => i.name !== item.name);
                            
                            // 2. Remove all serials scanned under this product item
                            activeSession.serials = activeSession.serials.filter(s => s.itemName !== item.name);

                            // 3. Compact box numbers sequentially
                            compactBoxNumbers();

                            // 4. Update UI & Save
                            updateSessionProgress();
                            updateWorkstationProductSelector();
                            renderBoxCards();
                            saveActiveSession();
                        } else if (pwd !== null) {
                            alert('Incorrect password! Product was not deleted.');
                        }
                    });
                }

                activeSessionRowsContainer.appendChild(tr);
            });
        }
    }

    // --- Toggle switch event for Sequence Mode ---
    if (sequenceToggle) {
        sequenceToggle.addEventListener('change', () => {
            const isSequenceMode = sequenceToggle.checked;
            if (isSequenceMode) {
                // Show quantity field
                if (qtyInputGroup) qtyInputGroup.style.display = 'block';
                if (inputLabel) inputLabel.textContent = 'Base Serial Code';
                if (unifiedSerialInput) unifiedSerialInput.placeholder = 'e.g. B1 or SN_001';
                if (inputHelper) inputHelper.textContent = 'System will read trailing digits to auto-generate sequence';
                if (submitBtnText) submitBtnText.textContent = 'Generate Sequence';
                if (submitBtnIcon) {
                    submitBtnIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    `;
                }
            } else {
                // Hide quantity field
                if (qtyInputGroup) qtyInputGroup.style.display = 'none';
                if (inputLabel) inputLabel.textContent = 'Scan Serial Number';
                if (unifiedSerialInput) unifiedSerialInput.placeholder = 'Scan barcode with reader or type here...';
                if (inputHelper) inputHelper.textContent = 'Press Enter key to save immediately';
                if (submitBtnText) submitBtnText.textContent = 'Scan Item';
                if (submitBtnIcon) {
                    submitBtnIcon.innerHTML = `
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    `;
                }
            }
            if (unifiedSerialInput) unifiedSerialInput.focus();
        });
    }

    // --- Add Scanned Serial Helper (with Length Locking & SKU Verification) ---
    function addSerialToSession(serial, targetBoxNo) {
        if (!activeSession) return false;
        
        lastRejectedIsSequence = false;

        // Clean serial number
        const cleanSerial = serial.trim();
        if (!cleanSerial) return false;

        if (cleanSerial.length > 50) {
            alert(`Scan rejected! Serial number is too long (${cleanSerial.length} characters). Max allowed length is 50 characters.`);
            return false;
        }

        const items = activeSession.items || [];
        if (items.length === 0) return false;

        // Strictly route the scanned serial to the selected product in the workstation
        let matchedItem = null;
        if (items.length === 1) {
            matchedItem = items[0];
        } else {
            const workstationProductSelect = document.getElementById('workstationProductSelect');
            if (workstationProductSelect && workstationProductSelect.value) {
                const selectedVal = workstationProductSelect.value;
                matchedItem = items.find(i => i.name === selectedVal);
            }
        }

        if (!matchedItem) {
            alert('No target product identified for scan validation.');
            return false;
        }

        // Initialize allowedPatterns if missing (legacy recovery)
        if (!matchedItem.allowedPatterns) {
            matchedItem.allowedPatterns = matchedItem.skuAlphabetPattern ? [{
                pattern: matchedItem.skuAlphabetPattern,
                length: matchedItem.lockedLength || 15
            }] : [];
        }

        // --- LOCK PATTERN IF FIRST SCAN ---
        if (matchedItem.allowedPatterns.length === 0) {
            const pattern = extractAlphabetPattern(cleanSerial);
            matchedItem.allowedPatterns = [{
                pattern: pattern,
                length: cleanSerial.length
            }];
            // Keep legacy fields updated for safety
            matchedItem.skuAlphabetPattern = pattern;
            matchedItem.lockedLength = cleanSerial.length;
            console.log(`Auto-locked SKU pattern for "${matchedItem.name}":`, pattern);
        }

        // Count current scans for this matched product
        const matchedItemScans = activeSession.serials.filter(s => s.itemName === matchedItem.name).length;

        // Check if this specific item has reached its expected quantity (only if expectedQty > 0)
        if (matchedItem.expectedQty > 0 && matchedItemScans >= matchedItem.expectedQty) {
            alert(`Cannot scan more pieces of "${matchedItem.name}"! You have already reached the expected quantity limit of ${matchedItem.expectedQty} for this product.`);
            return false;
        }

        // Check if barcode matches any allowed pattern configuration strictly
        const isStrictMatch = matchedItem.allowedPatterns.some(cfg => {
            return cleanSerial.length === cfg.length && matchesAlphabetPattern(cleanSerial, cfg.pattern);
        });

        if (!isStrictMatch) {
            // Check if barcode partially matches any configured pattern
            const isPartialMatch = matchedItem.allowedPatterns.some(cfg => {
                return matchesAlphabetPatternPartial(cleanSerial, cfg.pattern);
            });

            if (isPartialMatch) {
                const expectedStr = matchedItem.allowedPatterns.map(cfg => cfg.length).join(', ');
                showScanWarning('length', expectedStr, cleanSerial, true);
            } else {
                const firstConfig = matchedItem.allowedPatterns[0];
                const expectedPatternStr = firstConfig ? formatAlphabetPattern(firstConfig.pattern, firstConfig.length) : 'Any Pattern';
                showScanWarning('sku', expectedPatternStr, cleanSerial);
            }
            return false;
        }

        // Check for duplicates across session
        const serialsList = activeSession.serials.map(item => item.serial);
        if (serialsList.includes(cleanSerial)) {
            const foundItem = activeSession.serials.find(item => item.serial === cleanSerial);
            showScanWarning('duplicate', foundItem.boxNo, cleanSerial);
            return false;
        }

        // Determine Box Number (Product-Specific)
        let boxNo;
        if (targetBoxNo !== undefined) {
            boxNo = targetBoxNo;
        } else {
            const itemSerials = activeSession.serials.filter(s => s.itemName === matchedItem.name);
            const maxBoxNo = itemSerials.reduce((max, item) => item.boxNo > max ? item.boxNo : max, 0);
            boxNo = maxBoxNo + 1;
        }

        // Push to active serial list
        activeSession.serials.push({ serial: cleanSerial, boxNo: boxNo, itemName: matchedItem.name });

        // Update stats, re-render cards, and save active session state
        renderBoxCards();
        updateSessionProgress();
        saveActiveSession();
        return true;
    }

    // Compact box numbers sequentially per product
    function compactBoxNumbers() {
        if (!activeSession) return;
        const items = activeSession.items || [];
        items.forEach(activeItem => {
            const itemSerials = activeSession.serials.filter(s => s.itemName === activeItem.name);
            const uniqueBoxes = [];
            itemSerials.forEach(s => {
                if (!uniqueBoxes.includes(s.boxNo)) {
                    uniqueBoxes.push(s.boxNo);
                }
            });
            uniqueBoxes.sort((a, b) => a - b);
            
            activeSession.serials.forEach(s => {
                if (s.itemName === activeItem.name) {
                    s.boxNo = uniqueBoxes.indexOf(s.boxNo) + 1;
                }
            });
        });
    }

    // Compact Outbound box numbers sequentially per product
    function compactOutboundBoxNumbers() {
        if (!activeOutboundSession) return;
        const items = activeOutboundSession.items || [];
        items.forEach(activeItem => {
            const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === activeItem.name);
            const uniqueBoxes = [];
            itemSerials.forEach(s => {
                if (!uniqueBoxes.includes(s.boxNo)) {
                    uniqueBoxes.push(s.boxNo);
                }
            });
            uniqueBoxes.sort((a, b) => a - b);
            
            activeOutboundSession.serials.forEach(s => {
                if (s.itemName === activeItem.name) {
                    s.boxNo = uniqueBoxes.indexOf(s.boxNo) + 1;
                }
            });
        });
    }

    // Automatically check and unlock length and pattern for any product that has no scans left
    function checkAndUnlockProducts() {
        if (!activeSession) return;
        const items = activeSession.items || [];
        items.forEach(item => {
            const scansCount = activeSession.serials.filter(s => s.itemName === item.name).length;
            if (scansCount === 0) {
                item.lockedLength = null;
                item.skuAlphabetPattern = null;
                item.allowedPatterns = [];
            }
        });
    }

    // Deletion Listeners for Box Cards and Serials
    if (sessionBoxesContainer) {
        sessionBoxesContainer.addEventListener('click', (e) => {
            // 1. Delete individual serial
            const deleteSerialBtn = e.target.closest('.btn-delete-serial');
            if (deleteSerialBtn && activeSession) {
                const serialToRemove = deleteSerialBtn.getAttribute('data-serial');
                
                activeSession.serials = activeSession.serials.filter(s => s.serial !== serialToRemove);
                
                // Unlock length/pattern if scans drop to 0
                checkAndUnlockProducts();

                compactBoxNumbers();
                renderBoxCards();
                updateSessionProgress();
                saveActiveSession();
                return;
            }

            // 2. Delete entire Box (or Box items for a specific product)
            const deleteBoxBtn = e.target.closest('.btn-delete-box');
            if (deleteBoxBtn && activeSession) {
                const boxToRemove = parseInt(deleteBoxBtn.getAttribute('data-box'));
                const itemName = deleteBoxBtn.getAttribute('data-item-name');
                
                let confirmMsg = `Are you sure you want to delete entire Box ${boxToRemove} and all its serial numbers?`;
                if (itemName) {
                    confirmMsg = `Are you sure you want to delete all serial numbers of "${itemName}" from Box ${boxToRemove}?`;
                }

                if (confirm(confirmMsg)) {
                    if (itemName) {
                        activeSession.serials = activeSession.serials.filter(s => !(s.boxNo === boxToRemove && s.itemName === itemName));
                    } else {
                        activeSession.serials = activeSession.serials.filter(s => s.boxNo !== boxToRemove);
                    }
                    
                    // Unlock length/pattern if scans drop to 0
                    checkAndUnlockProducts();

                    compactBoxNumbers();
                    renderBoxCards();
                    updateSessionProgress();
                    saveActiveSession();
                    return;
                }
            }
        });
    }

    // Clear all scanned serials in Inbound Session
    const clearAllInboundSerialsBtn = document.getElementById('clearAllInboundSerialsBtn');
    if (clearAllInboundSerialsBtn) {
        clearAllInboundSerialsBtn.addEventListener('click', () => {
            if (!activeSession || activeSession.serials.length === 0) {
                alert('No serials to clear.');
                return;
            }
            if (confirm('Are you sure you want to clear all scanned serials from this active inbound session?')) {
                activeSession.serials = [];
                checkAndUnlockProducts();
                renderBoxCards();
                updateSessionProgress();
                saveActiveSession();
            }
        });
    }

    // Submit Unified Scan / Sequence Generator Form
    if (unifiedScanForm) {
        unifiedScanForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = unifiedSerialInput.value.trim();
            if (!inputVal) return;

            const isSequenceMode = sequenceToggle ? sequenceToggle.checked : false;

            if (!isSequenceMode) {
                // --- Single Scan Mode ---
                if (inputVal.includes(',')) {
                    const serials = inputVal.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    let allSuccess = true;
                    for (const s of serials) {
                        const success = addSerialToSession(s);
                        if (!success) {
                            allSuccess = false;
                            break; // Stop loop if a warning/alert is triggered
                        }
                    }
                    if (allSuccess) {
                        unifiedSerialInput.value = '';
                    }
                } else {
                    const success = addSerialToSession(inputVal);
                    if (success) {
                        unifiedSerialInput.value = '';
                    }
                }
                if (unifiedSerialInput) unifiedSerialInput.focus();
            } else {
                // --- Sequence Generator Mode ---
                const baseCode = inputVal;
                const count = parseInt(unifiedQtyInput.value);
                generateSequenceSerials(baseCode, count);
            }
        });
    }

    function generateSequenceSerials(baseCode, count) {
        if (!activeSession) return;
        if (count < 1) return;

        // Find targeted product for sequence generator
        let matchedItem = null;
        const workstationProductSelect = document.getElementById('workstationProductSelect');
        if (activeSession.items.length === 1) {
            matchedItem = activeSession.items[0];
        } else if (workstationProductSelect && workstationProductSelect.value) {
            const selectedVal = workstationProductSelect.value;
            matchedItem = activeSession.items.find(i => i.name === selectedVal);
        }

        if (!matchedItem) {
            alert('No active scanning product selected.');
            return;
        }

        // Initialize allowedPatterns if missing (legacy recovery)
        if (!matchedItem.allowedPatterns) {
            matchedItem.allowedPatterns = matchedItem.skuAlphabetPattern ? [{
                pattern: matchedItem.skuAlphabetPattern,
                length: matchedItem.lockedLength || 15
            }] : [];
        }

        const baseCodes = baseCode.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (baseCodes.length === 0) return;

        // We will collect all generated serials across all base codes to validate and insert them
        const allTempSerials = []; // Array of { serial, boxNo }
        
        const itemSerials = activeSession.serials.filter(s => s.itemName === matchedItem.name);
        let maxBoxNo = itemSerials.reduce((max, item) => item.boxNo > max ? item.boxNo : max, 0);

        // Track how many scans we are adding in total
        let totalNewScans = baseCodes.length * count;
        const currentScans = activeSession.serials.filter(s => s.itemName === matchedItem.name).length;
        if (matchedItem.expectedQty > 0) {
            const remainingQty = matchedItem.expectedQty - currentScans;
            if (totalNewScans > remainingQty) {
                alert(`Cannot generate sequence! Generating ${totalNewScans} serials would exceed the expected quantity limit of ${matchedItem.expectedQty} for "${matchedItem.name}". You can only scan ${remainingQty} more item(s) of this product.`);
                return;
            }
        }

        let currentBoxOffset = 1;
        for (const singleBase of baseCodes) {
            const nextBoxNo = maxBoxNo + currentBoxOffset;
            currentBoxOffset++;

            const tempSerials = [];
            const regex = /^(.*?)(\d+)$/;
            const match = singleBase.match(regex);

            if (match) {
                const prefix = match[1];
                const startString = match[2];
                const startNum = parseInt(startString);
                const padLength = startString.length;

                for (let i = 0; i < count; i++) {
                    const nextNum = startNum + i;
                    const paddedNum = String(nextNum).padStart(padLength, '0');
                    tempSerials.push(prefix + paddedNum);
                }
            } else {
                for (let i = 1; i <= count; i++) {
                    tempSerials.push(`${singleBase}${i}`);
                }
            }

            tempSerials.forEach(s => {
                allTempSerials.push({ serial: s, boxNo: nextBoxNo });
            });
        }

        // Determine active patterns list for validation
        // If not locked yet, extract pattern from first serial in batch to validate the rest
        const firstSerialOfBatch = allTempSerials[0].serial;
        const activeAllowedPatterns = matchedItem.allowedPatterns.length > 0 ? matchedItem.allowedPatterns : [{
            pattern: extractAlphabetPattern(firstSerialOfBatch),
            length: firstSerialOfBatch.length
        }];

        // Pre-build sets for O(1) duplicate checks
        const existingSerialsSet = new Set(activeSession.serials.map(s => s.serial));
        const batchSerialsSet = new Set();

        // Pre-validate all items in allTempSerials
        for (let i = 0; i < allTempSerials.length; i++) {
            const checkSerial = allTempSerials[i].serial;
            const targetBoxNo = allTempSerials[i].boxNo;

            // Check duplicate across existing serials in session
            if (existingSerialsSet.has(checkSerial)) {
                const foundItem = activeSession.serials.find(item => item.serial === checkSerial);
                showScanWarning('duplicate-seq', foundItem ? foundItem.boxNo : 'N/A', checkSerial);
                return;
            }

            // Check duplicate in same batch
            if (batchSerialsSet.has(checkSerial)) {
                showScanWarning('duplicate-batch', targetBoxNo, checkSerial);
                return;
            }
            batchSerialsSet.add(checkSerial);

            // Validate strictly against the active pattern layout configuration
            const isStrictMatch = activeAllowedPatterns.some(cfg => {
                return checkSerial.length === cfg.length && matchesAlphabetPattern(checkSerial, cfg.pattern);
            });

            if (!isStrictMatch) {
                const isPartialMatch = activeAllowedPatterns.some(cfg => {
                    return matchesAlphabetPatternPartial(checkSerial, cfg.pattern);
                });

                if (isPartialMatch) {
                    const expectedStr = activeAllowedPatterns.map(cfg => cfg.length).join(', ');
                    
                    // Capture recovery state variables for approval handler
                    lastRejectedIsSequence = true;
                    lastRejectedSeqBase = baseCode;
                    lastRejectedSeqCount = count;
                    lastRejectedSerial = checkSerial;
                    
                    const workstationProductSelect = document.getElementById('workstationProductSelect');
                    if (activeSession.items.length === 1) {
                        lastRejectedItemName = activeSession.items[0].name;
                    } else if (workstationProductSelect) {
                        lastRejectedItemName = workstationProductSelect.value;
                    }

                    showScanWarning('length', expectedStr, checkSerial, true);
                } else {
                    const firstConfig = activeAllowedPatterns[0];
                    const expectedPatternStr = firstConfig ? formatAlphabetPattern(firstConfig.pattern, firstConfig.length) : 'Any Pattern';
                    showScanWarning('sku', expectedPatternStr, checkSerial);
                }
                return;
            }
        }

        // If all items pass validation, lock pattern/length for product if not locked yet, and add them
        if (matchedItem.allowedPatterns.length === 0) {
            const pattern = extractAlphabetPattern(firstSerialOfBatch);
            matchedItem.allowedPatterns = [{
                pattern: pattern,
                length: firstSerialOfBatch.length
            }];
            // Sync legacy fields for safety
            matchedItem.skuAlphabetPattern = pattern;
            matchedItem.lockedLength = firstSerialOfBatch.length;
            console.log(`Auto-locked SKU pattern from sequence first serial for "${matchedItem.name}":`, pattern);
        }

        allTempSerials.forEach(item => {
            activeSession.serials.push({ serial: item.serial, boxNo: item.boxNo, itemName: matchedItem.name });
        });

        // Update stats, re-render cards, and save active session state
        renderBoxCards();
        updateSessionProgress();
        saveActiveSession();

        // Cleanup sequence inputs
        unifiedSerialInput.value = '';
        unifiedQtyInput.value = '5';
        if (unifiedSerialInput) unifiedSerialInput.focus();
    }

    // --- End & Save Session ---
    if (endInboundSessionBtn) {
        endInboundSessionBtn.addEventListener('click', () => {
            if (!activeSession) return;
            const count = activeSession.serials.length;
            const totalExpected = activeSession.items.reduce((sum, item) => sum + item.expectedQty, 0);
            
            // Warn if count is less than expected, but allow them to bypass it with confirmation
            if (count < totalExpected) {
                const remaining = totalExpected - count;
                const warningMsg = `Warning: You have only scanned ${count} out of ${totalExpected} expected items.\nThere are ${remaining} remaining item(s).\n\nDo you still want to end and save this session anyway?`;
                if (!confirm(warningMsg)) {
                    return;
                }
            }
            
            const productSummary = activeSession.items.map(i => `${i.name} (${i.expectedQty} expected)`).join(', ');
            const confirmMsg = `Are you sure you want to end and save this session?\n\nVehicle: ${activeSession.vehicle}\nProducts: ${productSummary}\nTotal Scanned: ${count} / ${totalExpected}`;
            if (confirm(confirmMsg)) {
                // Add to completed inbound history table
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', {
                    hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                // Add to history array & save to localStorage
                const historyData = getHistory();
                const uniqueBoxes = new Set(activeSession.serials.map(s => s.boxNo));
                const boxCountVal = uniqueBoxes.size;

                historyData.unshift({
                    id: Date.now().toString(),
                    timestamp: timeStr,
                    vehicle: activeSession.vehicle,
                    item: activeSession.items.map(i => i.name).join(' + '),
                    count: count,
                    expected: totalExpected,
                    boxCount: boxCountVal,
                    items: activeSession.items,
                    serials: activeSession.serials
                });
                saveHistory(historyData);
 
                // Reset dashboard inactive state
                inboundActiveState.style.display = 'none';
                inboundInactiveState.style.display = 'block';
                
                // Clear state & active localStorage
                activeSession = null;
                saveActiveSession();
 
                // Re-render historical logs list
                renderHistoryTable();
            }
        });
    }

    // --- Cancel Active Inbound Session ---
    if (cancelActiveInboundSessionBtn) {
        cancelActiveInboundSessionBtn.addEventListener('click', () => {
            if (!activeSession) return;
            if (confirm("Are you sure you want to cancel this inbound session? All scanned serials in this session will be discarded.")) {
                inboundActiveState.style.display = 'none';
                inboundInactiveState.style.display = 'block';
                
                // Clear state & active localStorage
                activeSession = null;
                saveActiveSession();
            }
        });
    }

    // --- Active Product Addition Modal Handlers ---

    // Close Active Product Modal
    function closeActiveProductModal() {
        if (addProductToActiveSessionModal) {
            addProductToActiveSessionModal.classList.remove('active');
            addProductToActiveSessionForm.reset();
            if (activeConfigItemSelect) activeConfigItemSelect.value = '';
            if (activeConfigItemDropdownSelectedText) activeConfigItemDropdownSelectedText.textContent = 'Choose an item...';
            closeActiveDropdownMenu();
        }
    }

    // Open active modal
    if (openAddProductToActiveSessionModalBtn) {
        openAddProductToActiveSessionModalBtn.addEventListener('click', () => {
            if (addProductToActiveSessionModal) {
                addProductToActiveSessionModal.classList.add('active');
                renderActiveDropdownItems();
            }
        });
    }

    if (closeAddProductToActiveSessionModalBtn) closeAddProductToActiveSessionModalBtn.addEventListener('click', closeActiveProductModal);
    if (cancelAddProductToActiveSessionModalBtn) cancelAddProductToActiveSessionModalBtn.addEventListener('click', closeActiveProductModal);

    // Open add item modal from active config sub-form
    if (openAddItemModalBtnInActiveModal && addItemModal) {
        openAddItemModalBtnInActiveModal.addEventListener('click', () => {
            addItemModal.classList.add('active');
            if (newItemNameInput) newItemNameInput.focus();
        });
    }

    // Custom Active Dropdown Item List Logic
    function renderActiveDropdownItems() {
        if (!activeConfigItemDropdownList) return;
        activeConfigItemDropdownList.innerHTML = '';

        inboundItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-item';
            li.setAttribute('data-value', item);
            
            li.innerHTML = `
                <span class="custom-dropdown-item-text">${item}</span>
                <button type="button" class="btn-delete-dropdown-item" data-item="${item}" title="Delete Item">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;

            // Selection trigger
            const textSpan = li.querySelector('.custom-dropdown-item-text');
            if (textSpan) {
                textSpan.addEventListener('click', () => {
                    selectActiveDropdownItem(item);
                    closeActiveDropdownMenu();
                });
            }

            // Secure deletion trigger
            const deleteBtn = li.querySelector('.btn-delete-dropdown-item');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const pwd = prompt(`Enter password to delete item "${item}":`);
                    if (pwd === '2026') {
                        inboundItems = inboundItems.filter(i => i !== item);
                        saveInboundItems();
                        renderDropdownItems();
                        renderActiveDropdownItems();
                        
                        if (activeConfigItemSelect && activeConfigItemSelect.value === item) {
                            activeConfigItemSelect.value = '';
                            if (activeConfigItemDropdownSelectedText) activeConfigItemDropdownSelectedText.textContent = 'Choose an item...';
                        }
                    } else if (pwd !== null) {
                        alert('Incorrect password! Item was not deleted.');
                    }
                });
            }

            activeConfigItemDropdownList.appendChild(li);
        });
    }

    function selectActiveDropdownItem(item) {
        if (activeConfigItemSelect) activeConfigItemSelect.value = item;
        if (activeConfigItemDropdownSelectedText) activeConfigItemDropdownSelectedText.textContent = item;
    }

    function toggleActiveDropdownMenu() {
        if (activeConfigItemDropdownContainer) {
            activeConfigItemDropdownContainer.classList.toggle('active');
        }
    }

    function closeActiveDropdownMenu() {
        if (activeConfigItemDropdownContainer) {
            activeConfigItemDropdownContainer.classList.remove('active');
        }
    }

    if (activeConfigItemDropdownTrigger) {
        activeConfigItemDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleActiveDropdownMenu();
        });
    }

    // Submit handler to add new product to active session on the fly
    if (addProductToActiveSessionForm) {
        addProductToActiveSessionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!activeSession) return;

            const selectedItem = activeConfigItemSelect.value;
            const expectedQtyInput = document.getElementById('activeConfigExpectedQty');

            const parsed = parseInt(expectedQtyInput.value);
            const expectedQtyVal = isNaN(parsed) ? 0 : parsed;

            if (!selectedItem) {
                alert('Please select a product first.');
                return;
            }

            // Check if product is already added
            const exists = activeSession.items.some(i => i.name === selectedItem);
            if (exists) {
                alert(`Product "${selectedItem}" is already configured in this active session.`);
                return;
            }

            // Push product to active session
            activeSession.items.push({
                name: selectedItem,
                expectedQty: expectedQtyVal,
                skuAlphabetPattern: null,
                lockedLength: null,
                scannedCount: 0
            });

            // Update stats, save, and update selector dropdown
            updateSessionProgress();
            updateWorkstationProductSelector();
            saveActiveSession();

            closeActiveProductModal();
        });
    }

    // --- SKU Warning Reject Modal Actions ---
    if (rejectScanBtn && skuWarningModal) {
        rejectScanBtn.addEventListener('click', () => {
            skuWarningModal.classList.remove('active');
            if (deletedSerialDismissTimer) {
                clearTimeout(deletedSerialDismissTimer);
                deletedSerialDismissTimer = null;
            }
            // Clear incorrect scan and refocus correct input
            if (activeOutboundSession) {
                refocusOutboundInput();
            } else if (unifiedSerialInput) {
                unifiedSerialInput.value = '';
                unifiedSerialInput.focus();
            }
        });    }

    if (allowLengthBtn && skuWarningModal) {
        allowLengthBtn.addEventListener('click', () => {
            const pwd = prompt("Enter password to authorize and register this new SKU pattern structure (e.g. 2026):");
            if (pwd === '2026') {
                skuWarningModal.classList.remove('active');
                
                // Inbound recovery
                if (lastRejectedSerial && lastRejectedItemName && activeSession) {
                    const targetItem = activeSession.items.find(i => i.name === lastRejectedItemName);
                    if (targetItem) {
                        const newPattern = extractAlphabetPattern(lastRejectedSerial);
                        const newConfig = { pattern: newPattern, length: lastRejectedSerial.length };
                        
                        if (!targetItem.allowedPatterns) {
                            targetItem.allowedPatterns = targetItem.skuAlphabetPattern ? [{
                                pattern: targetItem.skuAlphabetPattern,
                                length: targetItem.lockedLength || 15
                            }] : [];
                        }
                        
                        const exists = targetItem.allowedPatterns.some(cfg => {
                            return cfg.length === lastRejectedSerial.length && matchesAlphabetPattern(lastRejectedSerial, cfg.pattern);
                        });
                        
                        if (!exists) {
                            targetItem.allowedPatterns.push(newConfig);
                            targetItem.skuAlphabetPattern = newPattern;
                            targetItem.lockedLength = lastRejectedSerial.length;
                            console.log(`Approved inbound SKU pattern format:`, newConfig);
                        }

                        if (lastRejectedIsSequence) {
                            generateSequenceSerials(lastRejectedSeqBase, lastRejectedSeqCount);
                        } else {
                            addSerialToSession(lastRejectedSerial);
                        }
                    }
                }

                // Outbound recovery
                if (lastRejectedSerial && lastRejectedItemName && activeOutboundSession) {
                    const targetItem = activeOutboundSession.items.find(i => i.name === lastRejectedItemName);
                    if (targetItem) {
                        const newPattern = extractAlphabetPattern(lastRejectedSerial);
                        const newConfig = { pattern: newPattern, length: lastRejectedSerial.length };
                        
                        if (!targetItem.allowedPatterns) {
                            targetItem.allowedPatterns = targetItem.skuAlphabetPattern ? [{
                                pattern: targetItem.skuAlphabetPattern,
                                length: targetItem.lockedLength || 15
                            }] : [];
                        }
                        
                        const exists = targetItem.allowedPatterns.some(cfg => {
                            return cfg.length === lastRejectedSerial.length && matchesAlphabetPattern(lastRejectedSerial, cfg.pattern);
                        });
                        
                        if (!exists) {
                            targetItem.allowedPatterns.push(newConfig);
                            targetItem.skuAlphabetPattern = newPattern;
                            targetItem.lockedLength = lastRejectedSerial.length;
                            console.log(`Approved outbound SKU pattern format:`, newConfig);
                        }

                        if (lastRejectedIsSequence) {
                            generateOutboundSequenceSerials(lastRejectedSeqBase, lastRejectedSeqCount);
                        } else {
                            saveOutboundSerial(lastRejectedSerial, lastRejectedItemName);
                        }
                    }
                }
            } else if (pwd !== null) {
                alert('Incorrect password! SKU pattern registration denied.');
            }

            // Clear incorrect scan and refocus correct input
            if (activeOutboundSession) {
                refocusOutboundInput();
            } else if (unifiedSerialInput) {
                unifiedSerialInput.value = '';
                unifiedSerialInput.focus();
            }
        });
    }

    if (warningAddProductBtn && skuWarningModal) {
        warningAddProductBtn.addEventListener('click', () => {
            skuWarningModal.classList.remove('active');
            if (lastRejectedSerial && lastRejectedItemName && activeOutboundSession) {
                let targetItem = activeOutboundSession.items.find(i => i.name === lastRejectedItemName);
                if (!targetItem) {
                    targetItem = {
                        name: lastRejectedItemName,
                        skuAlphabetPattern: null,
                        lockedLength: null,
                        allowedPatterns: []
                    };
                    activeOutboundSession.items.push(targetItem);
                }
                const newPattern = extractAlphabetPattern(lastRejectedSerial);
                targetItem.skuAlphabetPattern = newPattern;
                targetItem.lockedLength = lastRejectedSerial.length;
                if (!targetItem.allowedPatterns) targetItem.allowedPatterns = [];
                const patternExists = targetItem.allowedPatterns.some(cfg => {
                    return cfg.length === lastRejectedSerial.length && matchesAlphabetPattern(lastRejectedSerial, cfg.pattern);
                });
                if (!patternExists) {
                    targetItem.allowedPatterns.push({ pattern: newPattern, length: lastRejectedSerial.length });
                }

                saveActiveOutboundSession();
                
                if (lastRejectedIsSequence) {
                    generateOutboundSequenceSerials(lastRejectedSeqBase, lastRejectedSeqCount);
                } else {
                    saveOutboundSerial(lastRejectedSerial, lastRejectedItemName);
                }
            }
        });
    }

    // --- Product Weight Configuration Modal Handlers ---
    if (inboundHistoryBody) {
        inboundHistoryBody.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-item-weight-trigger');
            if (btn) {
                e.stopPropagation();
                const itemName = btn.getAttribute('data-item-name');
                if (itemName) {
                    selectedWeightItemName = itemName;
                    if (weightModalProductDesc) {
                        weightModalProductDesc.textContent = `Configure the weight per piece for "${itemName}". This will be used in outbound logs.`;
                    }
                    const weights = getProductWeights();
                    if (weightInputVal) {
                        weightInputVal.value = weights[itemName] !== undefined ? weights[itemName] : '';
                    }
                    if (productWeightModal) {
                        productWeightModal.classList.add('active');
                    }
                }
            }
        });
    }

    function closeWeightModal() {
        if (productWeightModal) {
            productWeightModal.classList.remove('active');
        }
        if (productWeightForm) {
            productWeightForm.reset();
        }
        selectedWeightItemName = '';
    }

    if (closeWeightModalBtn) closeWeightModalBtn.addEventListener('click', closeWeightModal);
    if (cancelWeightModalBtn) cancelWeightModalBtn.addEventListener('click', closeWeightModal);

    if (productWeightForm) {
        productWeightForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (selectedWeightItemName && weightInputVal) {
                const val = weightInputVal.value.trim();
                saveProductWeight(selectedWeightItemName, val);
                closeWeightModal();
                renderHistoryTable();
                renderInventoryPanel();
                renderOutboundHistoryTable();
            }
        });
    }

    // ==========================================================================
    // Outbound Logs Panel Controller Workspace
    // ==========================================================================
    let activeOutboundSession = null;

    // Outbound Workstation elements
    const startOutboundSessionBtn = document.getElementById('startOutboundSessionBtn');
    const endOutboundSessionBtn = document.getElementById('endOutboundSessionBtn');
    const cancelActiveOutboundSessionBtn = document.getElementById('cancelActiveOutboundSessionBtn');
    
    const outboundInactiveState = document.getElementById('outboundInactiveState');
    const outboundActiveState = document.getElementById('outboundActiveState');
    
    const outboundConfigModal = document.getElementById('outboundConfigModal');
    const closeOutboundConfigModalBtn = document.getElementById('closeOutboundConfigModalBtn');
    const cancelOutboundConfigModalBtn = document.getElementById('cancelOutboundConfigModalBtn');
    const outboundConfigForm = document.getElementById('outboundConfigForm');

    const unrecognizedBarcodeModal = document.getElementById('unrecognizedBarcodeModal');
    const outboundAddProductConfirmModal = document.getElementById('outboundAddProductConfirmModal');
    const outboundAddProductConfirmInput = document.getElementById('outboundAddProductConfirmInput');

    let outboundPendingProductSerial = '';
    let outboundPendingProductName = '';

    const outboundUnifiedScanForm = document.getElementById('outboundUnifiedScanForm');
    const outboundSequenceToggle = document.getElementById('outboundSequenceToggle');
    const outboundQtyInputGroup = document.getElementById('outboundQtyInputGroup');
    const outboundUnifiedSerialInput = document.getElementById('outboundUnifiedSerialInput');
    const outboundUnifiedQtyInput = document.getElementById('outboundUnifiedQtyInput');
    const outboundInputLabel = document.getElementById('outboundInputLabel');
    const outboundInputHelper = document.getElementById('outboundInputHelper');
    const outboundSubmitBtnText = document.getElementById('outboundSubmitBtnText');
    const outboundSubmitBtnIcon = document.getElementById('outboundSubmitBtnIcon');

    // Outbound state storage and management
    function saveActiveOutboundSession() {
        if (activeOutboundSession) {
            localStorage.setItem('wms_active_outbound_session', JSON.stringify(activeOutboundSession));
            firebaseSet('active_outbound_session', activeOutboundSession);
        } else {
            localStorage.removeItem('wms_active_outbound_session');
            localStorage.removeItem('wms_outbound_joined');
            firebaseSet('active_outbound_session', null);
        }
    }

    function restoreOutboundSessionState() {
        const saved = localStorage.getItem('wms_active_outbound_session');
        if (saved) {
            activeOutboundSession = JSON.parse(saved);
            if (activeOutboundSession && !activeOutboundSession.items) {
                activeOutboundSession.items = [];
            }
            
            // Sanitize activeOutboundSession items
            if (activeOutboundSession.items) {
                activeOutboundSession.items.forEach(item => {
                    if (item) {
                        if (item.allowedPatterns) {
                            item.allowedPatterns = item.allowedPatterns.filter(cfg => cfg && cfg.length <= 50);
                        }
                        if (item.lockedLength > 50) {
                            item.lockedLength = null;
                            item.skuAlphabetPattern = null;
                            if (item.allowedPatterns) {
                                item.allowedPatterns = item.allowedPatterns.filter(cfg => cfg && cfg.length <= 50);
                            }
                        }
                    }
                });
            }

            if (!activeOutboundSession.serials) {
                activeOutboundSession.serials = [];
            }

            if (activeOutboundSession.serials) {
                activeOutboundSession.serials = activeOutboundSession.serials.filter(s => s && s.serial && s.serial.length <= 50);
            }

            document.getElementById('activeOutboundShop').textContent = activeOutboundSession.shopName;
            document.getElementById('activeOutboundInvoice').textContent = activeOutboundSession.invoiceNo;
            
            compactOutboundBoxNumbers();
            updateOutboundSessionProgress();
            renderOutboundBoxCards();
            const isJoined = localStorage.getItem('wms_outbound_joined') === 'true';
            if (isJoined) {
                if (outboundInactiveState) outboundInactiveState.style.display = 'none';
                if (outboundActiveState) outboundActiveState.style.display = 'flex';
            } else {
                if (outboundActiveState) outboundActiveState.style.display = 'none';
                if (outboundInactiveState) outboundInactiveState.style.display = 'block';
                const banner = document.getElementById('outboundAlreadyWorkingBanner');
                const welcome = document.getElementById('outboundWelcomeContainer');
                if (banner) banner.style.display = 'flex';
                if (welcome) welcome.style.display = 'none';
            }
        } else {
            localStorage.removeItem('wms_outbound_joined');
            if (outboundActiveState) outboundActiveState.style.display = 'none';
            if (outboundInactiveState) outboundInactiveState.style.display = 'block';
            const banner = document.getElementById('outboundAlreadyWorkingBanner');
            const welcome = document.getElementById('outboundWelcomeContainer');
            if (banner) banner.style.display = 'none';
            if (welcome) welcome.style.display = 'flex';
        }
        renderOutboundHistoryTable();
    }

    // Modal Control triggers or block if active session exists on another device
    if (startOutboundSessionBtn && outboundConfigModal) {
        startOutboundSessionBtn.addEventListener('click', () => {
            if (activeOutboundSession) {
                // Click acts as Join Session prompt
                const pwd = prompt('Enter passcode (2026) to join the active Outbound session:');
                if (pwd === '2026') {
                    localStorage.setItem('wms_outbound_joined', 'true');
                    restoreOutboundSessionState();
                } else {
                    alert('Incorrect passcode.');
                }
            } else {
                outboundConfigModal.classList.add('active');
            }
        });
    }

    // Join Outbound Session Event Listener
    const btnJoinOutboundSession = document.getElementById('btnJoinOutboundSession');
    if (btnJoinOutboundSession) {
        btnJoinOutboundSession.addEventListener('click', () => {
            const pwd = prompt('Enter passcode (2026) to join the active Outbound session:');
            if (pwd === '2026') {
                localStorage.setItem('wms_outbound_joined', 'true');
                restoreOutboundSessionState();
            } else {
                alert('Incorrect passcode.');
            }
        });
    }
    function closeOutboundConfigModal() {
        if (outboundConfigModal) {
            outboundConfigModal.classList.remove('active');
            outboundConfigForm.reset();
        }
    }
    if (closeOutboundConfigModalBtn) closeOutboundConfigModalBtn.addEventListener('click', closeOutboundConfigModal);
    if (cancelOutboundConfigModalBtn) cancelOutboundConfigModalBtn.addEventListener('click', closeOutboundConfigModal);

    // Outbound session initialization
    if (outboundConfigForm) {
        outboundConfigForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const shopVal = document.getElementById('configShopName').value.trim();
            const invoiceVal = document.getElementById('configInvoiceNo').value.trim();

            if (!shopVal || !invoiceVal) {
                alert('Please enter both Shop Name and Invoice Number.');
                return;
            }

            activeOutboundSession = {
                shopName: shopVal,
                invoiceNo: invoiceVal,
                items: [],
                serials: []
            };
            localStorage.setItem('wms_outbound_joined', 'true');
            saveActiveOutboundSession();
            closeOutboundConfigModal();
            restoreOutboundSessionState();
        });
    }

    // Toggle Sequence elements
    if (outboundSequenceToggle) {
        outboundSequenceToggle.addEventListener('change', () => {
            if (outboundSequenceToggle.checked) {
                if (outboundQtyInputGroup) outboundQtyInputGroup.style.display = 'block';
                if (outboundInputLabel) outboundInputLabel.textContent = 'Enter Sequence Start Serial';
                if (outboundInputHelper) outboundInputHelper.textContent = 'Enter first barcode of the sequence batch';
                if (outboundSubmitBtnText) outboundSubmitBtnText.textContent = 'Generate Sequence';
            } else {
                if (outboundQtyInputGroup) outboundQtyInputGroup.style.display = 'none';
                if (outboundInputLabel) outboundInputLabel.textContent = 'Scan Serial Number';
                if (outboundInputHelper) outboundInputHelper.textContent = 'Press Enter key to save immediately';
                if (outboundSubmitBtnText) outboundSubmitBtnText.textContent = 'Scan Item';
            }
        });
    }

    // unified scan submission
    if (outboundUnifiedScanForm) {
        outboundUnifiedScanForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!activeOutboundSession) return;

            const baseCode = outboundUnifiedSerialInput.value.trim();
            if (!baseCode) return;

            if (outboundSequenceToggle && outboundSequenceToggle.checked) {
                const qtyVal = parseInt(outboundUnifiedQtyInput.value) || 5;
                generateOutboundSequenceSerials(baseCode, qtyVal);
            } else {
                if (baseCode.includes(',')) {
                    const serials = baseCode.split(',').map(s => s.trim()).filter(s => s.length > 0);
                    let allSuccess = true;
                    for (const s of serials) {
                        const success = addOutboundSerialToSession(s);
                        if (!success) {
                            allSuccess = false;
                            break; // Stop loop if a warning/alert is triggered
                        }
                    }
                    if (allSuccess) {
                        outboundUnifiedSerialInput.value = '';
                    }
                } else {
                    const success = addOutboundSerialToSession(baseCode);
                    if (success) {
                        outboundUnifiedSerialInput.value = '';
                    }
                }
            }
        });
    }

    // lookup helpers
    function lookupProductBySerial(serial) {
        const history = getHistory();
        for (const log of history) {
            if (log.serials && log.serials.length > 0) {
                const found = log.serials.find(s => s && s.serial === serial);
                if (found) return found.itemName;
            }
            
            // Fallback for mock logs and legacy records (always evaluated if no exact serial match found)
            if (serial.startsWith("GXTFT")) {
                const hasMonitor = (log.item && log.item.includes("LED Monitor")) || 
                                   (log.items && log.items.some(i => {
                                       const name = typeof i === 'string' ? i : (i.name || '');
                                       return name.includes("LED Monitor");
                                   }));
                if (hasMonitor) return "LED Monitor 19.5\" (Geonix)";
            }
            if (serial.startsWith("BWR")) {
                const hasWrap = (log.item && log.item.includes("Bubble Wrap")) || 
                                 (log.items && log.items.some(i => {
                                     const name = typeof i === 'string' ? i : (i.name || '');
                                     return name.includes("Bubble Wrap");
                                 }));
                if (hasWrap) return "Bubble Wrap Roll";
            }
        }
        return null;
    }

    function lookupProductBySkuPattern(serial) {
        const history = getHistory();
        for (const log of history) {
            const itemsList = [];
            if (log.items && Array.isArray(log.items)) {
                log.items.forEach(i => itemsList.push(i));
            } else if (log.item) {
                itemsList.push({ name: log.item, expectedQty: log.expected || 10 });
            }

            for (const item of itemsList) {
                const itemName = typeof item === 'string' ? item : (item.name || '');
                if (!itemName) continue;

                let allowed = (item && typeof item === 'object') ? item.allowedPatterns : null;
                if (!allowed || allowed.length === 0) {
                    // Inject fallback allowedPatterns for legacy/mock data checks
                    if (itemName.includes("LED Monitor")) {
                        allowed = [{
                            pattern: { 0: "G", 1: "X", 2: "T", 3: "F", 4: "T", 8: "V", 9: "C", 10: "P", 11: "B" },
                            length: 18
                        }, {
                            pattern: { 0: "G", 1: "X", 2: "T", 3: "F", 4: "T", 8: "V", 9: "C", 10: "P", 11: "B" },
                            length: 19
                        }];
                    } else if (itemName.includes("Bubble Wrap")) {
                        allowed = [{
                            pattern: { 0: "B", 1: "W", 2: "R" },
                            length: 9
                        }];
                    }
                }

                if (allowed) {
                    const match = allowed.some(cfg => {
                        return cfg && cfg.pattern && matchesAlphabetPattern(serial, cfg.pattern) && serial.length === cfg.length;
                    });
                    if (match) return itemName;
                }
            }
        }
        return null;
    }

    function populateUnrecognizedProductDropdown() {
        const select = document.getElementById('unrecognizedProductSelect');
        if (!select) return;
        select.innerHTML = '';
        inboundItems.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item;
            opt.textContent = item;
            select.appendChild(opt);
        });
    }

    // Outbound validation and save scanning
    function addOutboundSerialToSession(serial) {
        if (!activeOutboundSession) return false;

        const cleanSerial = serial.trim();
        const deletedSerialsList = getDeletedSerials();
        const foundDeleted = deletedSerialsList.find(x => x.serial === cleanSerial);
        if (foundDeleted) {
            if (deletedSerialDismissTimer) {
                clearTimeout(deletedSerialDismissTimer);
            }
            showSkuWarningModal(
                'Deleted Serial Alert!',
                `ye number delet ho chuka hai`,
                'DELETED AT:',
                foundDeleted.deletedAt || 'N/A',
                'SCANNED BARCODE:',
                cleanSerial,
                false,
                false
            );
            
            deletedSerialDismissTimer = setTimeout(() => {
                skuWarningModal.classList.remove('active');
                deletedSerialDismissTimer = null;
                if (activeOutboundSession) {
                    refocusOutboundInput();
                }
            }, 5000);
            return false;
        }

        if (cleanSerial.length > 50) {
            showSkuWarningModal(
                'Invalid Serial Number!',
                `The scanned barcode is too long (${cleanSerial.length} characters). Max allowed length is 50 characters. Scan is rejected.`,
                'EXPECTED SKU:',
                'Max 50 Chars',
                'SCANNED BARCODE:',
                cleanSerial,
                false
            );
            return false;
        }

        // Already Dispatched check (Outbound History validation)
        const outboundHistory = getOutboundHistory();
        let alreadyDispatchedLog = null;
        for (const log of outboundHistory) {
            if (log.serials && log.serials.some(s => s.serial === cleanSerial)) {
                alreadyDispatchedLog = log;
                break;
            }
        }

        if (alreadyDispatchedLog) {
            showSkuWarningModal(
                'Already Dispatched Alert!',
                `The scanned serial barcode "${cleanSerial}" has already been dispatched in a previous outbound session.`,
                'DISPATCHED TO SHOP:',
                alreadyDispatchedLog.shopName || 'N/A',
                'INVOICE / SO NO:',
                alreadyDispatchedLog.invoiceNo || 'N/A',
                false,
                false,
                cleanSerial
            );
            return false;
        }

        // Duplicate scan check
        const isDup = activeOutboundSession.serials.some(s => s.serial === cleanSerial);
        if (isDup) {
            showSkuWarningModal(
                'Duplicate Outbound Scan!',
                `The serial barcode "${serial}" has already been scanned in this outbound dispatch.`,
                'SCANNED BARCODE:',
                serial,
                'DUPLICATE:',
                'DUPLICATE',
                false
            );
            return false;
        }

        // Identify product
        let productName = lookupProductBySerial(serial);
        if (!productName) {
            productName = lookupProductBySkuPattern(serial);
        }

        // Unrecognized barcode popup - directly reject scan
        if (!productName) {
            showSkuWarningModal(
                'Unrecognized Barcode!',
                `The scanned serial barcode "${serial}" could not be matched to any Inbound log database product. Scan is rejected.`,
                'EXPECTED SKU:',
                'Any Inbound SKU',
                'SCANNED BARCODE:',
                serial,
                false
            );
            return false;
        }

        // Target product check
        let targetItem = activeOutboundSession.items.find(i => i.name === productName);
        if (!targetItem) {
            // If it is the first product of the session, add it automatically without warnings
            if (activeOutboundSession.items.length === 0) {
                const newItemObj = {
                    name: productName,
                    skuAlphabetPattern: null,
                    lockedLength: null,
                    allowedPatterns: []
                };
                
                const newPattern = extractAlphabetPattern(serial);
                newItemObj.skuAlphabetPattern = newPattern;
                newItemObj.lockedLength = serial.length;
                newItemObj.allowedPatterns.push({ pattern: newPattern, length: serial.length });
                
                activeOutboundSession.items.push(newItemObj);
                saveOutboundSerial(serial, productName);
                return true;
            }

            // Set state variables for SKU Warning Modal to capture
            lastRejectedSerial = serial;
            lastRejectedItemName = productName;
            lastRejectedIsSequence = false;

            // Trigger unified SKU Warning Modal with showAddBtn = true!
            showSkuWarningModal(
                'Another Product Detected!',
                `Scanned serial barcode "${serial}" belongs to product: "${productName}". Do you want to add this product to the current outbound dispatch?`,
                'EXPECTED SKU:',
                'Session Products',
                'SCANNED BARCODE:',
                `${productName} (${serial})`,
                false, // showAllowLengthBtn
                true,  // showAddBtn (enables Add Product button and double-scan gesture input!)
                serial // Raw serial passed as extraVal
            );
            return false;
        }

        // Validate structure rules
        let isMatched = false;
        if (targetItem.allowedPatterns && targetItem.allowedPatterns.length > 0) {
            isMatched = targetItem.allowedPatterns.some(cfg => {
                return matchesAlphabetPattern(serial, cfg.pattern) && serial.length === cfg.length;
            });
        } else if (targetItem.skuAlphabetPattern) {
            isMatched = matchesAlphabetPattern(serial, targetItem.skuAlphabetPattern) && serial.length === (targetItem.lockedLength || 15);
        } else {
            const newPattern = extractAlphabetPattern(serial);
            targetItem.skuAlphabetPattern = newPattern;
            targetItem.lockedLength = serial.length;
            if (!targetItem.allowedPatterns) targetItem.allowedPatterns = [];
            targetItem.allowedPatterns.push({ pattern: newPattern, length: serial.length });
            isMatched = true;
        }

        if (!isMatched) {
            let isLengthMismatch = false;
            if (targetItem.allowedPatterns && targetItem.allowedPatterns.length > 0) {
                isLengthMismatch = targetItem.allowedPatterns.some(cfg => {
                    return matchesAlphabetPattern(serial, cfg.pattern);
                });
            } else if (targetItem.skuAlphabetPattern) {
                isLengthMismatch = matchesAlphabetPattern(serial, targetItem.skuAlphabetPattern);
            }

            lastRejectedSerial = serial;
            lastRejectedItemName = productName;
            lastRejectedIsSequence = false;

            if (isLengthMismatch) {
                showSkuWarningModal(
                    'Incomplete Barcode Scan!',
                    `Length mismatch detected for item "${productName}". Expected: ${targetItem.lockedLength} chars, Scanned: ${serial.length} chars.`,
                    'EXPECTED SKU:',
                    targetItem.skuAlphabetPattern ? Object.keys(targetItem.skuAlphabetPattern).sort((a,b)=>a-b).map(k=>targetItem.skuAlphabetPattern[k]).join('') : 'X',
                    'SCANNED BARCODE:',
                    serial,
                    true
                );
            } else {
                showSkuWarningModal(
                    'SKU Mismatch Error!',
                    `The scanned barcode does not match the alphabet structure of "${productName}".`,
                    'EXPECTED SKU:',
                    targetItem.skuAlphabetPattern ? Object.keys(targetItem.skuAlphabetPattern).sort((a,b)=>a-b).map(k=>targetItem.skuAlphabetPattern[k]).join('') : 'X',
                    'SCANNED BARCODE:',
                    serial,
                    false
                );
            }
            return false;
        }

        saveOutboundSerial(serial, productName);
        return true;
    }

    function saveOutboundSerial(serial, productName) {
        if (!activeOutboundSession) return;
        
        // 1 action = 1 box: get max box number for this product and add 1
        const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === productName);
        const maxBoxNo = itemSerials.reduce((max, item) => item.boxNo > max ? item.boxNo : max, 0);
        const boxNo = maxBoxNo + 1;

        activeOutboundSession.serials.push({
            serial: serial,
            boxNo: boxNo,
            itemName: productName
        });

        saveActiveOutboundSession();
        updateOutboundSessionProgress();
        renderOutboundBoxCards();
        refocusOutboundInput();
    }

    function refocusOutboundInput() {
        if (outboundUnifiedSerialInput) {
            outboundUnifiedSerialInput.value = '';
            outboundUnifiedSerialInput.focus();
        }
    }

    function generateOutboundSequenceSerials(baseCode, count) {
        if (!activeOutboundSession) return;

        let productName = lookupProductBySerial(baseCode);
        if (!productName) {
            productName = lookupProductBySkuPattern(baseCode);
        }

        if (!productName) {
            showSkuWarningModal(
                'Unrecognized Barcode!',
                `The sequence base code "${baseCode}" could not be matched to any Inbound log database product. Scan is rejected.`,
                'EXPECTED SKU:',
                'Any Inbound SKU',
                'SCANNED BARCODE:',
                baseCode,
                false
            );
            return;
        }

        let targetItem = activeOutboundSession.items.find(i => i.name === productName);
        if (!targetItem) {
            // If it is the first product of the session, add it automatically without warnings
            if (activeOutboundSession.items.length === 0) {
                const newItemObj = {
                    name: productName,
                    skuAlphabetPattern: null,
                    lockedLength: null,
                    allowedPatterns: []
                };
                
                const newPattern = extractAlphabetPattern(baseCode);
                newItemObj.skuAlphabetPattern = newPattern;
                newItemObj.lockedLength = baseCode.length;
                newItemObj.allowedPatterns.push({ pattern: newPattern, length: baseCode.length });
                
                activeOutboundSession.items.push(newItemObj);
                generateOutboundSequenceSerials(baseCode, count);
                return;
            }

            // Set state variables for SKU Warning Modal to capture
            lastRejectedSerial = baseCode;
            lastRejectedItemName = productName;
            lastRejectedIsSequence = true;
            lastRejectedSeqBase = baseCode;
            lastRejectedSeqCount = count;

            // Trigger unified SKU Warning Modal with showAddBtn = true!
            showSkuWarningModal(
                'Another Product Detected!',
                `The sequence base code "${baseCode}" belongs to product: "${productName}". Do you want to add this product to the current outbound dispatch?`,
                'EXPECTED SKU:',
                'Session Products',
                'SCANNED BARCODE:',
                `${productName} (${baseCode})`,
                false, // showAllowLengthBtn
                true,  // showAddBtn (enables Add Product button and double-scan gesture input!)
                baseCode // Raw base code passed as extraVal
            );
            return;
        }

        const prefixMatch = baseCode.match(/^([A-Za-z]+)/);
        const suffixMatch = baseCode.match(/(\d+)$/);
        if (!prefixMatch || !suffixMatch) {
            alert('Invalid base code for sequence generation. Must start with letters and end with digits.');
            return;
        }

        const letters = prefixMatch[1];
        const numPart = suffixMatch[1];
        const totalLen = baseCode.length;
        const startNum = parseInt(numPart);
        const numLen = numPart.length;

        const generatedBatch = [];
        for (let i = 0; i < count; i++) {
            const nextNum = startNum + i;
            const paddedNum = String(nextNum).padStart(numLen, '0');
            const middleOffset = totalLen - letters.length - numLen;
            let serial = '';
            if (middleOffset > 0) {
                const middle = baseCode.substring(letters.length, letters.length + middleOffset);
                serial = letters + middle + paddedNum;
            } else {
                serial = letters + paddedNum;
            }
            generatedBatch.push(serial);
        }

        // Pre-build O(1) lookup structures outside the loop to prevent browser freeze
        const outboundHistory = getOutboundHistory();
        const dispatchedSerialsMap = {};
        outboundHistory.forEach(log => {
            if (log.serials) {
                log.serials.forEach(s => {
                    dispatchedSerialsMap[s.serial] = log;
                });
            }
        });
        
        const activeSerialsSet = new Set(activeOutboundSession.serials.map(s => s.serial));

        for (const code of generatedBatch) {
            // Check if already dispatched in history
            const alreadyDispatchedLog = dispatchedSerialsMap[code];
            if (alreadyDispatchedLog) {
                showSkuWarningModal(
                    'Already Dispatched Alert!',
                    `The sequence barcode "${code}" has already been dispatched in a previous outbound session.`,
                    'DISPATCHED TO SHOP:',
                    alreadyDispatchedLog.shopName || 'N/A',
                    'INVOICE / SO NO:',
                    alreadyDispatchedLog.invoiceNo || 'N/A',
                    false,
                    false,
                    code
                );
                return;
            }

            const isDup = activeSerialsSet.has(code);
            if (isDup) {
                showSkuWarningModal(
                    'Duplicate Outbound Sequence Scan!',
                    `The sequence barcode "${code}" is already scanned in this outbound dispatch.`,
                    'SCANNED BARCODE:',
                    code,
                    'DUPLICATE:',
                    'DUPLICATE',
                    false
                );
                return;
            }
            activeSerialsSet.add(code);

            let isMatched = false;
            if (targetItem.allowedPatterns && targetItem.allowedPatterns.length > 0) {
                isMatched = targetItem.allowedPatterns.some(cfg => {
                    return matchesAlphabetPattern(code, cfg.pattern) && code.length === cfg.length;
                });
            } else if (targetItem.skuAlphabetPattern) {
                isMatched = matchesAlphabetPattern(code, targetItem.skuAlphabetPattern) && code.length === (targetItem.lockedLength || 15);
            } else {
                const newPattern = extractAlphabetPattern(code);
                targetItem.skuAlphabetPattern = newPattern;
                targetItem.lockedLength = code.length;
                if (!targetItem.allowedPatterns) targetItem.allowedPatterns = [];
                targetItem.allowedPatterns.push({ pattern: newPattern, length: code.length });
                isMatched = true;
            }

            if (!isMatched) {
                let isLengthMismatch = false;
                if (targetItem.allowedPatterns && targetItem.allowedPatterns.length > 0) {
                    isLengthMismatch = targetItem.allowedPatterns.some(cfg => {
                        return matchesAlphabetPattern(code, cfg.pattern);
                    });
                } else if (targetItem.skuAlphabetPattern) {
                    isLengthMismatch = matchesAlphabetPattern(code, targetItem.skuAlphabetPattern);
                }

                lastRejectedSerial = code;
                lastRejectedItemName = productName;
                lastRejectedIsSequence = true;
                lastRejectedSeqBase = baseCode;
                lastRejectedSeqCount = count;

                if (isLengthMismatch) {
                    showSkuWarningModal(
                        'Incomplete Barcode Scan (Sequence)!',
                        `Length mismatch in batch. Expected: ${targetItem.lockedLength} chars. Code: "${code}".`,
                        'EXPECTED SKU:',
                        targetItem.skuAlphabetPattern ? Object.keys(targetItem.skuAlphabetPattern).sort((a,b)=>a-b).map(k=>targetItem.skuAlphabetPattern[k]).join('') : 'X',
                        'SCANNED BARCODE:',
                        code,
                        true
                    );
                } else {
                    showSkuWarningModal(
                        'SKU Mismatch Error (Sequence)!',
                        `Alphabet mismatch in batch. Expected: ${productName} pattern. Code: "${code}".`,
                        'EXPECTED SKU:',
                        targetItem.skuAlphabetPattern ? Object.keys(targetItem.skuAlphabetPattern).sort((a,b)=>a-b).map(k=>targetItem.skuAlphabetPattern[k]).join('') : 'X',
                        'SCANNED BARCODE:',
                        code,
                        false
                    );
                }
                return;
            }
        }

        // Determine Box Number for this batch (grouped under a single new Box, Product-Specific)
        const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === productName);
        const maxBoxNo = itemSerials.reduce((max, item) => item.boxNo > max ? item.boxNo : max, 0);
        const nextBoxNo = maxBoxNo + 1;

        generatedBatch.forEach(code => {
            activeOutboundSession.serials.push({
                serial: code,
                boxNo: nextBoxNo,
                itemName: productName
            });
        });

        saveActiveOutboundSession();
        updateOutboundSessionProgress();
        renderOutboundBoxCards();
        refocusOutboundInput();
    }

    // Outbound History database
    function getOutboundHistory() {
        const saved = localStorage.getItem('wms_outbound_history');
        if (saved) return JSON.parse(saved);
        return [];
    }

    function saveOutboundHistory(historyData) {
        localStorage.setItem('wms_outbound_history', JSON.stringify(historyData));
        firebaseSet('outbound_history', historyData);
    }

    function renderOutboundHistoryTable() {
        const body = document.getElementById('outboundHistoryBody');
        if (!body) return;
        body.innerHTML = '';
        
        let todayBoxesSum = 0;
        let todayWeightSum = 0;
        
        const historyData = getOutboundHistory();
        historyData.forEach(row => {
            const tr = document.createElement('tr');
            const weights = getProductWeights();
            let totalWeight = 0;
            const itemNames = (row.items || []).map(i => {
                const count = (row.serials || []).filter(s => s.itemName === i.name).length;
                const itemWeight = parseFloat(weights[i.name]) || 0;
                totalWeight += count * itemWeight;
                return `${i.name} (${count})`;
            }).join(', ') || 'N/A';

            // Calculate total PCs and Boxes count
            const totalPcs = (row.serials || []).length;
            let totalBoxes = 0;
            const rowItems = row.items || [];
            rowItems.forEach(i => {
                const itemSerials = (row.serials || []).filter(s => s.itemName === i.name);
                const itemBoxes = new Set(itemSerials.map(s => s.boxNo)).size;
                totalBoxes += itemBoxes;
            });
            if (rowItems.length === 0 && (row.serials || []).length > 0) {
                totalBoxes = new Set((row.serials || []).map(s => s.boxNo)).size;
            }

            // Check if this log was created today
            let rowIsToday = false;
            const logTimestamp = parseInt(row.id);
            if (!isNaN(logTimestamp)) {
                const logDate = new Date(logTimestamp);
                const today = new Date();
                if (logDate.getDate() === today.getDate() &&
                    logDate.getMonth() === today.getMonth() &&
                    logDate.getFullYear() === today.getFullYear()) {
                    rowIsToday = true;
                }
            }

            if (rowIsToday) {
                todayBoxesSum += totalBoxes;
                todayWeightSum += totalWeight;
            }

            let timestampHtml = row.timestamp;
            if (rowIsToday) {
                timestampHtml = `${row.timestamp} <span style="background: var(--accent-emerald); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-left: 6px; display: inline-block; vertical-align: middle;">Today</span>`;
                tr.style.borderLeft = "4px solid var(--accent-emerald)";
                tr.style.background = "rgba(16, 185, 129, 0.015)";
            }

            tr.innerHTML = `
                <td class="font-mono">${timestampHtml}</td>
                <td>${row.shopName}</td>
                <td class="font-mono">${row.invoiceNo}</td>
                <td>${itemNames}</td>
                <td class="font-mono">${totalWeight.toFixed(3)} kg</td>
                <td class="font-mono" style="font-weight: 700;">${totalPcs}</td>
                <td class="font-mono">
                    <button type="button" class="btn-show-outbound-box-details" data-id="${row.id}" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.4); color: var(--accent-blue); padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: var(--transition-smooth);">
                        ${totalBoxes}
                    </button>
                </td>
                <td>
                    <button type="button" class="btn-download-outbound-excel" data-id="${row.id}" title="Download Outbound Excel" style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--accent-emerald); color: var(--accent-emerald); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: var(--transition-smooth); border-style: solid;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px; stroke-width: 2.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Excel
                    </button>
                    <button type="button" class="btn-restore-outbound-log" data-id="${row.id}" title="Restore Outbound Session" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: var(--accent-blue); padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: var(--transition-smooth); border-style: solid; margin-left: 6px;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 14px; height: 14px; stroke-width: 2.5;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Restore
                    </button>
                </td>
            `;
            body.appendChild(tr);
        });

        const todayOutboundBoxesEl = document.getElementById('todayOutboundBoxes');
        const todayOutboundWeightEl = document.getElementById('todayOutboundWeight');
        if (todayOutboundBoxesEl) todayOutboundBoxesEl.textContent = todayBoxesSum;
        if (todayOutboundWeightEl) todayOutboundWeightEl.textContent = `${todayWeightSum.toFixed(3)} kg`;
    }

    function downloadOutboundLogExcel(log) {
        if (!window.XLSX) {
            alert('Excel library not loaded.');
            return;
        }
        const wb = XLSX.utils.book_new();
        const items = log.items || [];
        const serials = log.serials || [];

        // Extract last digits of Invoice/SO No.
        let lastIdPart = log.invoiceNo || '';
        const idMatch = lastIdPart.trim().match(/\/([^\/]+)$/);
        if (idMatch) {
            lastIdPart = idMatch[1].trim();
        } else {
            lastIdPart = lastIdPart.trim();
        }

        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '-'); // DD-MM-YYYY
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
        
        // Header text inside cell A1 of every sheet
        const headerText = `${log.shopName} - ${lastIdPart} - ${dateStr} ${timeStr}`;

        items.forEach(item => {
            const itemSerials = serials.filter(s => s.itemName === item.name);

            const sheetRows = itemSerials.map((s, idx) => ({
                "S.No.": idx + 1,
                "Box Number": `Box ${s.boxNo}`,
                "Serial Number": s.serial.startsWith("Without Serial Number") ? "Without Serial Number" : s.serial,
                "Product Name": s.itemName
            }));

            if (sheetRows.length === 0) {
                sheetRows.push({
                    "S.No.": 1,
                    "Box Number": "N/A",
                    "Serial Number": "No serial numbers packed",
                    "Product Name": item.name
                });
            }

            // Create sheet with A1 header, then append JSON starting at A3
            const ws = XLSX.utils.aoa_to_sheet([[headerText]]);
            XLSX.utils.sheet_add_json(ws, sheetRows, { origin: "A3" });

            let sheetName = item.name.replace(/[\\\/\?\*\[\]\:]/g, "").substring(0, 30);
            if (!sheetName.trim()) sheetName = "Packed Serials";

            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // Safe Filename format: SHOPNAME + last ID digit + Date + Time
        const safeShop = (log.shopName || 'Outbound').replace(/[^a-zA-Z0-9]/g, '_');
        const safeId = lastIdPart.replace(/[^a-zA-Z0-9]/g, '_');
        const fileDate = now.toISOString().slice(0, 10).replace(/-/g, '_');
        const fileTime = now.toLocaleTimeString('en-US', { hour12: false }).replace(/:/g, '-');
        
        const filename = `${safeShop}_${safeId}_${fileDate}_${fileTime}`.toUpperCase() + ".xlsx";
        XLSX.writeFile(wb, filename);
    }

    // --- Outbound Progress UI and Live Count Calculators ---
    function updateOutboundSessionProgress() {
        if (!activeOutboundSession) return;

        const container = document.getElementById('outboundActiveRowsContainer');
        if (container) {
            container.innerHTML = '';
            const weights = getProductWeights();
            
            const items = activeOutboundSession.items || [];
            items.forEach(item => {
                const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === item.name);
                const scannedCount = itemSerials.length;
                
                const weightPerPc = weights[item.name] || 0;
                const subtotalWeight = (scannedCount * weightPerPc).toFixed(3);
                
                const tr = document.createElement('tr');
                
                let patternStr = 'None';
                if (item.allowedPatterns && item.allowedPatterns.length > 0) {
                    patternStr = item.allowedPatterns.map(cfg => {
                        const letters = Object.keys(cfg.pattern).sort((a,b)=>a-b).map(k=>cfg.pattern[k]).join('');
                        return `${letters}${cfg.length}`;
                    }).join(' / ');
                } else if (item.skuAlphabetPattern) {
                    const letters = Object.keys(item.skuAlphabetPattern).sort((a,b)=>a-b).map(k=>item.skuAlphabetPattern[k]).join('');
                    patternStr = `${letters}${item.lockedLength || 15}`;
                }

                tr.innerHTML = `
                    <td style="font-weight: 700; color: var(--text-primary);">${item.name}</td>
                    <td class="font-mono" style="font-weight: 700;">${scannedCount}</td>
                    <td class="font-mono">${subtotalWeight} kg</td>
                    <td>
                        <span class="sku-badge font-mono" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight:700; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block;" title="${patternStr}">
                            ${patternStr}
                        </span>
                    </td>
                `;
                container.appendChild(tr);
            });
        }

        const totalPcs = activeOutboundSession.serials.length;
        let uniqueBoxes = 0;
        activeOutboundSession.items.forEach(item => {
            const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === item.name);
            const itemBoxes = new Set(itemSerials.map(s => s.boxNo)).size;
            uniqueBoxes += itemBoxes;
        });
        
        const weights = getProductWeights();
        let totalWeight = 0;
        activeOutboundSession.serials.forEach(s => {
            const itemWeight = parseFloat(weights[s.itemName]) || 0;
            totalWeight += itemWeight;
        });

        const countText = document.getElementById('outboundSessionScannedCount');
        if (countText) {
            countText.textContent = `${totalPcs} Scans across ${uniqueBoxes} boxes`;
        }
        
        const weightText = document.getElementById('activeOutboundWeight');
        if (weightText) {
            weightText.textContent = `${totalWeight.toFixed(3)} kg`;
        }

        const boxesText = document.getElementById('activeOutboundBoxesCount');
        if (boxesText) {
            boxesText.textContent = `${uniqueBoxes} ${uniqueBoxes === 1 ? 'Box' : 'Boxes'}`;
        }

    }

    function renderOutboundBoxCards() {
        const container = document.getElementById('outboundSessionBoxesContainer');
        if (!container) return;
        container.innerHTML = '';

        if (!activeOutboundSession || activeOutboundSession.serials.length === 0) {
            container.innerHTML = `
                <div id="outboundEmptyScannedState" style="text-align: center; color: var(--text-muted); padding: 48px 24px; width: 100%;">
                    No serials scanned yet. Start scanning or generating above.
                </div>
            `;
            return;
        }

        activeOutboundSession.items.forEach(item => {
            const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === item.name);
            const itemPieces = itemSerials.length;
            const itemBoxes = new Set(itemSerials.map(s => s.boxNo)).size;

            const col = document.createElement('div');
            col.className = 'product-scan-column';
            col.style.cssText = 'display: flex; flex-direction: column; gap: 16px; border: 1px solid var(--border-color); padding: 16px; border-radius: var(--radius-md); background: rgba(255,255,255,0.01); min-width: 300px; flex: 1 1 0px; height: 100%; overflow: hidden;';

            col.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; width: 100%;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%;">
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 0.9rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;" title="${item.name}">
                            ${item.name}
                        </div>
                        <button type="button" class="btn-clear-product-serials" data-name="${item.name}" title="Clear all serials of this product" style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); color: var(--accent-rose); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: var(--transition-smooth); display: flex; align-items: center; gap: 3px; flex-shrink: 0;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 10px; height: 10px; stroke-width: 2.5;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Clear</span>
                        </button>
                    </div>
                    <div style="display: flex; gap: 6px; flex-shrink: 0;">
                        <span class="count-badge-pcs" style="font-size: 0.7rem; font-weight: 700; background: rgba(59,130,246,0.1); color: var(--accent-blue); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(59,130,246,0.2);">
                            PCs: ${itemPieces}
                        </span>
                        <span class="count-badge-boxes" style="font-size: 0.7rem; font-weight: 700; background: rgba(16,185,129,0.1); color: var(--accent-emerald); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2);">
                            BOXes: ${itemBoxes}
                        </span>
                    </div>
                </div>
            `;

            const clearBtn = col.querySelector('.btn-clear-product-serials');
            if (clearBtn) {
                clearBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to clear all scanned serials for product "${item.name}" from this session?`)) {
                        activeOutboundSession.serials = activeOutboundSession.serials.filter(s => s.itemName !== item.name);
                        activeOutboundSession.items = activeOutboundSession.items.filter(i => i.name !== item.name);
                        compactOutboundBoxNumbers();
                        saveActiveOutboundSession();
                        updateOutboundSessionProgress();
                        renderOutboundBoxCards();
                    }
                });
            }

            const boxListWrapper = document.createElement('div');
            boxListWrapper.className = 'product-boxes-list';
            boxListWrapper.style.cssText = 'flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; padding-right: 4px; margin-top: 10px;';

            if (itemSerials.length === 0) {
                boxListWrapper.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 48px 12px;">
                        No serials scanned for this item yet.
                    </div>
                `;
            } else {
                const groups = {};
                itemSerials.forEach(s => {
                    if (!groups[s.boxNo]) groups[s.boxNo] = [];
                    groups[s.boxNo].push(s);
                });

                const boxNumbers = Object.keys(groups).map(Number).sort((a,b)=>b-a);
                boxNumbers.forEach(boxNo => {
                    const boxItems = groups[boxNo];
                    const boxCard = document.createElement('div');
                    boxCard.className = 'box-card';
                    boxCard.style.cssText = 'margin-bottom: 0;';

                    boxCard.innerHTML = `
                        <div class="box-card-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 8px; margin-bottom: 8px;">
                            <span class="box-number-badge" style="font-size: 0.8rem; font-weight:700; color: var(--accent-blue);">Box #${boxNo}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);" class="font-mono">${boxItems.length} Pcs</span>
                        </div>
                    `;

                    const serialsUl = document.createElement('ul');
                    serialsUl.style.cssText = 'list-style: none; padding:0; margin:0; display:flex; flex-direction:column; gap:6px;';
                    
                    boxItems.forEach(s => {
                        const li = document.createElement('li');
                        li.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.02); padding: 6px 10px; border-radius: 4px; font-size:0.85rem; font-family:var(--font-mono); border: 1px solid rgba(255,255,255,0.04);';
                        
                        const displayVal = s.serial.startsWith('WOS-OUT-') 
                            ? `<span style="color: var(--accent-amber); font-weight: 700; font-style: italic; font-family: var(--font-sans);">[Non-Serial Item]</span>` 
                            : s.serial;

                        li.innerHTML = `
                            <span style="color:var(--text-secondary); word-break:break-all;">${displayVal}</span>
                            <button type="button" class="btn-outbound-delete-serial" data-serial="${s.serial}" title="Remove Serial" style="background:none; border:none; color:var(--text-muted); cursor:pointer; padding:2px; display:flex; align-items:center; justify-content:center; transition: var(--transition-smooth); border-radius:4px;">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width:14px; height:14px;">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        `;

                        const delBtn = li.querySelector('.btn-outbound-delete-serial');
                        if (delBtn) {
                            delBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                if (confirm(`Remove serial "${s.serial}" from this outbound session?`)) {
                                    activeOutboundSession.serials = activeOutboundSession.serials.filter(x => x.serial !== s.serial);
                                    
                                    const remainingForProduct = activeOutboundSession.serials.some(x => x.itemName === item.name);
                                    if (!remainingForProduct) {
                                        activeOutboundSession.items = activeOutboundSession.items.filter(x => x.name !== item.name);
                                    }
                                    
                                    compactOutboundBoxNumbers();
                                    saveActiveOutboundSession();
                                    updateOutboundSessionProgress();
                                    renderOutboundBoxCards();
                                }
                            });
                        }

                        serialsUl.appendChild(li);
                    });
                    boxCard.appendChild(serialsUl);
                    boxListWrapper.appendChild(boxCard);
                });
            }
            col.appendChild(boxListWrapper);
            container.appendChild(col);
        });
    }



    // End & Save Session
    if (endOutboundSessionBtn) {
        endOutboundSessionBtn.addEventListener('click', () => {
            if (!activeOutboundSession || activeOutboundSession.serials.length === 0) {
                alert('No serials scanned to dispatch.');
                return;
            }

            const confirmMsg = `Are you sure you want to end and save this Outbound dispatch?\n\nShop: ${activeOutboundSession.shopName}\nInvoice: ${activeOutboundSession.invoiceNo}\nTotal Items: ${activeOutboundSession.serials.length}`;
            if (confirm(confirmMsg)) {
                const now = new Date();
                const timeStr = now.toLocaleTimeString('en-US', {
                    hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                const logObj = {
                    id: Date.now().toString(),
                    timestamp: timeStr,
                    shopName: activeOutboundSession.shopName,
                    invoiceNo: activeOutboundSession.invoiceNo,
                    items: activeOutboundSession.items,
                    serials: activeOutboundSession.serials
                };

                const historyData = getOutboundHistory();
                historyData.unshift(logObj);
                saveOutboundHistory(historyData);

                // Auto download Excel immediately
                downloadOutboundLogExcel(logObj);

                activeOutboundSession = null;
                saveActiveOutboundSession();
                restoreOutboundSessionState();
            }
        });
    }

    if (cancelActiveOutboundSessionBtn) {
        cancelActiveOutboundSessionBtn.addEventListener('click', () => {
            if (confirm('Cancel outbound session? All scanned serials will be lost.')) {
                activeOutboundSession = null;
                saveActiveOutboundSession();
                restoreOutboundSessionState();
            }
        });
    }

    // Bind Excel triggers in Outbound History body
    const outboundHistoryBody = document.getElementById('outboundHistoryBody');
    if (outboundHistoryBody) {
        outboundHistoryBody.addEventListener('click', (e) => {
            const boxDetailsBtn = e.target.closest('.btn-show-outbound-box-details');
            if (boxDetailsBtn) {
                e.stopPropagation();
                const logId = boxDetailsBtn.getAttribute('data-id');
                const historyData = getOutboundHistory();
                const logItem = historyData.find(item => item.id === logId);
                if (logItem) {
                    showOutboundFirstSerialsModal(logItem);
                } else {
                    alert('Log record not found.');
                }
            }

            const btn = e.target.closest('.btn-download-outbound-excel');
            if (btn) {
                e.stopPropagation();
                const logId = btn.getAttribute('data-id');
                const historyData = getOutboundHistory();
                const logItem = historyData.find(item => item.id === logId);
                if (logItem) {
                    downloadOutboundLogExcel(logItem);
                } else {
                    alert('Log record not found.');
                }
            }

            const restoreBtn = e.target.closest('.btn-restore-outbound-log');
            if (restoreBtn) {
                e.stopPropagation();
                const logId = restoreBtn.getAttribute('data-id');
                
                const pass = prompt("Enter Admin Password to restore this Outbound Session:");
                if (pass === null) return;
                if (pass !== '1998') {
                    alert("Incorrect password!");
                    return;
                }
                
                if (activeOutboundSession) {
                    alert("Cannot restore! An active Outbound session is already running. Please cancel or save the current session first.");
                    return;
                }
                
                const historyData = getOutboundHistory();
                const logIndex = historyData.findIndex(item => item.id === logId);
                if (logIndex !== -1) {
                    const restoredLog = historyData[logIndex];
                    
                    // Populate activeOutboundSession
                    activeOutboundSession = {
                        id: restoredLog.id,
                        shopName: restoredLog.shopName,
                        invoiceNo: restoredLog.invoiceNo,
                        items: restoredLog.items || [],
                        serials: restoredLog.serials || []
                    };
                    
                    // Remove from history
                    historyData.splice(logIndex, 1);
                    
                    // Save & reload
                    saveActiveOutboundSession();
                    saveOutboundHistory(historyData);
                    restoreOutboundSessionState();
                    renderInventoryPanel();
                    
                    alert("Outbound session successfully restored to workstation!");
                } else {
                    alert('Log record not found.');
                }
            }
        });
    }

    // Close modals on outer click extensions
    window.addEventListener('click', (e) => {
        if (e.target === outboundConfigModal) closeOutboundConfigModal();
        if (e.target === unrecognizedBarcodeModal) {
            unrecognizedBarcodeModal.classList.remove('active');
            refocusOutboundInput();
        }
        if (e.target === outboundAddProductConfirmModal) {
            outboundAddProductConfirmModal.classList.remove('active');
            if (outboundAddProductConfirmInput) outboundAddProductConfirmInput.onkeydown = null;
            refocusOutboundInput();
        }
    });

    // --- Inventory Section Log Rendering & Search ---
    let productColorsMap = {};
    const colorThemes = [
        { bg: 'rgba(239, 68, 68, 0.08)', text: '#f87171', border: 'rgba(239, 68, 68, 0.25)' }, // Dim Red
        { bg: 'rgba(59, 130, 246, 0.08)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.25)' }, // Dim Blue
        { bg: 'rgba(16, 185, 129, 0.08)', text: '#34d399', border: 'rgba(16, 185, 129, 0.25)' }, // Dim Emerald
        { bg: 'rgba(245, 158, 11, 0.08)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.25)' }, // Dim Amber
        { bg: 'rgba(139, 92, 246, 0.08)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.25)' }, // Dim Purple
        { bg: 'rgba(244, 63, 94, 0.08)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.25)' }  // Dim Rose
    ];

    function renderInventoryPanel() {
        const totalItemsEl = document.getElementById('inventoryTotalItems');
        const uniqueProductsEl = document.getElementById('inventoryUniqueProducts');
        const listContainer = document.getElementById('inventorySerialsListContainer');
        const searchInput = document.getElementById('inventorySearchInput');
        const registerBody = document.getElementById('inventoryStockRegisterBody');

        if (!listContainer) return;

        // Gather all completed outbound scans and sum them by product to subtract from stock
        const outboundHistory = getOutboundHistory();
        const outboundSerialsSet = new Set();
        const outboundDetailsMap = {};
        const outboundCountsByProduct = {};

        outboundHistory.forEach(log => {
            if (log.serials) {
                log.serials.forEach(s => {
                    outboundSerialsSet.add(s.serial);
                    outboundDetailsMap[s.serial] = {
                        shopName: log.shopName,
                        invoiceNo: log.invoiceNo,
                        timestamp: log.timestamp
                    };

                    if (!outboundCountsByProduct[s.itemName]) {
                        outboundCountsByProduct[s.itemName] = 0;
                    }
                    outboundCountsByProduct[s.itemName]++;
                });
            }
        });

        // Gather all inbound scans from logs history
        const inboundHistory = getHistory();
        const availableSerials = [];
        const productStock = {};

        inboundHistory.forEach(log => {
            const name = log.item;
            if (log.serials && log.serials.length > 0) {
                log.serials.forEach(s => {
                    const itemName = s.itemName || name; // Fallback if name is missing
                    
                    // Live Stock Count subtraction logic for serials list
                    if (!outboundSerialsSet.has(s.serial)) {
                        availableSerials.push({
                            serial: s.serial,
                            itemName: itemName,
                            inboundTime: log.timestamp,
                            vehicle: log.vehicle || 'N/A'
                        });
                    }

                    if (!productStock[itemName]) {
                        productStock[itemName] = {
                            name: itemName,
                            inboundCount: 0,
                            boxNumbers: new Set()
                        };
                    }
                    productStock[itemName].inboundCount++;
                    if (!outboundSerialsSet.has(s.serial)) {
                        productStock[itemName].boxNumbers.add(s.boxNo);
                    }
                });
            } else {
                // Support "Without Serial Number Inward" math fallback
                if (name && log.count > 0) {
                    if (!productStock[name]) {
                        productStock[name] = {
                            name: name,
                            inboundCount: 0,
                            boxNumbers: new Set()
                        };
                    }
                    productStock[name].inboundCount += log.count;
                }
            }
        });

        // Deduct outbound counts from inbound counts to compute available serialsCount
        Object.values(productStock).forEach(item => {
            const outboundCount = outboundCountsByProduct[item.name] || 0;
            item.serialsCount = Math.max(0, item.inboundCount - outboundCount);
        });

        // Set Overview Available Stock Counters
        const uniqueProductNames = Object.keys(productStock).filter(name => productStock[name].serialsCount > 0);
        const totalAvailableCount = Object.values(productStock).reduce((sum, item) => sum + item.serialsCount, 0);
        
        const totalBoxesEl = document.getElementById('inventoryTotalBoxes');
        const totalWeightEl = document.getElementById('inventoryTotalWeight');
        const weights = getProductWeights();

        const totalAvailableBoxes = Object.values(productStock).reduce((sum, item) => sum + (item.serialsCount > 0 ? item.boxNumbers.size : 0), 0);
        const totalAvailableWeight = Object.values(productStock).reduce((sum, item) => {
            const unitWeight = parseFloat(weights[item.name]) || 0;
            return sum + (item.serialsCount * unitWeight);
        }, 0);

        if (totalItemsEl) totalItemsEl.textContent = totalAvailableCount;
        if (uniqueProductsEl) uniqueProductsEl.textContent = uniqueProductNames.length;
        if (totalBoxesEl) totalBoxesEl.textContent = totalAvailableBoxes;
        if (totalWeightEl) totalWeightEl.textContent = `${totalAvailableWeight.toFixed(3)} kg`;

        // Map Colors dynamically to products
        let colorIdx = 0;
        const allUniqueInHistory = Array.from(new Set(inboundHistory.flatMap(log => (log.serials || []).map(s => s.itemName || log.item))));
        allUniqueInHistory.forEach(name => {
            if (!productColorsMap[name]) {
                productColorsMap[name] = colorThemes[colorIdx % colorThemes.length];
                colorIdx++;
            }
        });

        // Render Detailed Stock Register Table Body based on available stock
        if (registerBody) {
            const weights = getProductWeights();
            const registerRowsHtml = Object.values(productStock).map(item => {
                const unitWeight = parseFloat(weights[item.name]) || 0;
                const totalWeight = item.serialsCount * unitWeight;
                const theme = productColorsMap[item.name] || colorThemes[0];
                
                return `
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                        <td style="padding: 10px 8px; font-weight: 700; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 185px;" title="${item.name}">
                            <span style="border-left: 3px solid ${theme.text}; padding-left: 6px;">${item.name}</span>
                        </td>
                        <td class="font-mono" style="padding: 10px 8px; text-align: right; font-weight: 700; color: var(--text-secondary);">${item.serialsCount}</td>
                        <td class="font-mono" style="padding: 10px 8px; text-align: right; font-weight: 700; color: var(--accent-emerald);">${totalWeight.toFixed(3)} kg</td>
                    </tr>
                `;
            }).join('');

            if (registerRowsHtml) {
                registerBody.innerHTML = registerRowsHtml;
            } else {
                registerBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No active stock registered.</td></tr>`;
            }
        }

        // Get filter query
        const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
        let filteredList = [];

        if (query === '') {
            // Default: Show only available in-stock items
            filteredList = availableSerials.map(s => ({
                serial: s.serial,
                itemName: s.itemName,
                status: 'In Stock',
                details: `Inwarded: ${s.inboundTime} | Vehicle: ${s.vehicle}`
            }));
        } else {
            // Search: Match across all historical inbound barcodes to show live trace status
            inboundHistory.forEach(log => {
                if (log.serials) {
                    log.serials.forEach(s => {
                        const name = s.itemName || log.item;
                        if (s.serial.toLowerCase().includes(query) || name.toLowerCase().includes(query)) {
                            const isDispatched = outboundSerialsSet.has(s.serial);
                            const outDetails = outboundDetailsMap[s.serial];
                            
                            filteredList.push({
                                serial: s.serial,
                                itemName: name,
                                status: isDispatched ? 'Dispatched' : 'In Stock',
                                details: isDispatched 
                                    ? `Out to: ${outDetails.shopName} | Invoice: ${outDetails.invoiceNo} (${outDetails.timestamp})`
                                    : `Inwarded: ${log.timestamp} | Vehicle: ${log.vehicle || 'N/A'}`
                            });
                        }
                    });
                }
            });
        }

        listContainer.innerHTML = '';
        if (filteredList.length === 0) {
            listContainer.innerHTML = `
                <div style="color: var(--text-muted); font-style: italic; text-align: center; padding: 32px 16px;">
                    ${query ? 'No matching serial numbers found.' : 'No serial numbers scanned yet.'}
                </div>
            `;
            return;
        }

        if (filteredList.length > 100) {
            const warningBanner = document.createElement('div');
            warningBanner.style.cssText = 'grid-column: 1 / -1; padding: 12px 16px; background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: var(--radius-md); color: var(--accent-blue); font-size: 0.85rem; font-weight: 600; text-align: center; margin-bottom: 8px;';
            warningBanner.textContent = `Showing top 100 of ${filteredList.length} items. Please use the search bar above to narrow down results.`;
            listContainer.appendChild(warningBanner);
        }

        const displayList = filteredList.slice(0, 100);
        displayList.forEach(s => {
            const card = document.createElement('div');
            card.className = 'inventory-serial-card';
            const theme = productColorsMap[s.itemName] || colorThemes[0];
            
            let borderStyle = `border: 1px solid ${theme.border};`;
            let badgeBg = 'rgba(16, 185, 129, 0.15)';
            let badgeColor = 'var(--accent-emerald)';
            let isBlinkingClass = 'class="blink-text"';

            if (s.status === 'Dispatched') {
                borderStyle = 'border: 1px solid rgba(244, 63, 94, 0.25); background: rgba(244, 63, 94, 0.04);';
                badgeBg = 'rgba(244, 63, 94, 0.15)';
                badgeColor = 'var(--accent-rose)';
                isBlinkingClass = '';
            } else {
                card.style.background = theme.bg;
            }

            card.style.cssText = borderStyle + ' padding: 12px 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px; transition: var(--transition-smooth);';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                    <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: ${theme.text}; opacity: 0.85; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${s.itemName}">${s.itemName}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.65rem; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}33; text-transform: uppercase; flex-shrink: 0;">${s.status}</span>
                        <button type="button" class="btn-delete-inventory-serial" data-serial="${s.serial}" style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: var(--accent-rose); width: 22px; height: 22px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; transition: var(--transition-smooth);" title="Delete Serial">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 12px; height: 12px; stroke-width: 2.5;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div ${isBlinkingClass} style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; word-break: break-all; margin-top: 2px; color: ${s.status === 'Dispatched' ? 'var(--text-muted)' : theme.text};">${s.serial}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${s.details}">${s.details}</div>
            `;
            listContainer.appendChild(card);
        });
    }

    function getDeletedSerials() {
        const saved = localStorage.getItem('wms_deleted_serials');
        if (saved) return JSON.parse(saved);
        return [];
    }

    function saveDeletedSerials(data) {
        localStorage.setItem('wms_deleted_serials', JSON.stringify(data));
        firebaseSet('deleted_serials', data);
    }

    function renderDeletedSerialsPanel() {
        const container = document.getElementById('deletedSerialsListContainer');
        if (!container) return;
        
        container.innerHTML = '';
        const deletedList = getDeletedSerials();
        
        if (deletedList.length === 0) {
            container.innerHTML = `
                <div style="color: var(--text-muted); font-style: italic; text-align: center; padding: 32px 16px;">
                    Trash is empty.
                </div>
            `;
            return;
        }

        deletedList.forEach(s => {
            const card = document.createElement('div');
            card.className = 'inventory-serial-card';
            card.style.cssText = 'border: 1px dashed rgba(244, 63, 94, 0.4); background: rgba(244, 63, 94, 0.02); padding: 12px 16px; border-radius: var(--radius-md); display: flex; flex-direction: column; gap: 4px; transition: var(--transition-smooth);';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 10px;">
                    <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--accent-rose); opacity: 0.85; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${s.itemName}">${s.itemName}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button type="button" class="btn-restore-serial" data-serial="${s.serial}" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--accent-emerald); padding: 2px 8px; border-radius: var(--radius-sm); font-size: 0.65rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: var(--transition-smooth);" title="Restore Serial">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 10px; height: 10px; stroke-width: 3;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                            </svg>
                            <span>Restore</span>
                        </button>
                        <button type="button" class="btn-permanent-delete-serial" data-serial="${s.serial}" style="background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: var(--accent-rose); padding: 2px 8px; border-radius: var(--radius-sm); font-size: 0.65rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: var(--transition-smooth);" title="Delete Permanently">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 10px; height: 10px; stroke-width: 3;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete</span>
                        </button>
                    </div>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.95rem; font-weight: 700; word-break: break-all; margin-top: 2px; color: var(--text-muted); text-decoration: line-through;">${s.serial}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Deleted: ${s.deletedAt}</div>
            `;
            container.appendChild(card);
        });
    }

    function deleteSerialFromInventory(serial) {
        if (!confirm(`Are you sure you want to delete serial "${serial}"? It will be subtracted from all records and moved to the Trash Bin.`)) {
            return;
        }

        // 1. Update Inbound History and find details
        const inboundHistory = getHistory();
        let inboundUpdated = false;
        let sourceInboundLogId = null;
        let sourceBoxNo = 1;
        let itemName = '';

        inboundHistory.forEach(log => {
            if (log.serials) {
                const found = log.serials.find(s => s.serial === serial);
                if (found) {
                    sourceInboundLogId = log.id;
                    sourceBoxNo = found.boxNo || 1;
                    itemName = found.itemName || log.item;
                    
                    // Filter out the serial
                    log.serials = log.serials.filter(s => s.serial !== serial);
                    inboundUpdated = true;
                    // Recalculate count
                    log.count = log.serials.length;
                    
                    // If multi-item format exists, update matching item's scannedCount
                    if (log.items) {
                        log.items.forEach(item => {
                            item.scannedCount = log.serials.filter(s => s.itemName === item.name).length;
                        });
                    }
                }
            }
        });

        if (inboundUpdated) {
            saveHistory(inboundHistory);
        }

        // 2. Update Outbound History
        const outboundHistory = getOutboundHistory();
        let outboundUpdated = false;
        let sourceOutboundLogId = null;

        outboundHistory.forEach(log => {
            if (log.serials) {
                const found = log.serials.find(s => s.serial === serial);
                if (found) {
                    sourceOutboundLogId = log.id;
                    
                    // Filter out
                    log.serials = log.serials.filter(s => s.serial !== serial);
                    outboundUpdated = true;
                    
                    // Update items scannedCount
                    if (log.items) {
                        log.items.forEach(item => {
                            item.scannedCount = log.serials.filter(s => s.itemName === item.name).length;
                        });
                    }
                }
            }
        });

        if (outboundUpdated) {
            saveOutboundHistory(outboundHistory);
        }

        // 3. Add to Deleted Serials state
        if (itemName) {
            const deletedList = getDeletedSerials();
            // Avoid duplicates
            if (!deletedList.some(s => s.serial === serial)) {
                deletedList.push({
                    serial: serial,
                    itemName: itemName,
                    boxNo: sourceBoxNo,
                    inboundLogId: sourceInboundLogId,
                    outboundLogId: sourceOutboundLogId,
                    deletedAt: new Date().toLocaleString()
                });
                saveDeletedSerials(deletedList);
            }
        }

        // 4. Refresh all related views
        renderInventoryPanel();
        renderHistoryTable();
        renderOutboundHistoryTable();
        renderDeletedSerialsPanel();
    }

    function restoreDeletedSerial(serial) {
        if (!confirm(`Are you sure you want to restore serial "${serial}" back to active stock records?`)) {
            return;
        }

        const deletedList = getDeletedSerials();
        const record = deletedList.find(s => s.serial === serial);
        if (!record) return;

        // 1. Restore to original Inbound Log row
        const inboundHistory = getHistory();
        let inboundRestored = false;

        inboundHistory.forEach(log => {
            if (log.id === record.inboundLogId) {
                if (!log.serials) log.serials = [];
                // Avoid duplicates
                if (!log.serials.some(s => s.serial === serial)) {
                    log.serials.push({
                        serial: record.serial,
                        boxNo: record.boxNo || 1,
                        itemName: record.itemName
                    });
                    log.count = log.serials.length;
                    if (log.items) {
                        log.items.forEach(item => {
                            item.scannedCount = log.serials.filter(s => s.itemName === item.name).length;
                        });
                    }
                    inboundRestored = true;
                }
            }
        });

        if (inboundRestored) {
            saveHistory(inboundHistory);
        }

        // 2. Restore to original Outbound Log row if applicable
        if (record.outboundLogId) {
            const outboundHistory = getOutboundHistory();
            let outboundRestored = false;

            outboundHistory.forEach(log => {
                if (log.id === record.outboundLogId) {
                    if (!log.serials) log.serials = [];
                    if (!log.serials.some(s => s.serial === serial)) {
                        log.serials.push({
                            serial: record.serial,
                            itemName: record.itemName
                        });
                        if (log.items) {
                            log.items.forEach(item => {
                                item.scannedCount = log.serials.filter(s => s.itemName === item.name).length;
                            });
                        }
                        outboundRestored = true;
                    }
                }
            });

            if (outboundRestored) {
                saveOutboundHistory(outboundHistory);
            }
        }

        // 3. Remove from Deleted Serials
        const updatedDeletedList = deletedList.filter(s => s.serial !== serial);
        saveDeletedSerials(updatedDeletedList);

        // 4. Refresh all related views
        renderInventoryPanel();
        renderHistoryTable();
        renderOutboundHistoryTable();
        renderDeletedSerialsPanel();
    }

    function permanentlyDeleteSerial(serial) {
        if (!confirm(`Are you sure you want to permanently delete serial "${serial}"? This action cannot be undone.`)) {
            return;
        }

        const deletedList = getDeletedSerials();
        const updatedDeletedList = deletedList.filter(s => s.serial !== serial);
        saveDeletedSerials(updatedDeletedList);
        renderDeletedSerialsPanel();
    }

    const inventorySerialsListContainer = document.getElementById('inventorySerialsListContainer');
    if (inventorySerialsListContainer) {
        inventorySerialsListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-delete-inventory-serial');
            if (btn) {
                const serial = btn.getAttribute('data-serial');
                deleteSerialFromInventory(serial);
            }
        });
    }

    const deletedSerialsListContainer = document.getElementById('deletedSerialsListContainer');
    if (deletedSerialsListContainer) {
        deletedSerialsListContainer.addEventListener('click', (e) => {
            // Restore btn
            const restoreBtn = e.target.closest('.btn-restore-serial');
            if (restoreBtn) {
                const serial = restoreBtn.getAttribute('data-serial');
                restoreDeletedSerial(serial);
            }
            // Permanent delete btn
            const permanentDeleteBtn = e.target.closest('.btn-permanent-delete-serial');
            if (permanentDeleteBtn) {
                const serial = permanentDeleteBtn.getAttribute('data-serial');
                permanentlyDeleteSerial(serial);
            }
        });
    }

    // Bind Inventory search elements
    const inventorySearchBtn = document.getElementById('inventorySearchBtn');
    const inventorySearchInput = document.getElementById('inventorySearchInput');

    if (inventorySearchBtn) {
        inventorySearchBtn.addEventListener('click', renderInventoryPanel);
    }
    if (inventorySearchInput) {
        inventorySearchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                renderInventoryPanel();
            }
        });
        // Real-time filter as you type
        inventorySearchInput.addEventListener('input', renderInventoryPanel);
    }

    // --- Without Serial Number Inward Workspace Controllers ---
    const inboundActionsDropdownBtn = document.getElementById('inboundActionsDropdownBtn');
    const inboundActionsDropdownMenu = document.getElementById('inboundActionsDropdownMenu');
    const btnOpenWithoutSerialInward = document.getElementById('btnOpenWithoutSerialInward');
    const sectionInbound = document.getElementById('sectionInbound');
    const sectionWithoutSerialInbound = document.getElementById('sectionWithoutSerialInbound');
    const btnBackToInboundLogs = document.getElementById('btnBackToInboundLogs');

    const wosItemDropdownContainer = document.getElementById('wosItemDropdownContainer');
    const wosItemDropdownTrigger = document.getElementById('wosItemDropdownTrigger');
    const wosItemDropdownMenu = document.getElementById('wosItemDropdownMenu');
    const wosItemDropdownList = document.getElementById('wosItemDropdownList');
    const wosItemDropdownSelectedText = document.getElementById('wosItemDropdownSelectedText');
    const wosItemSelect = document.getElementById('wosItemSelect');

    const withoutSerialInwardForm = document.getElementById('withoutSerialInwardForm');
    const wosVehicleNo = document.getElementById('wosVehicleNo');
    const wosQty = document.getElementById('wosQty');

    // 1. More Actions Dropdown Toggle
    if (inboundActionsDropdownBtn && inboundActionsDropdownMenu) {
        inboundActionsDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = inboundActionsDropdownMenu.style.display === 'block';
            inboundActionsDropdownMenu.style.display = isOpen ? 'none' : 'block';
        });
    }

    // 2. Open Without Serial Inward View
    if (btnOpenWithoutSerialInward && sectionWithoutSerialInbound && sectionInbound) {
        btnOpenWithoutSerialInward.addEventListener('click', () => {
            if (inboundActionsDropdownMenu) inboundActionsDropdownMenu.style.display = 'none';
            sectionInbound.classList.remove('active');
            sectionInbound.style.display = 'none';

            sectionWithoutSerialInbound.style.display = 'block';
            setTimeout(() => {
                sectionWithoutSerialInbound.classList.add('active');
            }, 20);

            renderWosDropdownItems();
        });
    }

    // 3. Back button navigation
    if (btnBackToInboundLogs && sectionInbound && sectionWithoutSerialInbound) {
        btnBackToInboundLogs.addEventListener('click', () => {
            sectionWithoutSerialInbound.classList.remove('active');
            sectionWithoutSerialInbound.style.display = 'none';

            sectionInbound.style.display = 'flex';
            setTimeout(() => {
                sectionInbound.classList.add('active');
            }, 20);
        });
    }

    // Helper to get/save dedicated WOS items
    function getWosItems() {
        const saved = localStorage.getItem('wms_wos_items');
        if (saved) return JSON.parse(saved);
        return [];
    }

    function saveWosItems(items) {
        localStorage.setItem('wms_wos_items', JSON.stringify(items));
        firebaseSet('wos_items', items);
    }

    // 4. Render product dropdown items for Without Serial Inward
    function renderWosDropdownItems() {
        if (!wosItemDropdownList) return;
        wosItemDropdownList.innerHTML = '';
        const items = getWosItems();
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-item';
            li.style.cssText = 'padding: 12px; cursor: pointer; transition: var(--transition-smooth); font-weight: 500;';
            li.textContent = item;
            li.addEventListener('click', () => {
                if (wosItemSelect) wosItemSelect.value = item;
                if (wosItemDropdownSelectedText) wosItemDropdownSelectedText.textContent = item;
                if (wosItemDropdownContainer) wosItemDropdownContainer.classList.remove('active');
            });
            wosItemDropdownList.appendChild(li);
        });
    }

    if (wosItemDropdownTrigger && wosItemDropdownContainer) {
        wosItemDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            wosItemDropdownContainer.classList.toggle('active');
        });
    }

    // Inline Add product prompt inside WOS Inward form
    const btnAddNewWosProduct = document.getElementById('btnAddNewWosProduct');
    if (btnAddNewWosProduct) {
        btnAddNewWosProduct.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newName = prompt('Enter new Without Serial Number Product Name:');
            if (newName && newName.trim()) {
                const cleanName = newName.trim();
                const currentWosItems = getWosItems();
                if (!currentWosItems.includes(cleanName)) {
                    currentWosItems.push(cleanName);
                    saveWosItems(currentWosItems);
                    renderWosDropdownItems();
                }
                
                // Automatically select the newly created item
                if (wosItemSelect) wosItemSelect.value = cleanName;
                if (wosItemDropdownSelectedText) wosItemDropdownSelectedText.textContent = cleanName;
            }
        });
    }

    // 5. Global Document Click handler to close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (inboundActionsDropdownMenu && !e.target.closest('.inbound-dropdown-container')) {
            inboundActionsDropdownMenu.style.display = 'none';
        }
        if (wosItemDropdownContainer && !e.target.closest('#wosItemDropdownContainer')) {
            wosItemDropdownContainer.classList.remove('active');
        }
    });

    // 6. Form Submission Handler for Without Serial Inward
    if (withoutSerialInwardForm) {
        withoutSerialInwardForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const itemVal = wosItemSelect.value;
            const vehicleVal = wosVehicleNo.value.trim();
            const qtyVal = parseInt(wosQty.value) || 1;
            const wosBoxCount = document.getElementById('wosBoxCount');
            const boxCountVal = wosBoxCount ? (parseInt(wosBoxCount.value) || 1) : 1;

            if (!itemVal) {
                alert('Please select a product item.');
                return;
            }

            const now = new Date();
            const logEntry = {
                id: "in_wos_" + Date.now(),
                timestamp: now.toLocaleTimeString('en-US', { hour12: true }),
                date: now.toISOString().slice(0, 10),
                vehicle: vehicleVal || 'N/A',
                item: itemVal,
                count: qtyVal,
                boxCount: boxCountVal, // Save box count!
                expected: 0,
                serials: [] // empty serials list for non-serial inward log
            };

            const history = getHistory();
            history.unshift(logEntry);
            saveHistory(history);

            renderHistoryTable();
            renderInventoryPanel();

            alert(`Success! Inwarded ${qtyVal} PCs (${boxCountVal} Boxes) of "${itemVal}" without serial numbers.`);

            // Reset form
            withoutSerialInwardForm.reset();
            if (wosItemDropdownSelectedText) wosItemDropdownSelectedText.textContent = 'Choose an item...';
            if (wosItemSelect) wosItemSelect.value = '';
            if (wosBoxCount) wosBoxCount.value = '1';

            // Navigate back
            sectionWithoutSerialInbound.classList.remove('active');
            sectionWithoutSerialInbound.style.display = 'none';
            sectionInbound.style.display = 'flex';
            setTimeout(() => {
                sectionInbound.classList.add('active');
            }, 20);
        });
    }

    // --- Outbound Dispatch Without Serial Number Controllers ---
    const btnOpenOutboundWithoutSerialModal = document.getElementById('btnOpenOutboundWithoutSerialModal');
    const outboundWithoutSerialModal = document.getElementById('outboundWithoutSerialModal');
    const closeOutboundWithoutSerialModalBtn = document.getElementById('closeOutboundWithoutSerialModalBtn');
    const cancelOutboundWithoutSerialModalBtn = document.getElementById('cancelOutboundWithoutSerialModalBtn');
    const outboundWithoutSerialForm = document.getElementById('outboundWithoutSerialForm');

    const outboundWosItemDropdownContainer = document.getElementById('outboundWosItemDropdownContainer');
    const outboundWosItemDropdownTrigger = document.getElementById('outboundWosItemDropdownTrigger');
    const outboundWosItemDropdownList = document.getElementById('outboundWosItemDropdownList');
    const outboundWosItemDropdownSelectedText = document.getElementById('outboundWosItemDropdownSelectedText');
    const outboundWosItemSelect = document.getElementById('outboundWosItemSelect');
    const outboundWosQty = document.getElementById('outboundWosQty');

    if (btnOpenOutboundWithoutSerialModal && outboundWithoutSerialModal) {
        btnOpenOutboundWithoutSerialModal.addEventListener('click', () => {
            outboundWithoutSerialModal.classList.add('active');
            renderOutboundWosDropdownItems();
        });
    }

    function closeOutboundWithoutSerialModal() {
        if (outboundWithoutSerialModal) {
            outboundWithoutSerialModal.classList.remove('active');
        }
        if (outboundWithoutSerialForm) {
            outboundWithoutSerialForm.reset();
        }
        if (outboundWosItemDropdownSelectedText) {
            outboundWosItemDropdownSelectedText.textContent = 'Choose an item...';
        }
        if (outboundWosItemSelect) {
            outboundWosItemSelect.value = '';
        }
    }

    if (closeOutboundWithoutSerialModalBtn) closeOutboundWithoutSerialModalBtn.addEventListener('click', closeOutboundWithoutSerialModal);
    if (cancelOutboundWithoutSerialModalBtn) cancelOutboundWithoutSerialModalBtn.addEventListener('click', closeOutboundWithoutSerialModal);

    if (outboundWosItemDropdownTrigger && outboundWosItemDropdownContainer) {
        outboundWosItemDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            outboundWosItemDropdownContainer.classList.toggle('active');
        });
    }

    function renderOutboundWosDropdownItems() {
        if (!outboundWosItemDropdownList) return;
        outboundWosItemDropdownList.innerHTML = '';
        
        // Scan completed Inbound history to find items successfully inwarded without serial numbers!
        const history = getHistory();
        const inwardedWosItems = Array.from(new Set(
            history
                .filter(log => (!log.serials || log.serials.length === 0) && log.count > 0)
                .map(log => log.item)
        ));

        if (inwardedWosItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-item';
            li.style.cssText = 'padding: 12px; color: var(--text-muted); font-style: italic; text-align: center;';
            li.textContent = 'No WOS items inwarded yet';
            outboundWosItemDropdownList.appendChild(li);
            return;
        }

        inwardedWosItems.forEach(item => {
            const li = document.createElement('li');
            li.className = 'custom-dropdown-item';
            li.style.cssText = 'padding: 12px; cursor: pointer; transition: var(--transition-smooth); font-weight: 500;';
            li.textContent = item;
            li.addEventListener('click', () => {
                if (outboundWosItemSelect) outboundWosItemSelect.value = item;
                if (outboundWosItemDropdownSelectedText) outboundWosItemDropdownSelectedText.textContent = item;
                if (outboundWosItemDropdownContainer) outboundWosItemDropdownContainer.classList.remove('active');
            });
            outboundWosItemDropdownList.appendChild(li);
        });
    }

    // Close on outer click
    window.addEventListener('click', (e) => {
        if (e.target === outboundWithoutSerialModal) {
            closeOutboundWithoutSerialModal();
        }
    });

    document.addEventListener('click', (e) => {
        if (outboundWosItemDropdownContainer && !e.target.closest('#outboundWosItemDropdownContainer')) {
            outboundWosItemDropdownContainer.classList.remove('active');
        }
    });

    if (outboundWithoutSerialForm) {
        outboundWithoutSerialForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!activeOutboundSession) return;

            const itemVal = outboundWosItemSelect.value;
            const qtyVal = parseInt(outboundWosQty.value) || 1;
            const outboundWosBoxCount = document.getElementById('outboundWosBoxCount');
            const boxCountVal = outboundWosBoxCount ? (parseInt(outboundWosBoxCount.value) || 1) : 1;

            if (!itemVal) {
                alert('Please select a product item.');
                return;
            }

            // Find or add item in active outbound session items list
            let targetItem = activeOutboundSession.items.find(i => i.name === itemVal);
            if (!targetItem) {
                targetItem = {
                    name: itemVal,
                    skuAlphabetPattern: null,
                    lockedLength: null,
                    allowedPatterns: []
                };
                activeOutboundSession.items.push(targetItem);
            }

            // Determine unique Box Number sequence for this product
            const itemSerials = activeOutboundSession.serials.filter(s => s.itemName === itemVal);
            const maxBoxNo = itemSerials.reduce((max, s) => s.boxNo > max ? s.boxNo : max, 0);
            const wosBoxNo = maxBoxNo + 1;

            // Distribute quantity across boxes
            const baseQtyPerBox = Math.floor(qtyVal / boxCountVal);
            let remainder = qtyVal % boxCountVal;

            let currentBoxOffset = wosBoxNo;
            for (let b = 0; b < boxCountVal; b++) {
                const boxNo = currentBoxOffset + b;
                const pcsInThisBox = baseQtyPerBox + (remainder > 0 ? 1 : 0);
                remainder--;

                for (let p = 1; p <= pcsInThisBox; p++) {
                    activeOutboundSession.serials.push({
                        serial: `Without Serial Number (WOS-OUT-${Date.now()}-${boxNo}-${p})`,
                        boxNo: boxNo,
                        itemName: itemVal
                    });
                }
            }

            saveActiveOutboundSession();
            updateOutboundSessionProgress();
            renderOutboundBoxCards();

            alert(`Success! Added ${qtyVal} PCs (${boxCountVal} Boxes) of "${itemVal}" to outbound dispatch list without serial numbers.`);
            closeOutboundWithoutSerialModal();
        });
    }

    // --- MIS Report Generator Logic ---
    function populateMisProductsDropdown() {
        const misProductSelect = document.getElementById('misProductSelect');
        if (!misProductSelect) return;

        // Keep the "ALL" option
        misProductSelect.innerHTML = '<option value="ALL">All Products (Mixed)</option>';

        // Get unique products from history database
        const history = getHistory();
        const outboundHistory = getOutboundHistory();
        const productsSet = new Set();

        history.forEach(log => {
            if (log.item) productsSet.add(log.item);
            if (log.serials) log.serials.forEach(s => productsSet.add(s.itemName));
        });
        outboundHistory.forEach(log => {
            if (log.item) productsSet.add(log.item);
            if (log.serials) log.serials.forEach(s => productsSet.add(s.itemName));
        });

        // Add sorted products to select dropdown
        Array.from(productsSet).sort().forEach(prod => {
            if (prod) {
                const opt = document.createElement('option');
                opt.value = prod;
                opt.textContent = prod;
                misProductSelect.appendChild(opt);
            }
        });
    }

    window.populateMisProductsDropdown = populateMisProductsDropdown; // export for global trigger

    function generateMisReportData() {
        const productFilter = document.getElementById('misProductSelect')?.value || 'ALL';
        const fromDateStr = document.getElementById('misFromDate')?.value || '';
        const toDateStr = document.getElementById('misToDate')?.value || '';

        const history = getHistory();
        const outboundHistory = getOutboundHistory();

        let mergedEvents = [];

        // 1. Gather Inward events
        history.forEach(log => {
            if (!log.timestamp) return;
            const timestamp = new Date(log.timestamp);
            // Check date range filters
            if (fromDateStr && new Date(fromDateStr + 'T00:00:00') > timestamp) return;
            if (toDateStr && new Date(toDateStr + 'T23:59:59') < timestamp) return;

            const name = log.item;
            const logType = "INWARD";
            const details = log.vehicle ? `Vehicle: ${log.vehicle}` : 'Inward Logs';

            if (log.serials && log.serials.length > 0) {
                log.serials.forEach(s => {
                    const itemName = s.itemName || name;
                    if (productFilter !== 'ALL' && itemName !== productFilter) return;

                    mergedEvents.push({
                        rawTime: timestamp,
                        timeStr: log.timestamp,
                        activity: logType,
                        itemName: itemName,
                        serial: s.serial,
                        boxNo: s.boxNo,
                        qty: 1,
                        details: details
                    });
                });
            } else {
                // Non-serial inward
                if (productFilter !== 'ALL' && name !== productFilter) return;
                mergedEvents.push({
                    rawTime: timestamp,
                    timeStr: log.timestamp,
                    activity: logType,
                    itemName: name,
                    serial: 'Without Serial Number (WOS-IN)',
                    boxNo: log.wosBoxNo || '-',
                    qty: log.count || 0,
                    details: details
                });
            }
        });

        // 2. Gather Outward events
        outboundHistory.forEach(log => {
            if (!log.timestamp) return;
            const timestamp = new Date(log.timestamp);
            // Check date range filters
            if (fromDateStr && new Date(fromDateStr + 'T00:00:00') > timestamp) return;
            if (toDateStr && new Date(toDateStr + 'T23:59:59') < timestamp) return;

            const name = log.item;
            const logType = "OUTWARD";
            const details = `Shop: ${log.shopName || 'N/A'}, Inv: ${log.invoiceNo || 'N/A'}`;

            if (log.serials && log.serials.length > 0) {
                log.serials.forEach(s => {
                    const itemName = s.itemName || name;
                    if (productFilter !== 'ALL' && itemName !== productFilter) return;

                    mergedEvents.push({
                        rawTime: timestamp,
                        timeStr: log.timestamp,
                        activity: logType,
                        itemName: itemName,
                        serial: s.serial,
                        boxNo: s.boxNo,
                        qty: 1,
                        details: details
                    });
                });
            } else {
                // Non-serial outbound
                if (productFilter !== 'ALL' && name !== productFilter) return;
                mergedEvents.push({
                    rawTime: timestamp,
                    timeStr: log.timestamp,
                    activity: logType,
                    itemName: name,
                    serial: 'Without Serial Number (WOS-OUT)',
                    boxNo: log.outboundWosBoxNo || '-',
                    qty: log.count || 0,
                    details: details
                });
            }
        });

        // Sort by timestamp (oldest first)
        mergedEvents.sort((a, b) => a.rawTime - b.rawTime);

        return mergedEvents;
    }

    const btnGenerateMisReport = document.getElementById('btnGenerateMisReport');
    if (btnGenerateMisReport) {
        btnGenerateMisReport.addEventListener('click', () => {
            const data = generateMisReportData();
            const body = document.getElementById('misReportTableBody');
            if (!body) return;

            body.innerHTML = '';

            let totalInward = 0;
            let totalOutward = 0;

            if (data.length === 0) {
                body.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">
                            No matching stock activity found for selected filters.
                        </td>
                    </tr>
                `;
                document.getElementById('misTotalInwardPcs').textContent = '0';
                document.getElementById('misTotalOutwardPcs').textContent = '0';
                document.getElementById('misNetPcs').textContent = '0';
                return;
            }

            data.forEach(row => {
                const tr = document.createElement('tr');
                
                // Color code Activity
                const badgeColor = row.activity === 'INWARD' ? 'var(--accent-blue)' : 'var(--accent-rose)';
                const badgeBg = row.activity === 'INWARD' ? 'rgba(59,130,246,0.1)' : 'rgba(244,63,94,0.1)';

                tr.innerHTML = `
                    <td style="font-family: var(--font-mono); font-size: 0.8rem;">${row.timeStr}</td>
                    <td>
                        <span style="font-size: 0.72rem; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 6px; border-radius: 4px; border: 1px solid ${badgeColor}40;">
                            ${row.activity}
                        </span>
                    </td>
                    <td style="font-weight: 700; color: var(--text-primary); font-size: 0.85rem;">${row.itemName}</td>
                    <td style="font-family: var(--font-mono); font-size: 0.8rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.serial}">${row.serial}</td>
                    <td>${row.boxNo}</td>
                    <td style="font-weight: 700;">${row.qty}</td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary);">${row.details}</td>
                `;

                body.appendChild(tr);

                if (row.activity === 'INWARD') {
                    totalInward += row.qty;
                } else {
                    totalOutward += row.qty;
                }
            });

            document.getElementById('misTotalInwardPcs').textContent = totalInward;
            document.getElementById('misTotalOutwardPcs').textContent = totalOutward;
            document.getElementById('misNetPcs').textContent = (totalInward - totalOutward);
        });
    }

    const btnExportMisReportExcel = document.getElementById('btnExportMisReportExcel');
    if (btnExportMisReportExcel) {
        btnExportMisReportExcel.addEventListener('click', () => {
            const data = generateMisReportData();
            if (data.length === 0) {
                alert('No MIS report data to export. Generate a report first.');
                return;
            }

            const sheetRows = [];
            let rowIdx = 1;
            let sumInward = 0;
            let sumOutward = 0;

            data.forEach(row => {
                sheetRows.push({
                    "S.No.": rowIdx++,
                    "Timestamp": row.timeStr,
                    "Activity": row.activity,
                    "Product Name": row.itemName,
                    "Serial Number": row.serial,
                    "Box No.": row.boxNo,
                    "Quantity (Pcs)": row.qty,
                    "Details": row.details
                });

                if (row.activity === 'INWARD') {
                    sumInward += row.qty;
                } else {
                    sumOutward += row.qty;
                }
            });

            // Append summary row
            sheetRows.push({
                "S.No.": "",
                "Timestamp": "",
                "Activity": "",
                "Product Name": "",
                "Serial Number": "",
                "Box No.": "",
                "Quantity (Pcs)": "",
                "Details": ""
            });

            sheetRows.push({
                "S.No.": "",
                "Timestamp": "TOTAL INWARD PCs",
                "Activity": sumInward,
                "Product Name": "TOTAL OUTWARD PCs",
                "Box No.": sumOutward,
                "Quantity (Pcs)": "NET STOCK PCs",
                "Details": (sumInward - sumOutward)
            });

            const ws = XLSX.utils.json_to_sheet(sheetRows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "MIS Report");

            // Format Filename: MUMBAI_MIS_REPORT_BHIWANDI_DD_MM_YYYY_HH_MM_SS
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-GB').replace(/\//g, '_');
            const timeStr = now.toLocaleTimeString('en-US', { hour12: false }).replace(/\:/g, '-');
            const filename = `MUMBAI_MIS_REPORT_BHIWANDI_${dateStr}_${timeStr}`.toUpperCase() + ".xlsx";

            XLSX.writeFile(wb, filename);
        });
    }

    // --- Real-time Connection Status feedback ---
    function updateConnectionStatus(connected) {
        const dot = document.getElementById('systemStatusDot');
        const text = document.getElementById('systemStatusText');
        if (!dot || !text) return;
        
        if (connected) {
            dot.style.backgroundColor = 'var(--accent-emerald)';
            dot.style.boxShadow = '0 0 8px var(--accent-emerald)';
            text.textContent = 'System Connected';
        } else {
            dot.style.backgroundColor = 'var(--accent-rose)';
            dot.style.boxShadow = '0 0 8px var(--accent-rose)';
            text.textContent = 'System Offline';
        }
    }

    if (isFirebaseConnected && db) {
        db.ref('.info/connected').on('value', (snap) => {
            if (snap.val() === true) {
                updateConnectionStatus(true);
            } else {
                updateConnectionStatus(false);
            }
        });
    } else {
        updateConnectionStatus(false);
    }

    // --- Device Access Authorization Control ---
    let deviceId = localStorage.getItem('wms_device_id');
    if (!deviceId) {
        deviceId = 'DEV-' + Math.floor(1000 + Math.random() * 9000);
        localStorage.setItem('wms_device_id', deviceId);
    }

    const accessLockOverlay = document.getElementById('accessLockOverlay');
    const accessOverlayDeviceId = document.getElementById('accessOverlayDeviceId');
    const btnUnlockOverlayWithPass = document.getElementById('btnUnlockOverlayWithPass');
    
    if (accessOverlayDeviceId) {
        accessOverlayDeviceId.textContent = deviceId;
    }

    function checkDeviceApprovalStatus() {
        if (!isFirebaseConnected || !db) {
            // Offline fallback: allow access for local testing if offline
            if (accessLockOverlay) accessLockOverlay.style.display = 'none';
            return;
        }

        db.ref('wms_data/devices/' + deviceId).on('value', (snapshot) => {
            const device = snapshot.val();
            if (!device) {
                // Register device as pending approval in Firebase
                const deviceRecord = {
                    id: deviceId,
                    status: 'pending',
                    requestedAt: new Date().toLocaleString(),
                    userAgent: navigator.userAgent
                };
                db.ref('wms_data/devices/' + deviceId).set(deviceRecord);
                if (accessLockOverlay) accessLockOverlay.style.display = 'flex';
            } else {
                if (device.status === 'approved') {
                    if (accessLockOverlay) accessLockOverlay.style.display = 'none';
                } else {
                    if (accessLockOverlay) accessLockOverlay.style.display = 'flex';
                    const statusText = document.getElementById('accessOverlayStatus');
                    if (statusText) {
                        if (device.status === 'rejected') {
                            statusText.style.color = 'var(--accent-rose)';
                            statusText.innerHTML = '<span class="status-dot" style="background-color: var(--accent-rose); box-shadow: 0 0 8px var(--accent-rose); width: 6px; height: 6px;"></span>Access Denied/Rejected';
                        } else {
                            statusText.style.color = 'var(--accent-amber)';
                            statusText.innerHTML = '<span class="status-dot" style="background-color: var(--accent-amber); box-shadow: 0 0 8px var(--accent-amber); width: 6px; height: 6px; animation: pulse 2s infinite;"></span>Waiting for admin approval...';
                        }
                    }
                }
            }
        });
    }

    if (btnUnlockOverlayWithPass) {
        btnUnlockOverlayWithPass.addEventListener('click', () => {
            const pass = prompt("Enter Administrator Password to authorize this device:");
            if (pass === '1998') {
                if (isFirebaseConnected && db) {
                    db.ref('wms_data/devices/' + deviceId + '/status').set('approved').then(() => {
                        alert("Device authorized successfully!");
                    });
                } else {
                    alert("Local authorization success (offline mode).");
                    if (accessLockOverlay) accessLockOverlay.style.display = 'none';
                }
            } else if (pass !== null) {
                alert("Incorrect password!");
            }
        });
    }

    // --- Device Manager Modal Controllers ---
    const btnOpenDeviceManager = document.getElementById('btnOpenDeviceManager');
    const deviceManagerModal = document.getElementById('deviceManagerModal');
    const closeDeviceManagerModalBtn = document.getElementById('closeDeviceManagerModalBtn');
    const closeDeviceManagerModalFooterBtn = document.getElementById('closeDeviceManagerModalFooterBtn');
    const deviceManagerTableBody = document.getElementById('deviceManagerTableBody');

    function openDeviceManager() {
        if (!deviceManagerModal) return;
        deviceManagerModal.classList.add('active');
        loadDevicesInManager();
    }

    function closeDeviceManager() {
        if (deviceManagerModal) {
            deviceManagerModal.classList.remove('active');
        }
    }

    if (btnOpenDeviceManager) {
        btnOpenDeviceManager.addEventListener('click', openDeviceManager);
    }
    if (closeDeviceManagerModalBtn) {
        closeDeviceManagerModalBtn.addEventListener('click', closeDeviceManager);
    }
    if (closeDeviceManagerModalFooterBtn) {
        closeDeviceManagerModalFooterBtn.addEventListener('click', closeDeviceManager);
    }

    const btnClearAllDevicesBtn = document.getElementById('btnClearAllDevicesBtn');
    if (btnClearAllDevicesBtn) {
        btnClearAllDevicesBtn.addEventListener('click', () => {
            const msg = "Are you sure you want to clear all device authorization records?\n\nThis will instantly lock all other devices. If your own device is locked, you can unlock it using the Admin Password '1998'.";
            if (!confirm(msg)) return;
            
            if (isFirebaseConnected && db) {
                db.ref('wms_data/devices').set(null).then(() => {
                    alert("All device records cleared successfully.");
                }).catch(err => {
                    alert("Failed to clear device records: " + err.message);
                });
            } else {
                alert("Database offline. Cannot clear records.");
            }
        });
    }

    function loadDevicesInManager() {
        if (!isFirebaseConnected || !db || !deviceManagerTableBody) return;
        
        db.ref('wms_data/devices').on('value', (snapshot) => {
            deviceManagerTableBody.innerHTML = '';
            const devices = snapshot.val();
            if (!devices) {
                deviceManagerTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); font-style: italic; padding: 20px;">No device requests logged.</td></tr>';
                return;
            }

            Object.values(devices).forEach(dev => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
                
                let statusBadge = `<span style="font-size: 0.7rem; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: var(--accent-amber); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(245, 158, 11, 0.2); text-transform: uppercase;">Pending</span>`;
                if (dev.status === 'approved') {
                    statusBadge = `<span style="font-size: 0.7rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.2); text-transform: uppercase;">Approved</span>`;
                } else if (dev.status === 'rejected') {
                    statusBadge = `<span style="font-size: 0.7rem; font-weight: 700; background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(244, 63, 94, 0.2); text-transform: uppercase;">Rejected</span>`;
                }

                let actionButton = '';
                if (dev.status === 'pending') {
                    actionButton = `
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                            <button type="button" class="btn-primary" onclick="window.setDeviceStatus('${dev.id}', 'approved')" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; border-radius: var(--radius-sm);">Approve</button>
                            <button type="button" class="btn-danger" onclick="window.setDeviceStatus('${dev.id}', 'rejected')" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; border-radius: var(--radius-sm); background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: var(--accent-rose);">Reject</button>
                        </div>
                    `;
                } else if (dev.status === 'approved') {
                    actionButton = `
                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="btn-danger" onclick="window.setDeviceStatus('${dev.id}', 'rejected')" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; border-radius: var(--radius-sm); background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); color: var(--accent-rose);">Revoke</button>
                        </div>
                    `;
                } else {
                    actionButton = `
                        <div style="display: flex; justify-content: flex-end;">
                            <button type="button" class="btn-primary" onclick="window.setDeviceStatus('${dev.id}', 'approved')" style="padding: 4px 8px; font-size: 0.7rem; font-weight: 700; cursor: pointer; border-radius: var(--radius-sm);">Approve</button>
                        </div>
                    `;
                }

                tr.innerHTML = `
                    <td style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; padding: 12px 8px;">${dev.id}</td>
                    <td style="font-size: 0.8rem; color: var(--text-secondary); padding: 12px 8px;">${dev.requestedAt || 'N/A'}</td>
                    <td style="padding: 12px 8px;">${statusBadge}</td>
                    <td style="padding: 12px 8px;">${actionButton}</td>
                `;
                deviceManagerTableBody.appendChild(tr);
            });
        });
    }

    window.setDeviceStatus = function(devId, status) {
        if (isFirebaseConnected && db) {
            db.ref('wms_data/devices/' + devId + '/status').set(status);
        }
    };

    // --- Outbound First Serials Modal Controllers ---
    const outboundFirstSerialsModal = document.getElementById('outboundFirstSerialsModal');
    const closeOutboundFirstSerialsModalBtn = document.getElementById('closeOutboundFirstSerialsModalBtn');
    const closeOutboundFirstSerialsModalFooterBtn = document.getElementById('closeOutboundFirstSerialsModalFooterBtn');

    function showOutboundFirstSerialsModal(row) {
        const body = document.getElementById('outboundFirstSerialsModalBody');
        if (!outboundFirstSerialsModal || !body) return;

        body.innerHTML = '';

        if (!row || !row.serials || row.serials.length === 0) {
            body.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No serials found for this dispatch session.</div>`;
            outboundFirstSerialsModal.classList.add('active');
            return;
        }

        // Group serials by itemName, and find the first serial for each boxNo
        const grouped = {};
        row.serials.forEach(s => {
            if (!s || !s.itemName || s.boxNo === undefined || s.boxNo === null) return;
            const pName = s.itemName;
            const box = parseInt(s.boxNo);
            if (!grouped[pName]) {
                grouped[pName] = {};
            }
            if (grouped[pName][box] === undefined) {
                grouped[pName][box] = s.serial;
            }
        });

        // Build HTML
        Object.keys(grouped).forEach(pName => {
            const productHeader = document.createElement('div');
            productHeader.style.margin = '8px 0 4px 0';
            productHeader.innerHTML = `
                <h4 style="margin: 12px 0 6px 0; color: var(--accent-blue); font-size: 0.95rem; font-weight: 700; border-left: 3px solid var(--accent-blue); padding-left: 8px; text-transform: uppercase; letter-spacing: 0.03em;">
                    ${pName}
                </h4>
            `;
            body.appendChild(productHeader);

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
            grid.style.gap = '8px';
            grid.style.marginBottom = '16px';

            const boxMap = grouped[pName];
            // Sort boxes numerically
            const sortedBoxes = Object.keys(boxMap).map(Number).sort((a, b) => a - b);

            sortedBoxes.forEach(box => {
                const card = document.createElement('div');
                card.style.background = 'rgba(255, 255, 255, 0.02)';
                card.style.border = '1px solid var(--border-color)';
                card.style.padding = '8px 12px';
                card.style.borderRadius = 'var(--radius-sm)';
                card.style.display = 'flex';
                card.style.justifyContent = 'space-between';
                card.style.alignItems = 'center';
                card.style.fontSize = '0.85rem';
                card.style.fontFamily = 'var(--font-mono)';

                card.innerHTML = `
                    <span style="color: var(--text-muted); font-weight: 600;">Box ${box}:</span>
                    <span style="color: var(--text-primary); font-weight: 700; word-break: break-all;">${boxMap[box]}</span>
                `;
                grid.appendChild(card);
            });

            body.appendChild(grid);
        });

        outboundFirstSerialsModal.classList.add('active');
    }

    function closeOutboundFirstSerialsModal() {
        if (outboundFirstSerialsModal) {
            outboundFirstSerialsModal.classList.remove('active');
        }
    }

    if (closeOutboundFirstSerialsModalBtn) {
        closeOutboundFirstSerialsModalBtn.addEventListener('click', closeOutboundFirstSerialsModal);
    }
    if (closeOutboundFirstSerialsModalFooterBtn) {
        closeOutboundFirstSerialsModalFooterBtn.addEventListener('click', closeOutboundFirstSerialsModal);
    }

    // Initial load: Restore states on page load/reload
    restoreSessionState();
    restoreOutboundSessionState();
    renderInventoryPanel();
    renderDeletedSerialsPanel();
    populateMisProductsDropdown();
    checkDeviceApprovalStatus();
});

