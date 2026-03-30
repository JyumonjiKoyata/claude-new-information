// ============================================================
// Claude API を使って記事を日本語要約する
// ============================================================

/**
 * 1件の記事を日本語で要約する
 * @param {Object} item - {title, url, source, body?}
 * @returns {string} 要約テキスト（日本語）
 */
function summarizeItem(item) {
  const prompt = `以下のClaude Codeに関する情報を、日本語で3〜5行に要約してください。
英語の場合は必ず日本語に翻訳して要約してください。
技術的な要点（新機能・バグ修正・重要な変更点）を中心にまとめてください。
箇条書きは使わず、自然な文章でまとめてください。

ソース: ${item.source}
タイトル: ${item.title}
URL: ${item.url}
${item.body ? `\n本文抜粋:\n${item.body}` : ''}
`;

  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-api-key': CONFIG.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // コスト最小化のため Haiku を使用
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      Logger.log('Claude API error: ' + res.getContentText());
      return '（要約取得に失敗しました）';
    }

    const data = JSON.parse(res.getContentText());
    return data.content[0].text.trim();
  } catch (e) {
    Logger.log('summarizeItem error: ' + e);
    return '（要約取得に失敗しました）';
  }
}

/**
 * 全アイテムを要約する（API呼び出し間に少し間隔を空ける）
 * @param {Array} items
 * @returns {Array} summary フィールドを追加したアイテム配列
 */
function summarizeAll(items) {
  return items.map((item, i) => {
    if (i > 0) Utilities.sleep(500); // レート制限対策
    const summary = summarizeItem(item);
    Logger.log(`[${i + 1}/${items.length}] 要約完了: ${item.title}`);
    return { ...item, summary };
  });
}
