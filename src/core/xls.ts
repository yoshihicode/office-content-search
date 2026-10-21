import { CellObject, read } from 'xlsx';
import { TextUnit } from './types';


/**
 * 旧形式の Excel ファイル（.xls）からセルの値を読む
 */
export function extractXlsUnits(data: Buffer, dateFormat = 'yyyy/m/d'): TextUnit[] {
    const workbook = read(data, {
        type: 'buffer',
        dateNF: dateFormat,
        // 検索に不要な情報は読まない
        cellFormula: false,
        cellHTML: false,
        cellStyles: false,
        bookVBA: false,
    });

    const units: TextUnit[] = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        for (const [address, value] of Object.entries(sheet)) {
            if (address.startsWith('!')) continue; // "!ref" などはセルではなく、シートの情報
            const cell = value as CellObject;
            // w: Excel で表示される文字（日付なら "2026/10/15"）。なければ値そのもの
            const text = cell.w ?? (cell.v === undefined ? '' : String(cell.v));
            if (text !== '') units.push({ location: `${sheetName} › ${address}`, text });
        }
    }
    return units;
}