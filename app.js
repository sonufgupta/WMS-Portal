// GOOGLE SHEETS BACKEND

const GOOGLE_SHEETS_API_URL =
    'https://script.google.com/macros/s/AKfycbxTyudCQ67CWT-GoXc43MUnG18PBkDiYiGA2fGgXRUEUkCUhfCYNaRJXDsRiPPTnZy8/exec';

async function googleSheetsGet(sheetName) {
    const url =
        `${GOOGLE_SHEETS_API_URL}?action=read&sheet=${encodeURIComponent(sheetName)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Google Sheets read failed');
    }

    return data;
}

async function googleSheetsAppend(sheetName, rows) {
    const payload = {
        action: 'append',
        sheet: sheetName,
        rows: rows
    };

    const response = await fetch(GOOGLE_SHEETS_API_URL, {
        method: 'POST',
        body: new URLSearchParams({
            payload: JSON.stringify(payload)
        })
    });

    const data = await response.json();

    if (!data.success) {
        throw new Error(data.error || 'Google Sheets write failed');
    }

    return data;
}
function saveHistory(historyData) {
    cachedInboundHistory = historyData;
    weightResolutionCache = null;
    cachedProductStockMap = null;

    // Existing local cache — keep unchanged
    localStorage.setItem(
        'wms_inbound_history',
        JSON.stringify(historyData)
    );

    // Existing Firebase backup — keep unchanged
    firebaseSet('inbound_history', historyData);

    // Google Sheets backend
    // Save only the latest inbound log in sheet format.
    const latestLog = Array.isArray(historyData) && historyData.length
        ? historyData[0]
        : null;

    if (latestLog && Array.isArray(latestLog.serials)) {
        const rows = latestLog.serials.map(serialObj => {
            const itemName =
                serialObj.itemName ||
                latestLog.item ||
                '';

            const weight =
                serialObj.weight ??
                latestLog.weights?.[itemName] ??
                '';

            return [
                latestLog.id || '',
                latestLog.timestamp || '',
                latestLog.vehicle || '',
                itemName,
                serialObj.serial || '',
                serialObj.boxNo || '',
                weight,
                'COMPLETED'
            ];
        });

        if (rows.length > 0) {
            googleSheetsAppend('INBOUND', rows)
                .then(result => {
                    console.log(
                        'Google Sheets INBOUND saved:',
                        result
                    );
                })
                .catch(error => {
                    console.error(
                        'Google Sheets INBOUND save failed:',
                        error
                    );
                });
        }
    }
}
