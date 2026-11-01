/**
 * FinTrack — Backend Google Apps Script (GAS) & Google Sheets Database
 * Sesuai spesifikasi PRD v1.0:
 * - Sheet "Transaksi": Menyimpan riwayat pemasukan & pengeluaran
 * - Sheet "Kategori": Menyimpan daftar kategori bawaan & kustom
 */

const SHEET_TRANSAKSI = 'Transaksi';
const SHEET_KATEGORI = 'Kategori';
const SHEET_ASET = 'Aset';

const DEFAULT_CATEGORIES_SEED = [
  ['cat-makan', 'Makan', 'Pengeluaran', '#f43f5e', true],
  ['cat-transportasi', 'Transportasi', 'Pengeluaran', '#f97316', true],
  ['cat-tagihan', 'Tagihan', 'Pengeluaran', '#eab308', true],
  ['cat-hiburan', 'Hiburan', 'Pengeluaran', '#8b5cf6', true],
  ['cat-belanja', 'Belanja', 'Pengeluaran', '#06b6d4', false],
  ['cat-kesehatan', 'Kesehatan', 'Pengeluaran', '#ec4899', false],
  ['cat-gaji', 'Gaji', 'Pemasukan', '#10b981', true],
  ['cat-bonus', 'Bonus & Freelance', 'Pemasukan', '#14b8a6', false],
  ['cat-investasi', 'Hasil Investasi', 'Pemasukan', '#3b82f6', false],
];

/**
 * Inisialisasi Sheet "Transaksi" dan "Kategori" jika belum tersedia di Spreadsheet
 */
function ensureDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Sheet Transaksi
  let txSheet = ss.getSheetByName(SHEET_TRANSAKSI);
  if (!txSheet) {
    txSheet = ss.insertSheet(SHEET_TRANSAKSI);
    txSheet.appendRow([
      'ID',
      'Tanggal',
      'Jenis',
      'Kategori',
      'Nominal',
      'Catatan',
      'CreatedAt',
      'AssetID',
      'AssetName',
      'FromAssetID',
      'ToAssetID',
      'AdminFee',
    ]);
    txSheet.getRange('A1:L1').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    txSheet.setFrozenRows(1);
  }

  // 2. Sheet Kategori
  let catSheet = ss.getSheetByName(SHEET_KATEGORI);
  if (!catSheet) {
    catSheet = ss.insertSheet(SHEET_KATEGORI);
    catSheet.appendRow(['ID', 'Nama', 'Jenis', 'Warna', 'IsDefault']);
    catSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    catSheet.setFrozenRows(1);

    DEFAULT_CATEGORIES_SEED.forEach((row) => catSheet.appendRow(row));
  }

  // 3. Sheet Aset (Pelacakan Aset & Kekayaan Dimiliki)
  let assetSheet = ss.getSheetByName(SHEET_ASET);
  if (!assetSheet) {
    assetSheet = ss.insertSheet(SHEET_ASET);
    assetSheet.appendRow(['ID', 'Nama', 'Kategori', 'Nilai', 'Catatan', 'UpdatedAt']);
    assetSheet.getRange('A1:F1').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff');
    assetSheet.setFrozenRows(1);
  }

  return { txSheet, catSheet, assetSheet };
}

/**
 * Handler GET Request (Mendukung JSON API via ?action=getAll atau HtmlService)
 */
function doGet(e) {
  ensureDatabaseSheets();

  if (e && e.parameter && e.parameter.action === 'getAll') {
    const result = getAllData();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  }

  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('FinTrack — Pencatatan Keuangan Pribadi')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (err) {
    const result = getAllData();
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  }
}

/**
 * Handler POST Request (Menerima payload JSON dari Frontend Web App)
 */
function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const result = handleClientRequest(body);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Router Logika Bisnis Utama (Digunakan oleh doPost maupun google.script.run)
 */
function handleClientRequest(request) {
  ensureDatabaseSheets();
  const action = request && request.action ? request.action : 'getAll';
  const payload = (request && request.payload) || {};

  switch (action) {
    case 'getAll':
      return getAllData();
    case 'addTransaction':
      return addTransaction(payload);
    case 'updateTransaction':
      return updateTransaction(payload);
    case 'deleteTransaction':
      return deleteTransaction(payload.id);
    case 'saveCategories':
      return saveCategories(payload.categories);
    case 'addAsset':
      return addAsset(payload);
    case 'updateAsset':
      return updateAsset(payload);
    case 'deleteAsset':
      return deleteAsset(payload.id);
    default:
      return { success: false, error: 'Action tidak dikenali: ' + action };
  }
}

/**
 * Mengambil seluruh data Transaksi, Kategori, dan Aset dari Google Sheets
 */
function getAllData() {
  const { txSheet, catSheet, assetSheet } = ensureDatabaseSheets();

  // Baca Transaksi
  const txValues = txSheet.getDataRange().getValues();
  const transactions = [];
  for (let i = 1; i < txValues.length; i++) {
    const [
      id,
      rawDate,
      type,
      category,
      amount,
      note,
      createdAt,
      assetId,
      assetName,
      fromAssetId,
      toAssetId,
      adminFee,
    ] = txValues[i];
    if (!id) continue;

    let formattedDate = rawDate;
    if (rawDate instanceof Date) {
      formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      formattedDate = String(rawDate).slice(0, 10);
    }

    transactions.push({
      id: String(id),
      date: formattedDate,
      type: String(type || 'Pengeluaran'),
      category: String(category || 'Lainnya'),
      amount: Number(amount) || 0,
      note: String(note || ''),
      createdAt: String(createdAt || ''),
      assetId: String(assetId || ''),
      assetName: String(assetName || ''),
      fromAssetId: String(fromAssetId || ''),
      toAssetId: String(toAssetId || ''),
      adminFee: Number(adminFee) || 0,
    });
  }

  // Baca Kategori
  const catValues = catSheet.getDataRange().getValues();
  const categories = [];
  for (let i = 1; i < catValues.length; i++) {
    const [id, name, type, color, isDefault] = catValues[i];
    if (!name) continue;
    categories.push({
      id: String(id || 'cat-' + i),
      name: String(name),
      type: String(type || 'Pengeluaran'),
      color: String(color || '#10b981'),
      isDefault: Boolean(isDefault),
    });
  }

  // Baca Aset
  const assetValues = assetSheet.getDataRange().getValues();
  const assets = [];
  for (let i = 1; i < assetValues.length; i++) {
    const [id, name, category, value, note, updatedAt] = assetValues[i];
    if (!id && !name) continue;

    let formattedUpdated = updatedAt;
    if (updatedAt instanceof Date) {
      formattedUpdated = Utilities.formatDate(updatedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      formattedUpdated = String(updatedAt || '').slice(0, 10);
    }

    assets.push({
      id: String(id || 'ast-' + i),
      name: String(name || 'Aset'),
      category: String(category || 'Kas & Bank'),
      value: Number(value) || 0,
      note: String(note || ''),
      updatedAt: formattedUpdated,
    });
  }

  return {
    success: true,
    transactions: transactions.reverse(),
    categories,
    assets,
  };
}

/**
 * Menambahkan baris transaksi baru ke Sheet "Transaksi"
 */
function addTransaction(tx) {
  const { txSheet } = ensureDatabaseSheets();
  txSheet.appendRow([
    tx.id || 'tx-' + new Date().getTime(),
    tx.date,
    tx.type,
    tx.category,
    Number(tx.amount) || 0,
    tx.note || '',
    tx.createdAt || new Date().toISOString(),
    tx.assetId || '',
    tx.assetName || '',
    tx.fromAssetId || '',
    tx.toAssetId || '',
    Number(tx.adminFee) || 0,
  ]);
  return { success: true };
}

/**
 * Memperbarui baris transaksi berdasarkan ID di Sheet "Transaksi"
 */
function updateTransaction(tx) {
  const { txSheet } = ensureDatabaseSheets();
  const data = txSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(tx.id)) {
      txSheet
        .getRange(i + 1, 1, 1, 12)
        .setValues([
          [
            tx.id,
            tx.date,
            tx.type,
            tx.category,
            Number(tx.amount) || 0,
            tx.note || '',
            tx.createdAt || new Date().toISOString(),
            tx.assetId || '',
            tx.assetName || '',
            tx.fromAssetId || '',
            tx.toAssetId || '',
            Number(tx.adminFee) || 0,
          ],
        ]);
      return { success: true };
    }
  }
  return addTransaction(tx);
}

/**
 * Menghapus baris transaksi berdasarkan ID di Sheet "Transaksi"
 */
function deleteTransaction(id) {
  const { txSheet } = ensureDatabaseSheets();
  const data = txSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      txSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'ID transaksi tidak ditemukan' };
}

/**
 * Menyimpan daftar kategori terbaru ke Sheet "Kategori"
 */
function saveCategories(categories) {
  if (!Array.isArray(categories)) return { success: false, error: 'Format kategori tidak valid' };

  const { catSheet } = ensureDatabaseSheets();
  const lastRow = catSheet.getLastRow();
  if (lastRow > 1) {
    catSheet.getRange(2, 1, lastRow - 1, 5).clearContent();
  }

  if (categories.length > 0) {
    const rows = categories.map((c) => [
      c.id || 'cat-' + new Date().getTime(),
      c.name,
      c.type || 'Pengeluaran',
      c.color || '#10b981',
      Boolean(c.isDefault),
    ]);
    catSheet.getRange(2, 1, rows.length, 5).setValues(rows);
  }

  return { success: true };
}

/**
 * Menambahkan baris aset baru ke Sheet "Aset"
 */
function addAsset(asset) {
  const { assetSheet } = ensureDatabaseSheets();
  assetSheet.appendRow([
    asset.id || 'ast-' + new Date().getTime(),
    asset.name,
    asset.category || 'Kas & Bank',
    Number(asset.value) || 0,
    asset.note || '',
    asset.updatedAt || new Date().toISOString().slice(0, 10),
  ]);
  return { success: true };
}

/**
 * Memperbarui baris aset berdasarkan ID di Sheet "Aset"
 */
function updateAsset(asset) {
  const { assetSheet } = ensureDatabaseSheets();
  const data = assetSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(asset.id)) {
      assetSheet
        .getRange(i + 1, 1, 1, 6)
        .setValues([
          [
            asset.id,
            asset.name,
            asset.category || 'Kas & Bank',
            Number(asset.value) || 0,
            asset.note || '',
            asset.updatedAt || new Date().toISOString().slice(0, 10),
          ],
        ]);
      return { success: true };
    }
  }
  return addAsset(asset);
}

/**
 * Menghapus baris aset berdasarkan ID di Sheet "Aset"
 */
function deleteAsset(id) {
  const { assetSheet } = ensureDatabaseSheets();
  const data = assetSheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      assetSheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'ID aset tidak ditemukan' };
}
