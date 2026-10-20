import { extractGraphics, extractShapes } from './drawingml';
import { Labels, TextUnit, ZipFiles } from './types';
import { mainPart, readRels, relsOfType, walkXml } from './xml';
import { readText } from './zip';

/** 共有文字列を「番号 → 文字列」の配列にする（ふりがなは walkXml が読み飛ばす） */
function readSharedStrings(xml: string): string[] {
    const strings: string[] = [];
    let current: string | null = null;
    let inText = false;
    walkXml(xml, {
        open(name) {
            if (name === 'x:si') current = '';
            else if (name === 'x:t') inText = true;
        },
        close(name) {
            if (name === 'x:si') {
                strings.push(current ?? '');
                current = null;
            } else if (name === 'x:t') inText = false;
        },
        text(t) {
            if (inText && current !== null) current += t;
        },
    });
    return strings;
}

/** シートの XML からセルを読む */
function readCells(xml: string, sharedStrings: string[], sheet: string): TextUnit[] {
    const units: TextUnit[] = [];
    let ref = '';
    let type = '';
    let value = '';
    let inline = '';
    let inValue = false;
    let inInlineText = false;

    walkXml(xml, {
        open(name, a) {
            switch (name) {
                case 'x:c':
                    ref = a.r ?? '';
                    type = a.t ?? 'n';
                    value = '';
                    inline = '';
                    break;
                case 'x:v':
                    inValue = true;
                    break;
                case 'x:t':
                    inInlineText = true;
                    break;
            }
        },
        close(name) {
            switch (name) {
                case 'x:v':
                    inValue = false;
                    break;
                case 'x:t':
                    inInlineText = false;
                    break;
                case 'x:c': {
                    let text: string;
                    if (type === 's') text = sharedStrings[Number(value)] ?? '';
                    else if (type === 'inlineStr') text = inline;
                    else if (type === 'b') text = value === '1' ? 'TRUE' : 'FALSE';
                    else text = value;
                    if (text !== '') units.push({ location: `${sheet} › ${ref}`, text });
                    break;
                }
            }
        },
        text(t) {
            if (inValue) value += t;
            else if (inInlineText) inline += t;
        },
    });
    return units;
}

/** シート（またはグラフシート）に置かれた図形・グラフ・SmartArt を読む */
function readSheetDrawings(files: ZipFiles, sheetPart: string, sheetName: string, labels: Labels): TextUnit[] {
    const units: TextUnit[] = [];
    for (const rel of relsOfType(readRels(files, sheetPart), '/drawing')) {
        const xml = readText(files, rel.target);
        if (xml === undefined) continue;
        const { units: shapeUnits, refs } = extractShapes(xml, sheetName);
        units.push(...shapeUnits, ...extractGraphics(files, rel.target, refs, sheetName, labels));
    }
    return units;
}

/** ブック全体のセルを読む */
export function extractExcelUnits(files: ZipFiles, labels: Labels): TextUnit[] {
    const wbPath = mainPart(files);
    const wbXml = wbPath ? readText(files, wbPath) : undefined;
    if (wbPath === undefined || wbXml === undefined) throw new Error('workbook part not found');

    const sheets: { name: string; rid: string }[] = [];
    walkXml(wbXml, {
        open(name, a) {
            if (name === 'x:sheet') sheets.push({ name: a.name, rid: a['r:id'] });
        },
    });

    const rels = readRels(files, wbPath);
    const sstPath = relsOfType(rels, '/sharedStrings')[0]?.target;
    const sstXml = sstPath ? readText(files, sstPath) : undefined;
    const sharedStrings = sstXml ? readSharedStrings(sstXml) : [];

    const units: TextUnit[] = [];
    for (const sheet of sheets) {
        const rel = rels.get(sheet.rid);
        if (rel === undefined) continue;
        if (rel.type.endsWith('/worksheet')) {
            const xml = readText(files, rel.target);
            if (xml !== undefined) units.push(...readCells(xml, sharedStrings, sheet.name));
            units.push(...readSheetDrawings(files, rel.target, sheet.name, labels));
        } else if (rel.type.endsWith('/chartsheet')) {
            units.push(...readSheetDrawings(files, rel.target, sheet.name, labels)); // グラフシートはセルを持たない
        }
    }
    return units;
}
