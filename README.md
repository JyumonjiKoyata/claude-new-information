# Claude Code 日次ニュース収集アプリ

毎朝 8:00 に Claude Code の最新情報を自動収集し、日本語要約してメール＆Sheetsに保存します。

## 収集ソース

| ソース | 内容 |
|--------|------|
| Anthropic 公式ブログ | リリースノート・公式発表 |
| GitHub Releases | `anthropics/claude-code` のリリース |
| Zenn | `claudecode` タグの日本語記事 |
| Qiita | `claude-code` タグの日本語記事 |

---

## セットアップ手順

### 1. Google Sheets を作成

1. [Google Sheets](https://sheets.google.com) で新規スプレッドシートを作成
2. URLから **スプレッドシートID** をコピー  
   例: `https://docs.google.com/spreadsheets/d/★ここがID★/edit`

### 2. GAS プロジェクトを作成

1. [Google Apps Script](https://script.google.com) で新規プロジェクトを作成
2. 以下の5ファイルを作成してコードをコピー&ペースト：
   - `Config.gs`
   - `Fetcher.gs`
   - `Summarizer.gs`
   - `Sheet.gs`
   - `Mailer.gs`
   - `Main.gs`
3. `appsscript.json` の内容で既存のマニフェストを上書き  
   （「表示」→「マニフェストファイルを表示」）

### 3. スクリプトプロパティを設定

GAS エディタで「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加：

| プロパティ名 | 値 |
|-------------|-----|
| `CLAUDE_API_KEY` | Anthropic の API キー（必須） |
| `SHEET_ID` | 手順1でコピーしたスプレッドシートID（必須） |
| `GITHUB_TOKEN` | GitHub の Personal Access Token（任意・推奨） |

> **CLAUDE_API_KEY の取得**: [console.anthropic.com](https://console.anthropic.com) → API Keys

> **GITHUB_TOKEN の取得**: GitHub → Settings → Developer settings → Personal access tokens  
> スコープは `public_repo` のみで OK

### 4. セットアップ関数を実行

GAS エディタで `setup` 関数を選択して「実行」

→ 権限の承認ダイアログが表示されるので「許可」

→ 毎朝 8:00 のトリガーが自動設定されます

### 5. 動作テスト

GAS エディタで `runTest` 関数を実行（過去7日分で動作確認）

---

## clasp を使ったローカル開発（オプション）

```bash
# clasp のインストール
npm install -g @google/clasp

# Google アカウントでログイン
clasp login

# .clasp.json の scriptId を実際のIDに書き換えてから
clasp push    # GASにアップロード
clasp pull    # GASからダウンロード
```

---

## ファイル構成

```
claude-new-information/
├── .clasp.json          # clasp 設定
├── README.md            # このファイル
└── src/
    ├── appsscript.json  # GAS マニフェスト
    ├── Config.gs        # 設定
    ├── Fetcher.gs       # データ収集
    ├── Summarizer.gs    # Claude API 要約
    ├── Sheet.gs         # Sheets 保存
    ├── Mailer.gs        # メール送信
    └── Main.gs          # エントリーポイント
```

---

## コスト目安

Claude Haiku を使用しているため非常に安価です。

| 条件 | 月額コスト目安 |
|------|--------------|
| 毎日5件 × 30日 = 150回 | 約 $0.02〜$0.05 |

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| メールが届かない | GAS のログを確認 / スクリプトプロパティを確認 |
| 「新着なし」メールが毎日来る | `DAYS_BACK` を増やして `runTest` で確認 |
| GitHub の取得が失敗する | `GITHUB_TOKEN` を設定するとレート制限が緩和 |
| Zenn/Qiita で件数が少ない | タグ名の揺れがある場合あり（`claudecode` / `claude-code`） |
