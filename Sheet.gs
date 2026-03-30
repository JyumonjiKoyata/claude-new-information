// ============================================================
// Google Sheets への保存・重複チェック
// ============================================================

const SHEET_NAME = 'ニュース履歴';
const HEADERS = ['日付', 'ソース', 'タイトル', 'URL', '要約', '取得日時'];

/**
 * シートを初期化（存在しない場合はヘッダーを作成）
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);

    // ヘッダー行のスタイル設定
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setBackground('#1a1a2e');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 100); // 日付
    sheet.setColumnWidth(2, 120); // ソース
    sheet.setColumnWidth(3, 300); // タイトル
    sheet.setColumnWidth(4, 250); // URL
    sheet.setColumnWidth(5, 400); // 要約
    sheet.setColumnWidth(6, 150); // 取得日時
  }

  return sheet;
}

/**
 * 既存URLのセットを返す（重複チェック用）
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Set<string>}
 */
function getExistingUrls(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return new Set();
  const urls = sheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
  return new Set(urls);
}

/**
 * アイテムをシートに保存（重複スキップ）
 * @param {Array} items - summary付きアイテム配列
 * @returns {number} 新規保存件数
 */
function saveToSheet(items) {
  const sheet = getOrCreateSheet();
  const existingUrls = getExistingUrls(sheet);
  const now = new Date();
  let savedCount = 0;

  for (const item of items) {
    if (existingUrls.has(item.url)) {
      Logger.log('重複スキップ: ' + item.url);
      continue;
    }

    const dateStr = Utilities.formatDate(item.date, 'Asia/Tokyo', 'yyyy/MM/dd');
    const nowStr  = Utilities.formatDate(now,      'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    sheet.appendRow([
      dateStr,
      item.source,
      item.title,
      item.url,
      item.summary || '',
      nowStr,
    ]);
    existingUrls.add(item.url);
    savedCount++;
  }

  Logger.log(`シート保存完了: ${savedCount}件`);
  return savedCount;
}
