# セキュリティ監査レポート (Security Audit Report)

## プロジェクト情報
- **対象**: `claude-new-information` (Google Apps Script)
- **監査日時**: 2026-04-07

## 1. 依存関係の脆弱性チェック (package.json)
- **結果**: 該当なし。
- **詳細**: 本プロジェクトは標準仕様のGoogle Apps Script (GAS) 環境で構築されており、NPM管理のサードパーティ製ライブラリ（`package.json`）を使用していないため、既知の脆弱性ライブラリへの依存リスクはありません。

## 2. 不安全なコードパターン (eval, innerHTML, SQLインジェクション等)
- **結果**: **Low (XSSの可能性)**
- **詳細**: `eval()` や `innerHTML`、SQLの実行など、直ちにクリティカルな影響を及ぼす関数の使用は見られませんでした。データベースにはGoogle Sheetsが用いられているため、SQLインジェクションのリスクもありません。
  - **リスク (Low)**: `Mailer.gs` にて、外部から取得したデータ(`item.title`, `item.url`, `item.source`)をエスケープ処理せずにHTMLメールのテンプレート文字列に直接展開しています。
    - データ取得元（Anthropic, GitHub, Zenn, Qiita）の信頼性は高いですが、万が一悪意のあるタイトルが投稿された場合、HTMLタグがそのまま埋め込まれるクロスサイトスクリプティング（XSS）等の構造破壊リスクが存在します。
  - **推奨**: 取得した文字列を出力する前に、`<` や `>` などをHTMLエンティティに変換する簡単なエスケープ処理を挟むことを推奨します。

## 3. シークレットキーのハードコード
- **結果**: **Pass（問題なし）**
- **詳細**: APIキーやトークンなどの機密情報はコード内に直接記述（ハードコード）されていません。
  - `Config.gs` にて、`CLAUDE_API_KEY` や `GITHUB_TOKEN`、`SHEET_ID` などの値は全て適切に `PropertiesService.getScriptProperties().getProperty()` 経由で取得されるように設計されており、セキュアな実装となっています。

## 監査サマリー
- **High**: なし
- **Medium**: なし
- **Low**: 1件 (HTMLメールテンプレートの未エスケープ値による表示崩れ・XSSリスク)

全体として非常にセキュアで、GASのベストプラクティス（プロパティサービスによるシークレット隠蔽など）に沿った設計となっています。
一点、HTML生成時のエスケープ処理を追加することでさらに堅牢性が向上します。

---

## 更新履歴（2026-07-09 再監査）

上記監査以降に検出・修正した項目：

| 項目 | 深刻度 | 状態 |
|------|--------|------|
| HTMLメールの未エスケープ（上記 Low 指摘） | Low | ✅ 修正済み（`escapeHtml()` / `sanitizeUrl()` 導入） |
| Claude API プロンプトインジェクション | Medium | ✅ 要約機能自体を廃止し解消。`CLAUDE_API_KEY` はスクリプトプロパティ・Anthropic コンソール双方から削除済み |
| 非公式 Anthropic RSS フィード改ざんによる偽リンク配信 | Medium | ✅ 修正済み（リンク先を `anthropic.com` ドメインに限定） |
| Google Sheets 数式インジェクション（`=` で始まるタイトル） | Medium | ✅ 修正済み（`sanitizeCell()` で `'` を前置） |
| `setup()` の `EMAIL_TO` 必須チェック漏れ | Low | ✅ 修正済み |
| メールへの記事重複掲載（取得ウィンドウの8時間重複） | Low（機能バグ） | ✅ 修正済み（新規保存分のみメール送信） |

現時点で未対応の既知リスク：
- Anthropic News / Engineering のソースは第三者維持の非公式フィード（Olshansk/rss-feeds、公式 RSS 廃止のため）。リンク先ドメイン検証で偽リンクは遮断済みだが、タイトル文言の改ざんは検出できない（残存リスク: Low）。

---

## 更新履歴（2026-09-08 コードレビュー・再監査）

新規の Critical/High 脆弱性は検出されず。以下、軽微な問題点を修正：

| 項目 | 深刻度 | 状態 |
|------|--------|------|
| GitHub Releases / Qiita のURLがドメイン無検証でメールに埋め込まれていた（Zenn/Anthropicとの非対称） | Low（多層防御） | ✅ 修正済み（`isTrustedGithubReleaseUrl()` / `isTrustedQiitaUrl()` 導入） |
| `runTest()` が `Object.defineProperty` を不必要に使用し非enumerable化する副作用があった | Low（コード品質） | ✅ 修正済み（直接代入 + `try/finally` に変更） |
| `fetchGitHubReleases()` の `body` フィールドが未使用のまま残存（要約機能廃止の残骸） | Low（デッドコード） | ✅ 修正済み（削除） |
| メール内のソース表示順序がオブジェクト挿入順に依存し不定だった | Low（機能バグ） | ✅ 修正済み（`SOURCES` 配列で表示順を固定） |
| Fetcher.gs の日付パース処理がGitHub/Zenn/Qiitaで重複（DRY違反） | 情報（保守性） | ✅ 修正済み（`parseDateOrSkip()` に共通化） |
| Sheets の「要約」列が廃止済み機能の名残のまま | 情報 | 対応不要と判断（既存シートとの列数整合性を優先）。README にトラブルシューティングとして説明を追記 |

依存パッケージ（npm）の脆弱性チェック：`package.json` は存在せず、GAS標準APIのみを使用しているため対象外（変更なし）。

検証：`node test/run_local.js` で新規追加分含め全48件のユニットテストがPASSすることを確認。
