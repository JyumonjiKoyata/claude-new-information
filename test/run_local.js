'use strict';

// ============================================================
// Node でのローカル実行ハーネス
// GAS の *.gs ファイルは Node 上でそのまま require できないため、
// 最小限の GAS グローバルをスタブし、vm でまとめて実行する。
// ============================================================

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- UrlFetchApp スタブ ----
// テスト側で __fetchResponses.set(url, {responseCode, contentText}) を登録してから呼ぶ。
// 未登録のURLは 404 を返す。
const __fetchResponses = new Map();
const UrlFetchApp = {
  fetch(url) {
    const stub = __fetchResponses.get(url) || { responseCode: 404, contentText: '' };
    return {
      getResponseCode: () => stub.responseCode,
      getContentText: () => stub.contentText,
    };
  },
};

// ---- SpreadsheetApp スタブ ----
// メモリ上の2次元配列でシートを再現する簡易モック。styleメソッドはno-op。
const __spreadsheets = new Map();
function __makeFakeSheet() {
  const data = [];
  return {
    appendRow(row) {
      data.push(row.slice());
    },
    getRange(row, col, numRows = 1, numCols = 1) {
      return {
        setValues(values) {
          for (let i = 0; i < values.length; i++) {
            const r = row - 1 + i;
            if (!data[r]) data[r] = [];
            for (let j = 0; j < values[i].length; j++) {
              data[r][col - 1 + j] = values[i][j];
            }
          }
        },
        getValues() {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const rowData = data[row - 1 + i] || [];
            const outRow = [];
            for (let j = 0; j < numCols; j++) {
              const v = rowData[col - 1 + j];
              outRow.push(v === undefined ? '' : v);
            }
            out.push(outRow);
          }
          return out;
        },
        setBackground() {},
        setFontColor() {},
        setFontWeight() {},
      };
    },
    getLastRow() {
      return data.length;
    },
    setFrozenRows() {},
    setColumnWidth() {},
    __rows() {
      return data.map((r) => r.slice());
    },
  };
}
const SpreadsheetApp = {
  openById(id) {
    if (!__spreadsheets.has(id)) __spreadsheets.set(id, new Map());
    const sheets = __spreadsheets.get(id);
    return {
      getSheetByName(name) {
        return sheets.get(name) || null;
      },
      insertSheet(name) {
        const sheet = __makeFakeSheet();
        sheets.set(name, sheet);
        return sheet;
      },
    };
  },
};

// ---- GmailApp スタブ ----
// 送信呼び出しを記録するだけ。テスト側で __gmailCalls を検証する。
const __gmailCalls = [];
const GmailApp = {
  sendEmail(to, subject, body, options) {
    __gmailCalls.push({ to, subject, body, options });
  },
};

// ---- XmlService スタブ ----
// 本プロジェクトが使う範囲（getRootElement/getChild/getChildren/getChildText、CDATA対応）のみの
// 正規表現ベースの簡易パーサー。汎用XMLパーサーではない。
function __makeXmlElement(fragment) {
  return {
    getChildText(tag) {
      const cdataMatch = fragment.match(
        new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`)
      );
      if (cdataMatch) return cdataMatch[1].trim();
      const m = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].trim() : null;
    },
    getChild(tag) {
      const m = fragment.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? __makeXmlElement(m[1]) : null;
    },
    getChildren(tag) {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
      const results = [];
      let m;
      while ((m = re.exec(fragment)) !== null) {
        results.push(__makeXmlElement(m[1]));
      }
      return results;
    },
  };
}
const XmlService = {
  parse(text) {
    return { getRootElement: () => __makeXmlElement(text) };
  },
};

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
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
  },
  UrlFetchApp,
  SpreadsheetApp,
  GmailApp,
  XmlService,
  __fetchResponses,
  __spreadsheets,
  __gmailCalls,
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
