const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { Matcher } = require('../out/core/query');
const { searchFile } = require('../out/core/search');

const F = (name) => path.join(__dirname, 'fixtures', name);
const opts = { maxFileSizeBytes: 50 * 1024 * 1024, maxHitsPerFile: 200 };

/** ファイルの中の「位置 → 照合に使われた文字」を取り出す */
async function texts(file, extra = {}) {
  const r = await searchFile(F(file), new Matcher(['2026', '1234', '9:30'], 'any'), { ...opts, ...extra });
  return Object.fromEntries(r.hits.map((h) => [h.location, h.text]));
}

test('.xlsx: 日付は表示形式どおりの文字で照合する', async () => {
  const t = await texts('dates.xlsx');
  assert.equal(t['Sheet1 › A1'], '2026/10/15', '組み込みの「短い日付形式」');
  assert.equal(t['Sheet1 › A2'], '2026年10月15日', 'ユーザー定義の形式');
  assert.equal(t['Sheet1 › A3'], '2026/10/15 9:30', '日付と時刻');
  assert.equal(t['Sheet1 › A5'], '2026年10月15日', '和暦の形式は西暦で表示する');
  assert.equal(t['Sheet1 › A6'], '9:30', '時刻だけの形式');
});

test('.xlsx: 日付ではない数値は、値のまま照合する', async () => {
  const t = await texts('dates.xlsx');
  assert.equal(t['Sheet1 › A4'], '1234', '#,##0 でも 1,234 ではなく 1234');
});

test('.xlsx: 「短い日付形式」の書式を指定できる', async () => {
  const t = await texts('dates.xlsx', { xlsDateFormat: 'm/d/yyyy' });
  assert.equal(t['Sheet1 › A1'], '10/15/2026');
});

test('.xlsx: 1904 年を起点とするブックでも正しい日付になる', async () => {
  const t = await texts('dates-1904.xlsx');
  assert.equal(Object.values(t)[0], '2026/10/15');
});

test('.xls も .xlsx と同じ規則で照合する', async () => {
  const t = await texts('numbers.xls');
  assert.equal(t['Sheet1 › A1'], '2026/10/15');
  assert.equal(t['Sheet1 › A2'], '1234');
  assert.equal(t['Sheet1 › A3'], '2026年10月15日');
  assert.equal(t['Sheet1 › A4'], '2026年10月15日', '和暦は西暦で表示する');
});
