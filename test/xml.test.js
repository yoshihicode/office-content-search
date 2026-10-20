const test = require('node:test');
const assert = require('node:assert/strict');
const { relsPathFor, resolvePath } = require('../out/core/xml');

test('relsPathFor は部品の .rels のパスを返す', () => {
    assert.equal(relsPathFor(''), '_rels/.rels');
    assert.equal(relsPathFor('xl/workbook.xml'), 'xl/_rels/workbook.xml.rels');
    assert.equal(relsPathFor('ppt/slides/slide1.xml'), 'ppt/slides/_rels/slide1.xml.rels');
});

test('resolvePath は相対パスを ZIP 内の完全なパスにする', () => {
    assert.equal(resolvePath('xl/workbook.xml', 'worksheets/sheet1.xml'), 'xl/worksheets/sheet1.xml');
    assert.equal(resolvePath('xl/drawings/drawing1.xml', '../charts/chart1.xml'), 'xl/charts/chart1.xml');
    assert.equal(resolvePath('xl/workbook.xml', '/xl/worksheets/sheet2.xml'), 'xl/worksheets/sheet2.xml');
    assert.equal(resolvePath('', 'word/document.xml'), 'word/document.xml');
});