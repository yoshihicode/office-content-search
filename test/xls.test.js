const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { Matcher } = require('../out/core/query');
const { searchFile } = require('../out/core/search');

const F = (name) => path.join(__dirname, 'fixtures', name);
const opts = { maxFileSizeBytes: 50 * 1024 * 1024, maxHitsPerFile: 200 };
const locs = (r) => r.hits.map((h) => `${h.keywords.join(',')} @ ${h.location}`);

test('.xls: シート名とセル番地付きで、文字・日付を検索できる', async () => {
    const r = await searchFile(F('sample.xls'), new Matcher(['レガシー', '2026/10/15'], 'any'), opts);
    const l = locs(r);
    assert.ok(l.some((x) => x.startsWith('レガシー @ ')), l.join('\n'));
    assert.ok(l.some((x) => x.startsWith('2026/10/15 @ ')), '日付は表示どおりの文字で検索できる');
});

test('.xls: 中身が .xls でないファイルはスキップする', async () => {
    await assert.rejects(searchFile(F('fake.xls'), new Matcher(['excel'], 'any'), opts), (e) => e.reason === 'notOfficeFile');
});

test('.xls: 組み込みの「短い日付形式」の日付も、指定した書式で検索できる', async () => {
    const ja = await searchFile(F('sample.xls'), new Matcher(['2026/10/15', '2026/1/5'], 'all'), opts);
    assert.ok(ja, '既定（yyyy/m/d）: 2026/10/15 と 2026/1/5 で一致する');
    const en = await searchFile(F('sample.xls'), new Matcher(['10/15/2026'], 'any'), { ...opts, xlsDateFormat: 'm/d/yyyy' });
    assert.ok(en, '英語（m/d/yyyy）: 10/15/2026 で一致する');
});
