// ============================================================
// 各ソースからデータを取得する関数群
// ============================================================

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
 * Anthropic 公式ブログの RSS を取得
 * @returns {Array<{title, url, date, source}>}
 */
function fetchAnthropicBlog() {
  const RSS_URL = 'https://www.anthropic.com/rss.xml';
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

    for (const entry of entries) {
      const title   = entry.getChildText('title') || '';
      const link    = entry.getChildText('link')  || '';
      const pubDate = new Date(entry.getChildText('pubDate') || '');

      if (isNaN(pubDate) || pubDate < cutoff) continue;

      // Claude Code 関連のみ絞り込み
      const lowerTitle = title.toLowerCase();
      const desc = (entry.getChildText('description') || '').toLowerCase();
      if (!lowerTitle.includes('claude') && !desc.includes('claude code')) continue;

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
      const date = new Date(r.published_at);
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
      const date = new Date(a.published_at);
      if (date < cutoff) continue;
      items.push({
        title: a.title,
        url: 'https://zenn.dev' + a.path,
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
  const API_URL = `https://qiita.com/api/v2/items?query=tag:claude-code&per_page=${CONFIG.MAX_ITEMS_PER_SOURCE}&sort=created`;
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
      const date = new Date(a.created_at);
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
    ...fetchGitHubReleases(),
    ...fetchZenn(),
    ...fetchQiita(),
  ];
  // 日付降順でソート
  all.sort((a, b) => b.date - a.date);
  return all;
}
