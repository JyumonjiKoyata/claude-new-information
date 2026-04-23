// ============================================================
// エントリーポイント
// ============================================================

/**
 * メイン処理（毎日このファンクションをトリガーする）
 */
function runDailyNews() {
  Logger.log('=== Claude Code 日次ニュース収集 開始 ===');

  try {
    // 1. 全ソースからデータ取得
    Logger.log('【Step 1】情報収集中...');
    const items = fetchAllSources();
    Logger.log(`取得件数: ${items.length}件`);

    if (items.length === 0) {
      Logger.log('新着なし。空のメールを送信します。');
      sendEmail([]);
      return;
    }

    // 2. Google Sheets に保存
    Logger.log('【Step 2】Sheets に保存中...');
    const savedCount = saveToSheet(items);

    // 3. メール送信
    Logger.log('【Step 3】メール送信中...');
    sendEmail(items);

    Logger.log(`=== 完了 ／ 新規保存: ${savedCount}件 ===`);

  } catch (e) {
    Logger.log('runDailyNews エラー: ' + e);
    // エラーが起きた場合もメールで通知
    GmailApp.sendEmail(
      CONFIG.EMAIL_TO,
      '【Claude Code ニュース】エラーが発生しました',
      `実行中にエラーが発生しました。\n\n${e}\n\nGASのログを確認してください。`
    );
  }
}

/**
 * 手動テスト用（DAYS_BACKを7にして過去1週間分を取得）
 */
function runTest() {
  // テスト時は期間を広げる
  const originalDaysBack = CONFIG.DAYS_BACK;
  Object.defineProperty(CONFIG, 'DAYS_BACK', { value: 7, configurable: true });

  runDailyNews();

  Object.defineProperty(CONFIG, 'DAYS_BACK', { value: originalDaysBack, configurable: true });
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
  const required = ['SHEET_ID'];
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
