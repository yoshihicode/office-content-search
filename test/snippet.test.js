const test = require('node:test');
const assert = require('node:assert/strict');
const { makeSnippet } = require('../out/core/snippet');

/** 強調範囲の文字を取り出す（テストを読みやすくするため） */
const marked = (s) => s.highlights.map(([a, b]) => s.text.slice(a, b));

test('短い文字列はそのまま、一致した部分を強調する', () => {
    const s = makeSnippet('見積書を送付します', ['見積']);
    assert.equal(s.text, '見積書を送付します');
    assert.deepEqual(marked(s), ['見積']);
});

test('改行や連続する空白は1つの空白にまとめる', () => {
    assert.equal(makeSnippet('見積\n\n  書', ['見積']).text, '見積 書');
});

test('キーワードが後ろにあるときは、手前から切り出して前後に … を付ける', () => {
    const s = makeSnippet('あ'.repeat(100) + '見積' + 'い'.repeat(100), ['見積']);
    assert.ok(s.text.startsWith('…') && s.text.endsWith('…'));
    assert.deepEqual(marked(s), ['見積']);
});

test('キーワードが末尾に近いときは、最後の部分を表示する', () => {
    const s = makeSnippet('あ'.repeat(100) + '見積', ['見積']);
    assert.ok(s.text.startsWith('…') && s.text.endsWith('見積'));
    assert.deepEqual(marked(s), ['見積']);
});

test('全角・大文字の違いがあっても、元の文字を強調する', () => {
    assert.deepEqual(marked(makeSnippet('ＢＯＴ Management 提案', ['bot management'])), ['ＢＯＴ Management']);
});

test('複数のキーワード・複数回の一致をすべて強調し、重なりはまとめる', () => {
    assert.deepEqual(marked(makeSnippet('見積と至急、再見積', ['見積', '至急'])), ['見積', '至急', '見積']);
    assert.deepEqual(marked(makeSnippet('見積書', ['見積', '見積書'])), ['見積書']);
});

test('正規化で文字数が変わる場合は強調しない（位置がずれるのを防ぐ）', () => {
    const s = makeSnippet('㈱ほげの見積', ['見積']);
    assert.equal(s.text, '㈱ほげの見積');
    assert.deepEqual(s.highlights, []);
});