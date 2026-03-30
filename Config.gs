// ============================================================
// 設定ファイル - ここだけ編集すれば動きます
// ============================================================
const CONFIG = {
  // Claude API キー（ScriptProperties に保存）
  get CLAUDE_API_KEY() {
    return PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  },

  // GitHub Personal Access Token（任意・レート制限緩和のため推奨）
  get GITHUB_TOKEN() {
    return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || '';
  },

  // Google Sheets ID（ScriptProperties に保存）
  get SHEET_ID() {
    return PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  },

  // 送信先メールアドレス
  get EMAIL_TO() {
    return PropertiesService.getScriptProperties().getProperty('EMAIL_TO');
  },

  // メール件名プレフィックス
  EMAIL_SUBJECT_PREFIX: '【Claude Code 日次ニュース】',

  // 何日以内の記事を対象にするか（1 = 昨日以降）
  DAYS_BACK: 1,

  // 1ソースあたり最大取得件数
  MAX_ITEMS_PER_SOURCE: 5,
};
