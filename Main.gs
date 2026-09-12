// ============================================================
// エントリーポイント
// ============================================================

/**
 * メイン処理（毎日このファンクションをトリガーする）
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK。手動確認用に期間を広げたい場合に指定する
 */
function runDailyNews(daysBack = CONFIG.DAYS_BACK) {
  // 同時実行（トリガー＋手動）による重複を防ぐ
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(CONFIG.LOCK_TIMEOUT_MS)) {
    Logger.log('別の実行が進行中のためスキップします');
    return;
  }
  try {
    Logger.log('=== Claude Code 日次ニュース収集 開始 ===');

    try {
      // 1. 全ソースからデータ取得
      Logger.log('【Step 1】情報収集中...');
      const { items, warnings } = fetchAllSources(daysBack);
      Logger.log(`取得件数: ${items.length}件`);

      if (items.length === 0) {
        Logger.log('新着なし。空のメールを送信します。');
        sendEmail([], warnings);
        return;
      }

      // 2. Google Sheets に保存（新規アイテムのみ返る）
      Logger.log('【Step 2】Sheets に保存中...');
      const newItems = saveToSheet(items);

      // 3. メール送信（保存済みの重複を除いた新規分のみ）
      Logger.log('【Step 3】メール送信中...');
      sendEmail(newItems, warnings);

      Logger.log(`=== 完了 ／ 新規保存: ${newItems.length}件 ===`);

    } catch (e) {
      // スタックトレースを含む詳細はログにのみ記録
      Logger.log('runDailyNews エラー: ' + (e && e.stack ? e.stack : e));
      // メールにはメッセージ概要のみ送信（内部パス・行番号の漏洩防止）
      const summary = e instanceof Error ? e.message : String(e).substring(0, 200);
      GmailApp.sendEmail(
        CONFIG.EMAIL_TO,
        '【Claude Code ニュース】エラーが発生しました',
        `実行中にエラーが発生しました。\n\nエラー概要: ${summary}\n\nGAS のログで詳細を確認してください。`
      );
    }
  } finally {
    lock.releaseLock();
  }
}

/**
 * 手動動作確認用（過去7日分を対象に実行）
 * 注意: ドライランではない。実際に EMAIL_TO へメール送信し、Sheets にも書き込まれる
 */
function runTest() {
  runDailyNews(7);
}

/**
 * 初期セットアップ（初回のみ実行）
 * - スクリプトプロパティの確認
 * - Sheetsのヘッダー作成
 * - 日次トリガーの設定
 */
function setup() {
  const props = PropertiesService.getScriptProperties();

  // 必須プロパティの確認
  const required = ['SHEET_ID', 'EMAIL_TO'];
  const missing = required.filter(k => !props.getProperty(k));
  if (missing.length > 0) {
    throw new Error(`スクリプトプロパティが未設定です: ${missing.join(', ')}\n` +
      '「プロジェクトの設定」→「スクリプト プロパティ」から設定してください。');
  }

  // Sheetsの初期化
  getOrCreateSheet();
  Logger.log('Sheets の初期化完了');

  // 既存トリガーを削除してから再作成
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runDailyNews') ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('runDailyNews')
    .timeBased()
    .everyDays(1)
    .atHour(8)       // 毎朝 8:00 JST
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('トリガー設定完了: 毎朝 8:00 JST');
  Logger.log('=== セットアップ完了 ===');
}
