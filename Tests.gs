// ============================================================
// ユニットテスト（フレームワーク不使用）
// GAS エディタで runAllTests を実行、または node test/run_local.js
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
 * sanitizeCell のテスト
 */
function testSanitizeCell() {
  assert(sanitizeCell('=SUM(A1)') === "'=SUM(A1)", 'sanitizeCell: =始まりはエスケープされる');
  assert(sanitizeCell('+x') === "'+x", 'sanitizeCell: +始まりはエスケープされる');
  assert(sanitizeCell('-x') === "'-x", 'sanitizeCell: -始まりはエスケープされる');
  assert(sanitizeCell('@x') === "'@x", 'sanitizeCell: @始まりはエスケープされる');
  assert(sanitizeCell('normal') === 'normal', 'sanitizeCell: 通常文字列はそのまま');
}

/**
 * sanitizeUrl のテスト
 */
function testSanitizeUrl() {
  assert(sanitizeUrl('https://a.com') === 'https://a.com', 'sanitizeUrl: httpsはそのまま');
  assert(sanitizeUrl('javascript:alert(1)') === '#', 'sanitizeUrl: javascript:は#に置換される');
  assert(sanitizeUrl('  https://a.com  ') === 'https://a.com', 'sanitizeUrl: 前後の空白はtrimされる');
  assert(sanitizeUrl('http://example.com') === '#', 'sanitizeUrl: http://は#に置換される（https限定）');
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

  // sanitizeCell 適用
  {
    const items = [makeItem('https://zenn.dev/a/articles/x', '=SUM(A1)')];
    const { rows } = buildSheetRows(items, new Set(), now);
    assert(rows[0][2] === "'=SUM(A1)", 'buildSheetRows: titleにsanitizeCellが適用される');
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
 * buildEmailHtml の統合テスト（RUNTIME_WARNINGS あり）
 */
function testBuildEmailHtmlWarnings() {
  RUNTIME_WARNINGS.length = 0;
  RUNTIME_WARNINGS.push('テスト警告<script>alert(1)</script>');

  const html = buildEmailHtml([], '2026年07月19日');
  assert(html.includes('運用警告'), 'buildEmailHtml: RUNTIME_WARNINGSがあれば運用警告セクションが表示される');
  assert(html.includes('テスト警告&lt;script&gt;alert(1)&lt;/script&gt;'), 'buildEmailHtml: 警告文はエスケープされて挿入される');
  assert(!html.includes('<script>alert(1)</script>'), 'buildEmailHtml: 生の<script>タグは含まれない');

  RUNTIME_WARNINGS.length = 0;
}

/**
 * buildEmailHtml の統合テスト（アイテム0件）
 */
function testBuildEmailHtmlEmpty() {
  RUNTIME_WARNINGS.length = 0;
  const html = buildEmailHtml([], '2026年07月19日');
  assert(html.includes('本日は新着情報がありませんでした'), 'buildEmailHtml: 空配列時は新着なしメッセージを含む');
}

/**
 * 全テストを実行する
 */
function runAllTests() {
  TEST_COUNT = 0;

  testParseValidDate();
  testIsFeedStale();
  testSanitizeCell();
  testSanitizeUrl();
  testBuildSheetRows();
  testEscapeHtml();
  testBuildEmailHtmlWarnings();
  testBuildEmailHtmlEmpty();

  Logger.log(`=== 全 ${TEST_COUNT} 件のテストが PASS しました ===`);
}
