// ============================================================
// HTML メール送信
// ============================================================

/**
 * HTML特殊文字をエンティティにエスケープする
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * URLをサニタイズする（javascript: プロトコルを遮断）
 * @param {string} url
 * @returns {string}
 */
function sanitizeUrl(url) {
  const trimmed = String(url).trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : '#';
}

/**
 * ソース名に対応するバッジ色を返す
 */
function getSourceColor(source) {
  const colors = {
    'Anthropic Blog': '#d97706',
    'GitHub Releases': '#1d4ed8',
    'Zenn':  '#3b82f6',
    'Qiita': '#55c500',
  };
  return colors[source] || '#6b7280';
}

/**
 * アイテム1件のHTMLカードを生成
 */
function buildItemCard(item) {
  const color = getSourceColor(item.source);
  const dateStr = Utilities.formatDate(item.date, 'Asia/Tokyo', 'MM/dd');
  const safeSource = escapeHtml(item.source);
  const safeTitle  = escapeHtml(item.title);
  const safeUrl    = escapeHtml(sanitizeUrl(item.url));
  return `
    <div style="
      background:#ffffff;
      border:1px solid #e5e7eb;
      border-left:4px solid ${color};
      border-radius:8px;
      padding:16px 20px;
      margin-bottom:16px;
      box-shadow:0 1px 3px rgba(0,0,0,0.06);
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span class="badge" style="
          background:${color};
          color:#fff;
          font-size:11px;
          font-weight:bold;
          padding:2px 8px;
          border-radius:12px;
        ">${safeSource}</span>
        <span class="item-date" style="color:#9ca3af;font-size:12px;">${dateStr}</span>
      </div>
      <a href="${safeUrl}" class="item-title" style="
        color:#111827;
        font-size:15px;
        font-weight:600;
        text-decoration:none;
        line-height:1.4;
      ">${safeTitle}</a>
      ${item.summary ? `<p class="item-summary" style="
        color:#374151;
        font-size:13px;
        line-height:1.6;
        margin:8px 0 0;
      ">${escapeHtml(item.summary)}</p>` : ''}
      <a href="${safeUrl}" class="read-more" style="
        display:inline-block;
        margin-top:10px;
        color:${color};
        font-size:12px;
        text-decoration:none;
      ">→ 元記事を読む</a>
    </div>
  `;
}

/**
 * HTMLメール本文を生成
 * @param {Array} items
 * @param {string} dateLabel
 * @returns {string}
 */
function buildEmailHtml(items, dateLabel) {
  const sheetUrl = escapeHtml(sanitizeUrl(`https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}`));

  // ソース別にグループ化
  const groups = {};
  for (const item of items) {
    if (!groups[item.source]) groups[item.source] = [];
    groups[item.source].push(item);
  }

  let sections = '';
  for (const [source, groupItems] of Object.entries(groups)) {
    const color = getSourceColor(source);
    const safeSource = escapeHtml(source);
    const cards = groupItems.map(buildItemCard).join('');
    sections += `
      <h2 class="section-header" style="
        color:${color};
        font-size:16px;
        font-weight:700;
        border-bottom:2px solid ${color};
        padding-bottom:6px;
        margin:28px 0 16px;
      ">${safeSource}（${groupItems.length}件）</h2>
      ${cards}
    `;
  }

  const noNewsHtml = `
    <div style="text-align:center;padding:40px;color:#9ca3af;">
      <p class="no-news" style="font-size:16px;">本日は新着情報がありませんでした。</p>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @media screen and (max-width: 600px) {
      .badge         { font-size: 17px !important; }
      .item-date     { font-size: 18px !important; }
      .item-title    { font-size: 23px !important; }
      .item-summary  { font-size: 20px !important; }
      .read-more     { font-size: 18px !important; }
      .section-header { font-size: 24px !important; }
      .header-label  { font-size: 17px !important; }
      .header-title  { font-size: 33px !important; }
      .header-date   { font-size: 20px !important; }
      .footer-link   { font-size: 18px !important; }
      .no-news       { font-size: 24px !important; }
    }
  </style>
</head>
<body style="
  margin:0;padding:0;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#f3f4f6;
">
  <div style="max-width:680px;margin:24px auto;background:#f3f4f6;">

    <!-- ヘッダー -->
    <div style="
      background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);
      border-radius:12px 12px 0 0;
      padding:28px 32px;
    ">
      <div class="header-label" style="font-size:11px;color:#94a3b8;letter-spacing:2px;margin-bottom:6px;">DAILY DIGEST</div>
      <h1 class="header-title" style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
        Claude Code ニュース
      </h1>
      <div class="header-date" style="color:#94a3b8;font-size:13px;margin-top:6px;">${dateLabel} ／ ${items.length}件の新着</div>
    </div>

    <!-- 本文 -->
    <div style="background:#f3f4f6;padding:24px 32px;">
      ${items.length > 0 ? sections : noNewsHtml}
    </div>

    <!-- フッター -->
    <div style="
      background:#e5e7eb;
      border-radius:0 0 12px 12px;
      padding:16px 32px;
      text-align:center;
    ">
      <a href="${sheetUrl}" class="footer-link" style="
        color:#4b5563;
        font-size:12px;
        text-decoration:none;
      ">📊 過去のニュース履歴を見る（Google Sheets）</a>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * メールを送信する
 * @param {Array} items - summary付きアイテム配列
 */
function sendEmail(items) {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy年MM月dd日');
  const subject = `${CONFIG.EMAIL_SUBJECT_PREFIX} ${today}（${items.length}件）`;
  const html = buildEmailHtml(items, today);

  GmailApp.sendEmail(CONFIG.EMAIL_TO, subject, '', { htmlBody: html });
  Logger.log(`メール送信完了: ${subject}`);
}
