// ============================================================
// 各ソースからデータを取得する関数群
// ============================================================

/**
 * カットオフ日時を返す（daysBack日前の00:00 JST）
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {Date}
 */
function getCutoffDate(daysBack = CONFIG.DAYS_BACK) {
  const now = new Date();
  now.setDate(now.getDate() - daysBack);
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
 * 日付文字列をパースし、無効値やカットオフより古い場合は null を返す（無効値はログに記録）
 * @param {string} rawDate
 * @param {string} label ログ表示用のソース名
 * @param {Date} cutoff このDate以降のみ有効とみなす
 * @returns {Date|null}
 */
function parseDateOrSkip(rawDate, label, cutoff) {
  const date = parseValidDate(rawDate);
  if (!date) {
    Logger.log(label + ': 無効な日付をスキップ: ' + rawDate);
    return null;
  }
  return date < cutoff ? null : date;
}

/**
 * 値が正規表現パターンに一致するかを検証する（URL・パス等の信頼性検証で共通利用）
 * @param {string} value
 * @param {RegExp} pattern
 * @returns {boolean}
 */
function isTrustedPattern(value, pattern) {
  return pattern.test(String(value || '').trim());
}

/**
 * GitHub Releases の html_url が想定ドメイン・パス内かを検証する
 * @param {string} url
 * @returns {boolean}
 */
function isTrustedGithubReleaseUrl(url) {
  return isTrustedPattern(url, /^https:\/\/github\.com\/anthropics\/claude-code\/releases\//i);
}

/**
 * Qiita の url が qiita.com ドメインかを検証する
 * @param {string} url
 * @returns {boolean}
 */
function isTrustedQiitaUrl(url) {
  return isTrustedPattern(url, /^https:\/\/qiita\.com\//i);
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
 * RSSのitem群から、期間内・キーワード一致・ドメイン検証を満たす記事を抽出する
 * @param {Array} entries XmlServiceのitem要素配列
 * @param {string} sourceName 表示用ソース名
 * @param {Date} cutoff このDate以降のみ対象
 * @returns {Array<{title, url, date, source}>}
 */
function parseAnthropicFeedEntries(entries, sourceName, cutoff) {
  const items = [];
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
    if (!isTrustedPattern(link.trim(), /^https:\/\/(www\.)?anthropic\.com\//i)) {
      Logger.log(sourceName + ': anthropic.com 以外のリンクをスキップ: ' + link);
      continue;
    }

    items.push({ title, url: link, date: pubDate, source: sourceName });
    if (items.length >= CONFIG.MAX_ITEMS_PER_SOURCE) break;
  }
  return items;
}

/**
 * Anthropic 公式情報を RSS から取得（News + Engineering）
 * 公式 RSS 廃止のため、コミュニティ維持フィード（Olshansk/rss-feeds, 毎時更新）を使用
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {{items: Array<{title, url, date, source}>, warnings: string[]}}
 */
function fetchAnthropicBlog(daysBack = CONFIG.DAYS_BACK) {
  const newsResult = fetchAnthropicRss(CONFIG.ANTHROPIC_NEWS_RSS_URL, 'Anthropic News', daysBack);
  const engResult   = fetchAnthropicRss(CONFIG.ANTHROPIC_ENGINEERING_RSS_URL, 'Anthropic Engineering', daysBack);
  return {
    items: [...newsResult.items, ...engResult.items],
    warnings: [...newsResult.warnings, ...engResult.warnings],
  };
}

/**
 * 指定した Anthropic RSS フィードから記事を取得する共通処理
 * @param {string} rssUrl フィードURL
 * @param {string} sourceName 表示用ソース名
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {{items: Array<{title, url, date, source}>, warnings: string[]}}
 */
function fetchAnthropicRss(rssUrl, sourceName, daysBack = CONFIG.DAYS_BACK) {
  let items = [];
  const warnings = [];
  try {
    const res = UrlFetchApp.fetch(rssUrl, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log(sourceName + ' RSS fetch failed: ' + res.getResponseCode());
      return { items, warnings };
    }
    const doc = XmlService.parse(res.getContentText());
    const channel = doc.getRootElement().getChild('channel');
    const entries = channel.getChildren('item');
    const cutoff = getCutoffDate(daysBack);

    // フィードの鮮度を確認（更新停止の早期検知）
    const lastBuild = channel.getChildText('lastBuildDate') || '';
    if (isFeedStale(lastBuild, new Date(), CONFIG.FEED_STALE_DAYS)) {
      const msg = `${sourceName} フィードが ${CONFIG.FEED_STALE_DAYS} 日以上更新されていません（lastBuildDate: ${lastBuild || '不明'}）。フィード提供元の停止の可能性があります。`;
      Logger.log('警告: ' + msg);
      warnings.push(msg);
    }

    items = parseAnthropicFeedEntries(entries, sourceName, cutoff);
  } catch (e) {
    Logger.log('fetchAnthropicRss(' + sourceName + ') error: ' + e);
  }
  return { items, warnings };
}

/**
 * GitHub anthropics/claude-code のリリース情報を取得
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {Array<{title, url, date, source}>}
 */
function fetchGitHubReleases(daysBack = CONFIG.DAYS_BACK) {
  const API_URL = `${CONFIG.GITHUB_RELEASES_API_URL}?per_page=${CONFIG.GITHUB_RELEASES_PER_PAGE}`;
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
    const cutoff = getCutoffDate(daysBack);

    for (const r of releases) {
      const date = parseDateOrSkip(r.published_at, 'GitHub Releases', cutoff);
      if (!date) continue;
      if (!isTrustedGithubReleaseUrl(r.html_url)) {
        Logger.log('GitHub Releases: 想定外URLをスキップ: ' + r.html_url);
        continue;
      }
      items.push({
        title: `[Release] ${r.tag_name}: ${r.name || r.tag_name}`,
        url: r.html_url,
        date,
        source: 'GitHub Releases',
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
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {Array<{title, url, date, source}>}
 */
function fetchZenn(daysBack = CONFIG.DAYS_BACK) {
  const API_URL = `${CONFIG.ZENN_API_URL}?topicname=${CONFIG.ZENN_TOPIC}&order=latest&count=${CONFIG.MAX_ITEMS_PER_SOURCE}`;
  const items = [];
  try {
    const res = UrlFetchApp.fetch(API_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('Zenn fetch failed: ' + res.getResponseCode());
      return items;
    }
    const data = JSON.parse(res.getContentText());
    const articles = data.articles || [];
    const cutoff = getCutoffDate(daysBack);

    for (const a of articles) {
      const date = parseDateOrSkip(a.published_at, 'Zenn', cutoff);
      if (!date) continue;

      // a.path の安全性を正規表現で検証（GAS では new URL() が不安定なため）
      const pathStr = String(a.path || '');
      // 例: /username/articles/slug-or-hex （ユーザー名はアンダースコア可）
      if (!isTrustedPattern(pathStr, /^\/[A-Za-z0-9_-]+\/articles\/[A-Za-z0-9_-]+$/)) {
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
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {Array<{title, url, date, source}>}
 */
function fetchQiita(daysBack = CONFIG.DAYS_BACK) {
  const API_URL = `${CONFIG.QIITA_API_URL}?query=tag:${CONFIG.QIITA_TAG}&per_page=${CONFIG.MAX_ITEMS_PER_SOURCE}`;
  const items = [];
  try {
    const res = UrlFetchApp.fetch(API_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      Logger.log('Qiita fetch failed: ' + res.getResponseCode());
      return items;
    }
    const articles = JSON.parse(res.getContentText());
    const cutoff = getCutoffDate(daysBack);

    for (const a of articles) {
      const date = parseDateOrSkip(a.created_at, 'Qiita', cutoff);
      if (!date) continue;
      if (!isTrustedQiitaUrl(a.url)) {
        Logger.log('Qiita: 想定外URLをスキップ: ' + a.url);
        continue;
      }
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
 * @param {number} [daysBack] 省略時は CONFIG.DAYS_BACK
 * @returns {{items: Array, warnings: string[]}}
 */
function fetchAllSources(daysBack = CONFIG.DAYS_BACK) {
  const blog = fetchAnthropicBlog(daysBack);
  const items = [
    ...blog.items,
    ...fetchGitHubReleases(daysBack),
    ...fetchZenn(daysBack),
    ...fetchQiita(daysBack),
  ];
  // 日付降順でソート
  items.sort((a, b) => b.date - a.date);
  return { items, warnings: blog.warnings };
}
