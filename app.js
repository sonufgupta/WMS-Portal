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
