// ============================================================
// 設定ファイル - ここだけ編集すれば動きます
// ============================================================
const CONFIG = {
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

  // フィードの lastBuildDate がこの日数より古ければ警告
  FEED_STALE_DAYS: 7,

  // 同時実行防止ロックの最大待機時間（ミリ秒）
  LOCK_TIMEOUT_MS: 30 * 1000,

  // GitHub Releases API の1回あたり取得件数
  GITHUB_RELEASES_PER_PAGE: 10,

  // Anthropic 公式情報（コミュニティ維持の代替RSS。公式RSS廃止のため使用）
  ANTHROPIC_NEWS_RSS_URL: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml',
  ANTHROPIC_ENGINEERING_RSS_URL: 'https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_engineering.xml',

  // GitHub Releases API
  GITHUB_RELEASES_API_URL: 'https://api.github.com/repos/anthropics/claude-code/releases',

  // Zenn API
  ZENN_API_URL: 'https://zenn.dev/api/articles',
  ZENN_TOPIC: 'claudecode',

  // Qiita API
  QIITA_API_URL: 'https://qiita.com/api/v2/items',
  QIITA_TAG: 'claude-code',
};
