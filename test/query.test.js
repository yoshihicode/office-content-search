const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuery, normalize, Matcher } = require('../out/core/query');

test('スペースで区切る（半角・全角）', () => {
    assert.deepEqual(parseQuery('見積 至急'), ['見積', '至急']);
    assert.deepEqual(parseQuery('見積　至急'), ['見積', '至急']);
    assert.deepEqual(parseQuery('  見積   至急  '), ['見積', '至急']);
});

test('引用符で囲んだ語句は1語になる', () => {
    assert.deepEqual(parseQuery('見積 "Bot Management"'), ['見積', 'Bot Management']);
    assert.deepEqual(parseQuery('“株式会社 FOO” 見積'), ['株式会社 FOO', '見積']);
});

test('閉じ引用符がなければ末尾まで1語', () => {
    assert.deepEqual(parseQuery('"Bot Management'), ['Bot Management']);
});

test('空の語句と重複は除く', () => {
    assert.deepEqual(parseQuery('a "" b A ａ'), ['a', 'b']);
    assert.deepEqual(parseQuery('   '), []);
});

test('normalize は大文字小文字・全角半角を吸収する', () => {
    assert.equal(normalize('ＡＢＣ'), 'abc');
    assert.equal(normalize('ｶﾀｶﾅ'), 'カタカナ');
});

test('Matcher.match は含まれるキーワードを返す', () => {
    const m = new Matcher(['見積', '至急', 'Bot Management'], 'any');
    assert.deepEqual(m.match('見積書を送付します'), ['見積']);
    assert.deepEqual(m.match('至急：ＢＯＴ management の見積'), ['見積', '至急', 'Bot Management']);
    assert.deepEqual(m.match('関係のない文章'), []);
});

test('Matcher.satisfiedBy は OR / AND を判定する', () => {
    const or = new Matcher(['見積', '至急'], 'any');
    const and = new Matcher(['見積', '至急'], 'all');
    assert.equal(or.satisfiedBy(new Set()), false);
    assert.equal(or.satisfiedBy(new Set(['見積'])), true);
    assert.equal(and.satisfiedBy(new Set(['見積'])), false);
    assert.equal(and.satisfiedBy(new Set(['見積', '至急'])), true);
});