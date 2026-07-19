// ============================================================
// 各ソースからデータを取得する関数群
// ============================================================

// 実行中に検出した運用警告（メール本文に表示される）
const RUNTIME_WARNINGS = [];

/**
 * カットオフ日時を返す（DAYS_BACK日前の00:00 JST）
 */
function getCutoffDate() {
  const now = new Date();
  now.setDate(now.getDate() - CONFIG.DAYS_BACK);
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * 文字列を Date に変換する。無効な日付は null を返す
 * @param {string} value
 * @returns {Date|null}
 */
function parseValidDate(value) {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * フィードが古い（更新停止の疑いがある）かどうかを判定する
 * @param {string} lastBuildDateStr フィードの lastBuildDate 文字列
 * @param {Date} now 現在時刻
 * @param {number} staleDays 何日更新がなければ古いとみなすか
 * @returns {boolean}
 */
function isFeedStale(lastBuildDateStr, now, staleDays) {
  const lastBuild = parseValidDate(lastBuildDateStr);
  if (!lastBuild) return true;
  const diffMs = now.getTime() - lastBuild.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  return diffDays > staleDays;
}

/**
 * Anthropic 公式ブログの RSS を取得
 * @returns {Array<{title, url, date, source}>}
 */
function fetchAnthropicBlog() {
  // 公式 RSS 廃止のため、コミュニティ維持フィードを使用
  const RSS_URL = 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml';
  const items = [];
  try {
    const res = UrlFetchApp.fetch(RSS_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('Anthropic RSS fetch failed: ' + res.getResponseCode());
      return items;
    }
    const doc = XmlService.parse(res.getContentText());
    const channel = doc.getRootElement().getChild('channel');
    const entries = channel.getChildren('item');
    const cutoff = getCutoffDate();

    // フィードの鮮度を確認（更新停止の早期検知）
    const lastBuild = channel.getChildText('lastBuildDate') || '';
    if (isFeedStale(lastBuild, new Date(), CONFIG.FEED_STALE_DAYS)) {
      const msg = `Anthropic Blog フィードが ${CONFIG.FEED_STALE_DAYS} 日以上更新されていません（lastBuildDate: ${lastBuild || '不明'}）。フィード提供元の停止の可能性があります。`;
      Logger.log('警告: ' + msg);
      RUNTIME_WARNINGS.push(msg);
    }

    for (const entry of entries) {
      const title   = entry.getChildText('title') || '';
      const link    = entry.getChildText('link')  || '';
      const pubDate = parseValidDate(entry.getChildText('pubDate') || '');

      if (!pubDate || pubDate < cutoff) continue;

      // Claude Code 関連のみ絞り込み
      const lowerTitle = title.toLowerCase();
      const desc = (entry.getChildText('description') || '').toLowerCase();
      if (!lowerTitle.includes('claude') && !desc.includes('claude code')) continue;

      // 非公式フィードのため、リンク先を anthropic.com に限定（フィード改ざん対策）
      if (!/^https:\/\/(www\.)?anthropic\.com\//i.test(link.trim())) {
        Logger.log('Anthropic Blog: anthropic.com 以外のリンクをスキップ: ' + link);
        continue;
      }

      items.push({ title, url: link, date: pubDate, source: 'Anthropic Blog' });
      if (items.length >= CONFIG.MAX_ITEMS_PER_SOURCE) break;
    }
  } catch (e) {
    Logger.log('fetchAnthropicBlog error: ' + e);
  }
  return items;
}

/**
 * GitHub anthropics/claude-code のリリース情報を取得
 * @returns {Array<{title, url, date, source, body}>}
 */
function fetchGitHubReleases() {
  const API_URL = 'https://api.github.com/repos/anthropics/claude-code/releases?per_page=10';
  const items = [];
  try {
    const headers = { 'User-Agent': 'GAS-ClaudeNewsBot' };
    if (CONFIG.GITHUB_TOKEN) headers['Authorization'] = 'token ' + CONFIG.GITHUB_TOKEN;

    const res = UrlFetchApp.fetch(API_URL, { headers, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('GitHub Releases fetch failed: ' + res.getResponseCode());
      return items;
    }
    const releases = JSON.parse(res.getContentText());
    const cutoff = getCutoffDate();

    for (const r of releases) {
      const date = parseValidDate(r.published_at);
      if (!date) {
        Logger.log('GitHub Releases: 無効な日付をスキップ: ' + r.published_at);
        continue;
      }
      if (date < cutoff) continue;
      items.push({
        title: `[Release] ${r.tag_name}: ${r.name || r.tag_name}`,
        url: r.html_url,
        date,
        source: 'GitHub Releases',
        body: (r.body || '').substring(0, 800),
      });
      if (items.length >= CONFIG.MAX_ITEMS_PER_SOURCE) break;
    }
  } catch (e) {
    Logger.log('fetchGitHubReleases error: ' + e);
  }
  return items;
}

/**
 * Zenn の「claude-code」タグ記事を取得
 * @returns {Array<{title, url, date, source}>}
 */
function fetchZenn() {
  const API_URL = 'https://zenn.dev/api/articles?topicname=claudecode&order=latest&count=' + CONFIG.MAX_ITEMS_PER_SOURCE;
  const items = [];
  try {
    const res = UrlFetchApp.fetch(API_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('Zenn fetch failed: ' + res.getResponseCode());
      return items;
    }
    const data = JSON.parse(res.getContentText());
    const articles = data.articles || [];
    const cutoff = getCutoffDate();

    for (const a of articles) {
      const date = parseValidDate(a.published_at);
      if (!date) {
        Logger.log('Zenn: 無効な日付をスキップ: ' + a.published_at);
        continue;
      }
      if (date < cutoff) continue;

      // a.path の安全性を正規表現で検証（GAS では new URL() が不安定なため）
      const pathStr = String(a.path || '');
      // 例: /username/articles/slug-or-hex （ユーザー名はアンダースコア可）
      if (!/^\/[A-Za-z0-9_-]+\/articles\/[A-Za-z0-9_-]+$/.test(pathStr)) {
        Logger.log('Zenn: 無効なパスをスキップ: ' + pathStr);
        continue;
      }
      const articleUrl = 'https://zenn.dev' + pathStr;

      items.push({
        title: a.title,
        url: articleUrl,
        date,
        source: 'Zenn',
      });
    }
  } catch (e) {
    Logger.log('fetchZenn error: ' + e);
  }
  return items;
}

/**
 * Qiita の「claude-code」タグ記事を取得
 * @returns {Array<{title, url, date, source}>}
 */
function fetchQiita() {
  const API_URL = `https://qiita.com/api/v2/items?query=tag:claude-code&per_page=${CONFIG.MAX_ITEMS_PER_SOURCE}`;
  const items = [];
  try {
    const res = UrlFetchApp.fetch(API_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('Qiita fetch failed: ' + res.getResponseCode());
      return items;
    }
    const articles = JSON.parse(res.getContentText());
    const cutoff = getCutoffDate();

    for (const a of articles) {
      const date = parseValidDate(a.created_at);
      if (!date) {
        Logger.log('Qiita: 無効な日付をスキップ: ' + a.created_at);
        continue;
      }
      if (date < cutoff) continue;
      items.push({
        title: a.title,
        url: a.url,
        date,
        source: 'Qiita',
      });
    }
  } catch (e) {
    Logger.log('fetchQiita error: ' + e);
  }
  return items;
}

/**
 * 全ソースからまとめて取得
 * @returns {Array}
 */
function fetchAllSources() {
  const all = [
    ...fetchAnthropicBlog(),
    ...fetchGitHubReleases(),
    ...fetchZenn(),
    ...fetchQiita(),
  ];
  // 日付降順でソート
  all.sort((a, b) => b.date - a.date);
  return all;
}
