'use strict';

// ============================================================
// Node でのローカル実行ハーネス
// GAS の *.gs ファイルは Node 上でそのまま require できないため、
// 最小限の GAS グローバルをスタブし、vm でまとめて実行する。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// GAS グローバルのスタブ（最小構成）
const sandbox = {
  console,
  Logger: { log: (...a) => console.log(...a) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => ({ SHEET_ID: 'dummy-sheet-id', EMAIL_TO: 'dummy@example.com' }[k] || null),
    }),
  },
  Utilities: {
    formatDate: (d) => d.toISOString().slice(0, 10),
  },
};
vm.createContext(sandbox);

// 読み込み順: Config.gs → Fetcher.gs → Sheet.gs → Mailer.gs → Main.gs → Tests.gs
const FILES = ['Config.gs', 'Fetcher.gs', 'Sheet.gs', 'Mailer.gs', 'Main.gs', 'Tests.gs'];
const ROOT_DIR = path.join(__dirname, '..');

const code = FILES
  .map((f) => fs.readFileSync(path.join(ROOT_DIR, f), 'utf8'))
  .join('\n;\n');

try {
  // 全ファイルを結合して1回で実行する（構文チェックも兼ねる）
  vm.runInContext(code + '\n;runAllTests();', sandbox, { filename: 'gas-bundle.js' });
  console.log('=== 全テスト PASS ===');
  process.exitCode = 0;
} catch (e) {
  console.error('=== テスト失敗 ===');
  console.error(e && e.stack ? e.stack : e);
  process.exitCode = 1;
}
