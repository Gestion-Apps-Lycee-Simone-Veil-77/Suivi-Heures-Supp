import { google } from 'googleapis';
import { config } from './config.js';

const auth = new google.auth.GoogleAuth({
  keyFile: config.serviceAccountKeyFile,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheetsApi = google.sheets({ version: 'v4', auth });

// ---------- Lecture ----------

export async function getSheetValues(sheetName, range = 'A1:ZZ') {
  try {
    const res = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: `${sheetName}!${range}`
    });
    return res.data.values || [];
  } catch (err) {
    if (err.code === 400 || err.code === 404) return []; // onglet absent
    throw err;
  }
}

// Lit uniquement la ligne d'en-têtes réelle d'un onglet (ordre des colonnes
// TEL QU'IL EST VRAIMENT sur la feuille, pas l'ordre supposé côté code) —
// indispensable avant d'écrire une ligne avec appendObjectRow(), sinon les
// valeurs peuvent atterrir dans les mauvaises colonnes si la feuille a un
// ordre différent de TYPE_COLUMNS (ex: feuille existante, ancienne, modifiée).
export async function getHeaders(sheetName) {
  const values = await getSheetValues(sheetName, 'A1:ZZ1');
  return values[0] || [];
}

// Équivalent de readSheetAsObjects() côté Apps Script : première ligne = en-têtes,
// chaque ligne suivante devient un objet { colonne: valeur, __row: numéro réel }.
export async function readSheetAsObjects(sheetName) {
  const values = await getSheetValues(sheetName);
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0];
  const rows = values.slice(1).map((r, i) => {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = r[j] !== undefined ? r[j] : ''; });
    obj.__row = i + 2;
    return obj;
  });
  return { headers, rows };
}

export async function findRowById(sheetName, id) {
  const { headers, rows } = await readSheetAsObjects(sheetName);
  const found = rows.find(r => r.ID === id);
  if (!found) return null;
  return { headers, row: found, rowNumber: found.__row };
}

// ---------- Écriture ----------

export async function appendObjectRow(sheetName, headers, obj) {
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
}

export async function updateRow(sheetName, rowNumber, headers, obj) {
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ''));
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] }
  });
}

let sheetIdCache = null;
async function refreshSheetIdCache() {
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId: config.spreadsheetId });
  sheetIdCache = {};
  meta.data.sheets.forEach(s => { sheetIdCache[s.properties.title] = s.properties.sheetId; });
  return sheetIdCache;
}

export async function sheetExists(name) {
  const cache = sheetIdCache || (await refreshSheetIdCache());
  if (name in cache) return true;
  return name in (await refreshSheetIdCache());
}

export async function deleteRow(sheetName, rowNumber) {
  let cache = sheetIdCache || (await refreshSheetIdCache());
  if (!(sheetName in cache)) cache = await refreshSheetIdCache();
  const sheetId = cache[sheetName];
  if (sheetId === undefined) throw new Error(`Onglet introuvable : ${sheetName}`);
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [{
        deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: rowNumber - 1, endIndex: rowNumber } }
      }]
    }
  });
}

export async function createSheet(name, headerRow) {
  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: name } } }] }
  });
  sheetIdCache = null;
  if (headerRow) {
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: config.spreadsheetId,
      range: `${name}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headerRow] }
    });
  }
}

// Ajoute les colonnes manquantes d'une liste attendue à un onglet existant
// (équivalent de la partie "colonnes de workflow" de setupWorkflowSheets côté Apps Script).
export async function ensureColumns(sheetName, expectedCols) {
  const values = await getSheetValues(sheetName, 'A1:ZZ1');
  const header = values[0] || [];
  const missing = expectedCols.filter(c => !header.includes(c));
  if (!missing.length) return;
  const newHeader = [...header, ...missing];
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [newHeader] }
  });
}
