// ============================================================
// ユニットテスト（フレームワーク不使用・ローカル専用）
// .claspignore により GAS へは push されない（本番プロジェクトの関数一覧を汚さないため）
// 実行するには node test/run_local.js を使う
// ============================================================

// 実行したアサーション数（GAS エディタ実行時のログ確認用）
let TEST_COUNT = 0;

/**
 * 簡易アサーションヘルパー
 * 失敗時は throw、成功時は Logger.log
 * @param {boolean} cond
 * @param {string} name
 */
function assert(cond, name) {
  TEST_COUNT++;
  if (!cond) {
    throw new Error('FAIL: ' + name);
  }
  Logger.log('PASS: ' + name);
}

/**
 * parseValidDate のテスト
 */
function testParseValidDate() {
  const d1 = parseValidDate('2026-07-19T00:00:00Z');
  assert(d1 instanceof Date && !isNaN(d1.getTime()), 'parseValidDate: 有効なISO文字列はDateを返す');

  assert(parseValidDate(undefined) === null, 'parseValidDate: undefinedはnullを返す');

  // new Date(null) は new Date(0) に coerce される（1970-01-01）。この挙動を明示的に固定する
  const dNull = parseValidDate(null);
  assert(dNull instanceof Date && dNull.getTime() === 0, 'parseValidDate: nullは0にcoerceされ1970年のDateを返す');

  assert(parseValidDate('garbage') === null, 'parseValidDate: 不正な文字列はnullを返す');

  const dRfc2822 = parseValidDate('Wed, 10 Jun 2026 00:00:00 +0000');
  assert(dRfc2822 instanceof Date && !isNaN(dRfc2822.getTime()), 'parseValidDate: RFC2822形式はDateを返す');
}

/**
 * isFeedStale のテスト
 */
function testIsFeedStale() {
  const now = new Date('2026-07-19T00:00:00Z');
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo   = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const exactlySevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  assert(isFeedStale(threeDaysAgo, now, 7) === false, 'isFeedStale: 3日前はfalse');
  assert(isFeedStale(tenDaysAgo, now, 7) === true, 'isFeedStale: 10日前はtrue');
  assert(isFeedStale('', now, 7) === true, 'isFeedStale: 空文字はtrue');
  assert(isFeedStale('garbage', now, 7) === true, 'isFeedStale: パース不能文字列はtrue');
  assert(isFeedStale(exactlySevenDaysAgo, now, 7) === false, 'isFeedStale: ちょうど7日前はfalse（境界）');
}

/**
 * escapeSheetFormula のテスト
 */
function testEscapeSheetFormula() {
  assert(escapeSheetFormula('=SUM(A1)') === "'=SUM(A1)", 'escapeSheetFormula: =始まりはエスケープされる');
  assert(escapeSheetFormula('+x') === "'+x", 'escapeSheetFormula: +始まりはエスケープされる');
  assert(escapeSheetFormula('-x') === "'-x", 'escapeSheetFormula: -始まりはエスケープされる');
  assert(escapeSheetFormula('@x') === "'@x", 'escapeSheetFormula: @始まりはエスケープされる');
  assert(escapeSheetFormula('normal') === 'normal', 'escapeSheetFormula: 通常文字列はそのまま');
}

/**
 * enforceHttpsScheme のテスト
 */
function testEnforceHttpsScheme() {
  assert(enforceHttpsScheme('https://a.com') === 'https://a.com', 'enforceHttpsScheme: httpsはそのまま');
  assert(enforceHttpsScheme('javascript:alert(1)') === '#', 'enforceHttpsScheme: javascript:は#に置換される');
  assert(enforceHttpsScheme('  https://a.com  ') === 'https://a.com', 'enforceHttpsScheme: 前後の空白はtrimされる');
  assert(enforceHttpsScheme('http://example.com') === '#', 'enforceHttpsScheme: http://は#に置換される（https限定）');
}

/**
 * isTrustedGithubReleaseUrl のテスト
 */
function testIsTrustedGithubReleaseUrl() {
  assert(isTrustedGithubReleaseUrl('https://github.com/anthropics/claude-code/releases/tag/v1.0.0') === true,
    'isTrustedGithubReleaseUrl: 正規のリリースURLはtrue');
  assert(isTrustedGithubReleaseUrl('https://evil.com/anthropics/claude-code/releases/tag/v1.0.0') === false,
    'isTrustedGithubReleaseUrl: 別ドメインはfalse');
  assert(isTrustedGithubReleaseUrl('http://github.com/anthropics/claude-code/releases/tag/v1.0.0') === false,
    'isTrustedGithubReleaseUrl: httpはfalse');
  assert(isTrustedGithubReleaseUrl('') === false, 'isTrustedGithubReleaseUrl: 空文字はfalse');
  assert(isTrustedGithubReleaseUrl(undefined) === false, 'isTrustedGithubReleaseUrl: undefinedはfalse');
}

/**
 * isTrustedQiitaUrl のテスト
 */
function testIsTrustedQiitaUrl() {
  assert(isTrustedQiitaUrl('https://qiita.com/someuser/items/abc123') === true,
    'isTrustedQiitaUrl: 正規のQiita URLはtrue');
  assert(isTrustedQiitaUrl('https://evil.com/qiita.com/items/abc123') === false,
    'isTrustedQiitaUrl: 別ドメインはfalse');
  assert(isTrustedQiitaUrl('http://qiita.com/someuser/items/abc123') === false,
    'isTrustedQiitaUrl: httpはfalse');
  assert(isTrustedQiitaUrl('') === false, 'isTrustedQiitaUrl: 空文字はfalse');
}

/**
 * parseDateOrSkip のテスト
 */
function testParseDateOrSkip() {
  const cutoff = new Date('2026-09-01T00:00:00Z');
  assert(parseDateOrSkip('2026-09-05T00:00:00Z', 'X', cutoff) instanceof Date,
    'parseDateOrSkip: cutoff以降の有効日付はDateを返す');
  assert(parseDateOrSkip('garbage', 'X', cutoff) === null,
    'parseDateOrSkip: 無効な文字列はnullを返す');
  assert(parseDateOrSkip('2026-08-01T00:00:00Z', 'X', cutoff) === null,
    'parseDateOrSkip: cutoffより古い日付はnullを返す');
}

/**
 * buildSheetRows のテスト
 */
function testBuildSheetRows() {
  const now = new Date('2026-07-19T10:00:00+09:00');
  const makeItem = (url, title) => ({
    title: title || 'タイトル',
    url,
    date: new Date('2026-07-19T08:00:00+09:00'),
    source: 'Zenn',
  });

  // 全件新規
  {
    const items = [makeItem('https://zenn.dev/a/articles/x'), makeItem('https://zenn.dev/b/articles/y')];
    const { rows, newItems } = buildSheetRows(items, new Set(), now);
    assert(rows.length === 2 && newItems.length === 2, 'buildSheetRows: 全件新規はrows/newItemsとも2件');
    assert(rows.every(r => r.length === 6), 'buildSheetRows: 各rowは6列');
    assert(rows.every(r => r[4] === ''), 'buildSheetRows: 5列目（要約列）は空文字');
  }

  // 既存URL除外
  {
    const items = [makeItem('https://zenn.dev/a/articles/x'), makeItem('https://zenn.dev/b/articles/y')];
    const existing = new Set(['https://zenn.dev/a/articles/x']);
    const { rows, newItems } = buildSheetRows(items, existing, now);
    assert(rows.length === 1 && newItems.length === 1, 'buildSheetRows: 既存URLは除外され1件のみ');
    assert(newItems[0].url === 'https://zenn.dev/b/articles/y', 'buildSheetRows: 残るのは新規URLのアイテム');
  }

  // バッチ内重複
  {
    const items = [makeItem('https://zenn.dev/a/articles/x'), makeItem('https://zenn.dev/a/articles/x')];
    const { rows, newItems } = buildSheetRows(items, new Set(), now);
    assert(rows.length === 1 && newItems.length === 1, 'buildSheetRows: バッチ内の同一URLは1件のみ');
  }

  // escapeSheetFormula 適用
  {
    const items = [makeItem('https://zenn.dev/a/articles/x', '=SUM(A1)')];
    const { rows } = buildSheetRows(items, new Set(), now);
    assert(rows[0][2] === "'=SUM(A1)", 'buildSheetRows: titleにescapeSheetFormulaが適用される');
  }

  // newItems は入力 item と同一オブジェクト
  {
    const item = makeItem('https://zenn.dev/a/articles/x');
    const { newItems } = buildSheetRows([item], new Set(), now);
    assert(newItems[0] === item, 'buildSheetRows: newItemsの要素は入力itemと同一オブジェクト');
  }
}

/**
 * escapeHtml のテスト
 */
function testEscapeHtml() {
  const result = escapeHtml('<b>&"\'');
  assert(result === '&lt;b&gt;&amp;&quot;&#39;', 'escapeHtml: 5文字がすべてエンティティ化される');
}

/**
 * buildEmailHtml の統合テスト（warnings あり）
 */
function testBuildEmailHtmlWarnings() {
  const warnings = ['テスト警告<script>alert(1)</script>'];

  const html = buildEmailHtml([], '2026年07月19日', warnings);
  assert(html.includes('運用警告'), 'buildEmailHtml: warningsがあれば運用警告セクションが表示される');
  assert(html.includes('テスト警告&lt;script&gt;alert(1)&lt;/script&gt;'), 'buildEmailHtml: 警告文はエスケープされて挿入される');
  assert(!html.includes('<script>alert(1)</script>'), 'buildEmailHtml: 生の<script>タグは含まれない');
}

/**
 * buildEmailHtml の統合テスト（アイテム0件・warnings省略）
 */
function testBuildEmailHtmlEmpty() {
  const html = buildEmailHtml([], '2026年07月19日');
  assert(html.includes('本日は新着情報がありませんでした'), 'buildEmailHtml: 空配列時は新着なしメッセージを含む');
  assert(!html.includes('運用警告'), 'buildEmailHtml: warnings省略時は運用警告セクションが表示されない');
}

/**
 * buildEmailHtml のソース表示順序テスト（入力順によらず固定順で表示される）
 */
function testBuildEmailHtmlSourceOrder() {
  const makeItem = (source, url) => ({ title: 'タイトル', url, date: new Date('2026-07-19T08:00:00+09:00'), source });
  // わざと SOURCES の並びと逆順で渡す
  const items = [
    makeItem('Qiita', 'https://qiita.com/a/items/1'),
    makeItem('Zenn', 'https://zenn.dev/a/articles/x'),
    makeItem('GitHub Releases', 'https://github.com/anthropics/claude-code/releases/tag/v1'),
    makeItem('Anthropic Engineering', 'https://anthropic.com/engineering/1'),
    makeItem('Anthropic News', 'https://anthropic.com/news/1'),
  ];
  const html = buildEmailHtml(items, '2026年07月19日');

  const idx = (name) => html.indexOf(`${name}（1件）`);
  assert(idx('Anthropic News') < idx('Anthropic Engineering'), 'buildEmailHtml: Anthropic NewsがEngineeringより先');
  assert(idx('Anthropic Engineering') < idx('GitHub Releases'), 'buildEmailHtml: EngineeringがGitHub Releasesより先');
  assert(idx('GitHub Releases') < idx('Zenn'), 'buildEmailHtml: GitHub ReleasesがZennより先');
  assert(idx('Zenn') < idx('Qiita'), 'buildEmailHtml: ZennがQiitaより先');
}

/**
 * isTrustedPattern のテスト（URL/パス信頼性検証の共通ヘルパー）
 */
function testIsTrustedPattern() {
  assert(isTrustedPattern('https://a.com/x', /^https:\/\/a\.com\//) === true,
    'isTrustedPattern: パターン一致でtrue');
  assert(isTrustedPattern('https://evil.com/x', /^https:\/\/a\.com\//) === false,
    'isTrustedPattern: パターン不一致でfalse');
  assert(isTrustedPattern('  https://a.com/x  ', /^https:\/\/a\.com\//) === true,
    'isTrustedPattern: 前後の空白はtrimされる');
  assert(isTrustedPattern(undefined, /^https:\/\/a\.com\//) === false,
    'isTrustedPattern: undefinedはfalse');
}

/**
 * getCutoffDate のテスト（daysBack引数による可変性）
 */
function testGetCutoffDate() {
  const cutoffDefault = getCutoffDate(CONFIG.DAYS_BACK);
  const cutoff7 = getCutoffDate(7);
  assert(cutoff7.getTime() < cutoffDefault.getTime(),
    'getCutoffDate: daysBackが大きいほど過去の日付を返す');
  assert(cutoffDefault.getHours() === 0 && cutoffDefault.getMinutes() === 0,
    'getCutoffDate: 00:00に正規化される');
}

// ============================================================
// I/O系テスト
// UrlFetchApp / SpreadsheetApp / GmailApp / XmlService のスタブ
// （test/run_local.js が提供）が必要なため、node test/run_local.js 経由でのみ実行可能
// ============================================================

/**
 * Anthropic RSS の <item> 断片を組み立てるテスト用ヘルパー
 */
function __anthropicItemXml(title, link, pubDate, description) {
  return `<item>
<title>${title}</title>
<link>${link}</link>
<pubDate>${pubDate}</pubDate>
<description>${description}</description>
</item>`;
}

/**
 * Anthropic RSS フィード全体を組み立てるテスト用ヘルパー
 */
function __buildAnthropicRss(lastBuildDate, itemXmlList) {
  return `<?xml version="1.0"?>
<rss version="2.0"><channel>
<lastBuildDate>${lastBuildDate}</lastBuildDate>
${itemXmlList.join('\n')}
</channel></rss>`;
}

/**
 * fetchAnthropicRss のテスト（UrlFetchApp/XmlServiceスタブ経由）
 */
function testFetchAnthropicRss() {
  const url = 'https://example.com/anthropic-rss-test';
  const now = new Date();
  const recentPubDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const recentBuildDate = now.toISOString();
  const staleBuildDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();

  // 正常系: cutoff内・claudeキーワード一致・anthropic.comリンクの記事が返る
  {
    const xml = __buildAnthropicRss(recentBuildDate, [
      __anthropicItemXml('Claude Code new feature', 'https://www.anthropic.com/news/example', recentPubDate, 'about claude code'),
    ]);
    __fetchResponses.set(url, { responseCode: 200, contentText: xml });
    const { items, warnings } = fetchAnthropicRss(url, 'TestSource', 3);
    assert(items.length === 1, 'fetchAnthropicRss: 正常系は1件返る');
    assert(items[0].url === 'https://www.anthropic.com/news/example', 'fetchAnthropicRss: urlが取得できる');
    assert(items[0].source === 'TestSource', 'fetchAnthropicRss: sourceが指定値になる');
    assert(warnings.length === 0, 'fetchAnthropicRss: 鮮度が新しければwarningsは空');
    __fetchResponses.delete(url);
  }

  // フィード鮮古: lastBuildDateが古いとwarningsに警告が入る
  {
    const xml = __buildAnthropicRss(staleBuildDate, [
      __anthropicItemXml('Claude Code new feature', 'https://www.anthropic.com/news/example', recentPubDate, 'about claude code'),
    ]);
    __fetchResponses.set(url, { responseCode: 200, contentText: xml });
    const { warnings } = fetchAnthropicRss(url, 'TestSource', 3);
    assert(warnings.length === 1, 'fetchAnthropicRss: 鮮度が古いとwarningsが1件入る');
    __fetchResponses.delete(url);
  }

  // 非200レスポンス: 空items・空warningsを返す
  {
    __fetchResponses.set(url, { responseCode: 500, contentText: '' });
    const { items, warnings } = fetchAnthropicRss(url, 'TestSource', 3);
    assert(items.length === 0 && warnings.length === 0, 'fetchAnthropicRss: 非200時は空items・空warnings');
    __fetchResponses.delete(url);
  }
}

/**
 * fetchGitHubReleases のテスト（UrlFetchAppスタブ経由）
 */
function testFetchGitHubReleases() {
  const apiUrl = `${CONFIG.GITHUB_RELEASES_API_URL}?per_page=${CONFIG.GITHUB_RELEASES_PER_PAGE}`;
  const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

  // 正常系: 信頼できないURLのリリースは除外される
  {
    const releases = [
      { tag_name: 'v1.0.0', name: 'v1.0.0', published_at: recent, html_url: 'https://github.com/anthropics/claude-code/releases/tag/v1.0.0' },
      { tag_name: 'v1.0.1', name: 'v1.0.1', published_at: recent, html_url: 'https://evil.com/anthropics/claude-code/releases/tag/v1.0.1' },
    ];
    __fetchResponses.set(apiUrl, { responseCode: 200, contentText: JSON.stringify(releases) });
    const items = fetchGitHubReleases(3);
    assert(items.length === 1, 'fetchGitHubReleases: 信頼できないURLは除外され1件のみ');
    assert(items[0].url === 'https://github.com/anthropics/claude-code/releases/tag/v1.0.0',
      'fetchGitHubReleases: 信頼できるURLのみ残る');
    __fetchResponses.delete(apiUrl);
  }

  // 非200レスポンス: 空配列を返す
  {
    __fetchResponses.set(apiUrl, { responseCode: 500, contentText: '' });
    const items = fetchGitHubReleases(3);
    assert(items.length === 0, 'fetchGitHubReleases: 非200時は空配列');
    __fetchResponses.delete(apiUrl);
  }
}

/**
 * fetchZenn のテスト（UrlFetchAppスタブ経由）
 */
function testFetchZenn() {
  const apiUrl = `${CONFIG.ZENN_API_URL}?topicname=${CONFIG.ZENN_TOPIC}&order=latest&count=${CONFIG.MAX_ITEMS_PER_SOURCE}`;
  const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const data = {
    articles: [
      { title: '有効な記事', published_at: recent, path: '/someuser/articles/abc123' },
      { title: '無効な記事', published_at: recent, path: '/../etc/passwd' },
    ],
  };
  __fetchResponses.set(apiUrl, { responseCode: 200, contentText: JSON.stringify(data) });
  const items = fetchZenn(3);
  assert(items.length === 1, 'fetchZenn: 無効なpathは除外され1件のみ');
  assert(items[0].url === 'https://zenn.dev/someuser/articles/abc123',
    'fetchZenn: 有効なpathからURLが組み立てられる');
  __fetchResponses.delete(apiUrl);
}

/**
 * fetchQiita のテスト（UrlFetchAppスタブ経由）
 */
function testFetchQiita() {
  const apiUrl = `${CONFIG.QIITA_API_URL}?query=tag:${CONFIG.QIITA_TAG}&per_page=${CONFIG.MAX_ITEMS_PER_SOURCE}`;
  const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const articles = [
    { title: '有効な記事', created_at: recent, url: 'https://qiita.com/someuser/items/abc123' },
    { title: '無効な記事', created_at: recent, url: 'https://evil.com/qiita.com/items/abc123' },
  ];
  __fetchResponses.set(apiUrl, { responseCode: 200, contentText: JSON.stringify(articles) });
  const items = fetchQiita(3);
  assert(items.length === 1, 'fetchQiita: 信頼できないURLは除外され1件のみ');
  assert(items[0].url === 'https://qiita.com/someuser/items/abc123',
    'fetchQiita: 信頼できるURLのみ残る');
  __fetchResponses.delete(apiUrl);
}

/**
 * saveToSheet のテスト（SpreadsheetAppスタブ経由）
 */
function testSaveToSheet() {
  __spreadsheets.clear();
  const fixedDate = new Date('2026-07-19T08:00:00+09:00');
  const makeItem = (url, title) => ({ title, url, date: fixedDate, source: 'Zenn' });

  // 新規シートへの新規保存
  {
    const items = [makeItem('https://zenn.dev/a/articles/x', 'A'), makeItem('https://zenn.dev/b/articles/y', 'B')];
    const newItems = saveToSheet(items);
    assert(newItems.length === 2, 'saveToSheet: 新規2件が返る');

    const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('ニュース履歴');
    const rows = sheet.__rows();
    assert(rows.length === 3, 'saveToSheet: ヘッダー1行＋データ2行の計3行が書き込まれる');
    assert(rows[0][0] === '日付', 'saveToSheet: 1行目はヘッダー');
    assert(rows[1][3] === 'https://zenn.dev/a/articles/x', 'saveToSheet: 2行目に1件目のURLが書き込まれる');
  }

  // 重複URLの除外
  {
    const items = [makeItem('https://zenn.dev/a/articles/x', 'A（重複）'), makeItem('https://zenn.dev/c/articles/z', 'C')];
    const newItems = saveToSheet(items);
    assert(newItems.length === 1 && newItems[0].url === 'https://zenn.dev/c/articles/z',
      'saveToSheet: 既存URLは除外され新規1件のみ返る');

    const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('ニュース履歴');
    assert(sheet.__rows().length === 4, 'saveToSheet: 重複除外後は計4行（ヘッダー+3件）');
  }

  __spreadsheets.clear();
}

/**
 * sendEmail のテスト（GmailAppスタブ経由）
 */
function testSendEmail() {
  __gmailCalls.length = 0;
  const items = [
    { title: 'テスト記事', url: 'https://zenn.dev/a/articles/x', date: new Date('2026-07-19T08:00:00+09:00'), source: 'Zenn' },
  ];
  sendEmail(items, []);

  assert(__gmailCalls.length === 1, 'sendEmail: GmailApp.sendEmailが1回呼ばれる');
  const call = __gmailCalls[0];
  assert(call.to === CONFIG.EMAIL_TO, 'sendEmail: 宛先がCONFIG.EMAIL_TOになる');
  assert(call.subject.includes('1件'), 'sendEmail: 件名に件数が含まれる');
  assert(call.options.htmlBody.includes('テスト記事'), 'sendEmail: htmlBodyに記事タイトルが含まれる');

  __gmailCalls.length = 0;
}

/**
 * 全テストを実行する
 */
function runAllTests() {
  TEST_COUNT = 0;

  testParseValidDate();
  testIsFeedStale();
  testEscapeSheetFormula();
  testEnforceHttpsScheme();
  testIsTrustedGithubReleaseUrl();
  testIsTrustedQiitaUrl();
  testParseDateOrSkip();
  testBuildSheetRows();
  testEscapeHtml();
  testBuildEmailHtmlWarnings();
  testBuildEmailHtmlEmpty();
  testBuildEmailHtmlSourceOrder();
  testIsTrustedPattern();
  testGetCutoffDate();
  testFetchAnthropicRss();
  testFetchGitHubReleases();
  testFetchZenn();
  testFetchQiita();
  testSaveToSheet();
  testSendEmail();

  Logger.log(`=== 全 ${TEST_COUNT} 件のテストが PASS しました ===`);
}
