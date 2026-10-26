const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectFiles } = require('../out/core/walk');
const { appOf } = require('../out/core/fileTypes');
const { Matcher } = require('../out/core/query');
const { searchFile } = require('../out/core/search');

test('appOf: 拡張子からアプリの種類を判定する（大文字・マクロ有効形式・旧形式も）', () => {
  assert.equal(appOf('a.XLSM'), 'excel');
  assert.equal(appOf('a.xls'), 'excel');
  assert.equal(appOf('a.docm'), 'word');
  assert.equal(appOf('a.doc'), 'word');
  assert.equal(appOf('a.pptm'), 'powerpoint');
  assert.equal(appOf('a.txt'), undefined);
});

test('アプリ単位で絞り込める（旧形式もそのアプリに含める）', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'apps-'));
  for (const f of ['a.xlsx', 'b.xlsm', 'c.xls', 'd.docx', 'e.docm', 'f.doc', 'g.pptx', 'h.pptm', 'i.txt']) {
    fs.writeFileSync(path.join(root, f), '');
  }
  const names = async (apps) =>
    (await collectFiles(root, { recursive: false, excludeFolders: new Set(), apps })).files.map((f) => path.basename(f));
  assert.deepEqual(await names(['excel']), ['a.xlsx', 'b.xlsm', 'c.xls']);
  assert.deepEqual(await names(['word', 'powerpoint']), ['d.docx', 'e.docm', 'f.doc', 'g.pptx', 'h.pptm']);
  assert.equal((await names(undefined)).length, 8, '指定なしならすべて（.txt 以外）');
  assert.deepEqual(await names(['.*']), [], '不正な値には何も一致しない');
});

test('マクロ有効形式（.xlsm / .docm / .pptm）も検索できる', async () => {
  const opts = { maxFileSizeBytes: 50 * 1024 * 1024, maxHitsPerFile: 200 };
  for (const f of ['/macro.xlsm', '/macro.docm', '/macro.pptm']) {
    const r = await searchFile(path.join(__dirname, 'fixtures', f), new Matcher(['Sample'], 'any'), opts);
    assert.ok(r && r.hits.length > 0, f);
  }
});
