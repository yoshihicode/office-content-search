const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { collectFiles } = require('../out/core/walk');

/** 一時フォルダにテスト用のファイル構成を作る */
function makeTree() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walk-'));
    for (const f of ['a.docx', 'b.XLSX', 'c.pptx', 'memo.txt', '~$a.docx', 'sub/d.docx', 'sub/deep/e.xlsx', '.git/f.docx']) {
        fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
        fs.writeFileSync(path.join(root, f), '');
    }
    return root;
}
const names = (root, r) => r.files.map((f) => path.relative(root, f).split(path.sep).join('/'));

test('サブフォルダを含めない', async () => {
    const root = makeTree();
    const r = await collectFiles(root, { recursive: false, excludeFolders: new Set() });
    assert.deepEqual(names(root, r), ['a.docx', 'b.XLSX', 'c.pptx']);
});

test('サブフォルダを含め、除外フォルダとロックファイルは飛ばす', async () => {
    const root = makeTree();
    const r = await collectFiles(root, { recursive: true, excludeFolders: new Set(['.git']) });
    assert.deepEqual(names(root, r), ['a.docx', 'b.XLSX', 'c.pptx', 'sub/d.docx', 'sub/deep/e.xlsx']);
});

test('キャンセルされたら途中で止まる', async () => {
    const root = makeTree();
    const r = await collectFiles(root, { recursive: true, excludeFolders: new Set(), isCancelled: () => true });
    assert.deepEqual(r.files, []);
});