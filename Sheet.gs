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
 * セル値の数式インジェクションを防ぐ
 * 先頭が = + - @ の場合、Sheets が数式として解釈しないよう ' を前置する
 * （' は文字列マーカーとして扱われ、表示・読み取り値には含まれない）
 * @param {string} value
 * @returns {string}
 */
function sanitizeCell(value) {
  const s = String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
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
 * @param {Array} items
 * @returns {Array} 新規保存したアイテム配列（メール送信対象）
 */
function saveToSheet(items) {
  const sheet = getOrCreateSheet();
  const existingUrls = getExistingUrls(sheet);
  const now = new Date();
  const newItems = [];

  for (const item of items) {
    if (existingUrls.has(item.url)) {
      Logger.log('重複スキップ: ' + item.url);
      continue;
    }

    const dateStr = Utilities.formatDate(item.date, 'Asia/Tokyo', 'yyyy/MM/dd');
    const nowStr  = Utilities.formatDate(now,      'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

    sheet.appendRow([
      dateStr,
      sanitizeCell(item.source),
      sanitizeCell(item.title),
      sanitizeCell(item.url),
      '', // 要約列（廃止済み・既存シートのレイアウト維持のため空欄）
      nowStr,
    ]);
    existingUrls.add(item.url);
    newItems.push(item);
  }

  Logger.log(`シート保存完了: ${newItems.length}件`);
  return newItems;
}
