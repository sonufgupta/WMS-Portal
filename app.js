document.addEventListener('DOMContentLoaded', () => {

    // --- Firebase Configuration ---
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

    let db = null;
    let isConnected = false;

    if (window.firebase) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();
            isConnected = true;
            console.log("Firebase Connected Successfully!");
        } catch (err) {
            console.error("Firebase Init Error:", err);
        }
    }

    // New Isolated Node for Zero Junk/Corrupt Data
    const DB_ROOT = 'wms_fresh_v2';

    // Local in-memory state
    let inventoryMap = {}; // { "Product Name": Set of serials }
    let activityLogs = [];

    // --- Live Clock ---
    const clockEl = document.getElementById('liveClock');
    function updateClock() {
        if (clockEl) {
            clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false });
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- Bottom Tabs Navigation ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const screens = document.querySelectorAll('.app-screen');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            navTabs.forEach(t => t.classList.remove('active'));
            screens.forEach(s => s.classList.remove('active'));

            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            const targetScreen = document.getElementById(targetId);
            if (targetScreen) targetScreen.classList.add('active');
        });
    });

    // --- Firebase Realtime Listeners ---
    if (isConnected && db) {
        // Online status feedback
        db.ref('.info/connected').on('value', snap => {
            const statusEl = document.getElementById('syncStatus');
            if (statusEl) {
                if (snap.val() === true) {
                    statusEl.innerHTML = '<span class="dot" style="background:#10b981"></span> Cloud Synced';
                    statusEl.style.color = '#10b981';
                } else {
                    statusEl.innerHTML = '<span class="dot" style="background:#f43f5e"></span> Offline Mode';
                    statusEl.style.color = '#f43f5e';
                }
            }
        });

        // Sync Stock Register
        db.ref(`${DB_ROOT}/stock`).on('value', snap => {
            const val = snap.val() || {};
            inventoryMap = {};
            Object.keys(val).forEach(prod => {
                inventoryMap[prod] = new Set(Object.keys(val[prod] || {}));
            });
            renderStockTable();
        });

        // Sync Activity Logs
        db.ref(`${DB_ROOT}/logs`).limitToLast(30).on('value', snap => {
            const val = snap.val() || {};
            activityLogs = Object.values(val).reverse();
            renderActivityLogs();
        });
    }

    // --- Inbound Form Submission ---
    const formInbound = document.getElementById('formInbound');
    if (formInbound) {
        formInbound.addEventListener('submit', (e) => {
            e.preventDefault();
            const product = document.getElementById('inboundProduct').value.trim();
            const rawSerials = document.getElementById('inboundSerials').value.trim();
            const vehicle = document.getElementById('inboundVehicle').value.trim() || 'N/A';
            const box = document.getElementById('inboundBox').value.trim() || 'Box 1';

            if (!product || !rawSerials) return;

            const serialsList = rawSerials.split(/[,\n]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
            if (serialsList.length === 0) return;

            // Save to Firebase
            if (isConnected && db) {
                const updates = {};
                const timestamp = new Date().toLocaleString();

                serialsList.forEach(sn => {
                    updates[`${DB_ROOT}/stock/${product}/${sn}`] = {
                        box: box,
                        inwardTime: timestamp,
                        vehicle: vehicle
                    };
                });

                // Add to logs
                const logKey = db.ref(`${DB_ROOT}/logs`).push().key;
                updates[`${DB_ROOT}/logs/${logKey}`] = {
                    type: 'INBOUND',
                    product: product,
                    count: serialsList.length,
                    details: `Vehicle: ${vehicle} | ${box}`,
                    timestamp: timestamp
                };

                db.ref().update(updates).then(() => {
                    alert(`Saved! ${serialsList.length} items added to stock.`);
                    formInbound.reset();
                    document.querySelector('[data-target="screenStock"]').click();
                }).catch(err => {
                    alert("Error saving: " + err.message);
                });
            }
        });
    }

    // --- Outbound Form Submission ---
    const formOutbound = document.getElementById('formOutbound');
    if (formOutbound) {
        formOutbound.addEventListener('submit', (e) => {
            e.preventDefault();
            const shop = document.getElementById('outboundShop').value.trim();
            const invoice = document.getElementById('outboundInvoice').value.trim();
            const product = document.getElementById('outboundProduct').value.trim();
            const serial = document.getElementById('outboundSerial').value.trim().toUpperCase();

            if (!product || !serial) return;

            // Check if serial exists in stock
            if (!inventoryMap[product] || !inventoryMap[product].has(serial)) {
                alert(`Serial barcode "${serial}" is not in stock under "${product}"!`);
                return;
            }

            if (isConnected && db) {
                const updates = {};
                const timestamp = new Date().toLocaleString();

                // Remove from stock
                updates[`${DB_ROOT}/stock/${product}/${serial}`] = null;

                // Add to logs
                const logKey = db.ref(`${DB_ROOT}/logs`).push().key;
                updates[`${DB_ROOT}/logs/${logKey}`] = {
                    type: 'OUTBOUND',
                    product: product,
                    count: 1,
                    details: `To: ${shop} | Inv: ${invoice} | SN: ${serial}`,
                    timestamp: timestamp
                };

                db.ref().update(updates).then(() => {
                    alert(`Dispatched! ${product} (${serial}) deducted from stock.`);
                    document.getElementById('outboundSerial').value = '';
                    document.getElementById('outboundSerial').focus();
                }).catch(err => {
                    alert("Dispatch error: " + err.message);
                });
            }
        });
    }

    // --- Render Stock Table ---
    function renderStockTable() {
        const tbody = document.getElementById('stockTableBody');
        const query = (document.getElementById('stockSearchInput')?.value || '').toLowerCase().trim();
        const totalStockEl = document.getElementById('totalStockPcs');
        const totalUniqueEl = document.getElementById('totalUniqueProducts');

        if (!tbody) return;
        tbody.innerHTML = '';

        let totalPcs = 0;
        let uniqueProds = 0;

        const productNames = Object.keys(inventoryMap).sort();

        productNames.forEach(prod => {
            const count = inventoryMap[prod].size;
            if (count > 0) {
                totalPcs += count;
                uniqueProds++;
            }

            // Search filter
            if (query && !prod.toLowerCase().includes(query)) {
                let serialMatched = false;
                inventoryMap[prod].forEach(sn => {
                    if (sn.toLowerCase().includes(query)) serialMatched = true;
                });
                if (!serialMatched) return;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:700;">${prod}</td>
                <td style="text-align:right; font-family:'JetBrains Mono'; font-weight:800; color: ${count > 0 ? '#10b981' : '#f43f5e'}">
                    ${count > 0 ? count + ' PCs' : 'Out of Stock'}
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (totalStockEl) totalStockEl.textContent = totalPcs;
        if (totalUniqueEl) totalUniqueEl.textContent = uniqueProds;

        if (tbody.children.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" class="empty-state">No matching stock found.</td></tr>`;
        }
    }

    // Live search listener
    document.getElementById('stockSearchInput')?.addEventListener('input', renderStockTable);

    // --- Render Activity Logs ---
    function renderActivityLogs() {
        const container = document.getElementById('activityLogsList');
        if (!container) return;
        container.innerHTML = '';

        if (activityLogs.length === 0) {
            container.innerHTML = `<div class="empty-state">No activities recorded yet.</div>`;
            return;
        }

        activityLogs.forEach(log => {
            const isOut = log.type === 'OUTBOUND';
            const card = document.createElement('div');
            card.className = 'log-item';
            card.style.borderLeft = isOut ? '4px solid #f43f5e' : '4px solid #3b82f6';

            card.innerHTML = `
                <div class="log-header">
                    <span style="color:${isOut ? '#f43f5e' : '#3b82f6'}">${log.type} &bull; ${log.product} (${log.count} PCs)</span>
                    <span style="font-size:0.7rem; color:#94a3b8;">${log.timestamp}</span>
                </div>
                <div style="color:#cbd5e1;">${log.details}</div>
            `;
            container.appendChild(card);
        });
    }

    // --- Wipe Clean / Reset Action ---
    const btnReset = document.getElementById('btnResetDatabase');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            const pwd = prompt("Enter passcode (1998) to permanently reset and clear all data:");
            if (pwd === '1998') {
                if (confirm("Are you absolutely sure? This will delete all live stock and logs!")) {
                    if (isConnected && db) {
                        db.ref(DB_ROOT).remove().then(() => {
                            alert("Database wiped clean! Ready for fresh data entry.");
                        });
                    }
                }
            } else if (pwd !== null) {
                alert("Incorrect passcode!");
            }
        });
    }

});
