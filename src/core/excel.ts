import { extractGraphics, extractShapes } from './drawingml';
import type { DateFormatter } from './dateFormat';
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

export interface ExcelOptions {
  /** 日付のセルを表示どおりの文字にする関数。省略すると、日付もシリアル値のまま照合する */
  formatDate?: DateFormatter;
}

/**
 * xl/styles.xml から、セルの書式の番号（セルの s 属性）→ 表示形式 の対応表を作る
 * 表示形式は、組み込みなら番号、ユーザー定義なら書式の文字列（例: yyyy"年"m"月"d"日"）
 */
function readCellFormats(xml: string): (number | string)[] {
  const custom = new Map<number, string>(); // numFmtId → formatCode
  const formats: (number | string)[] = [];
  let inCellXfs = false;
  walkXml(xml, {
    open(name, a) {
      if (name === 'x:numFmt') custom.set(Number(a.numFmtId), a.formatCode ?? '');
      else if (name === 'x:cellXfs') inCellXfs = true;
      else if (name === 'x:xf' && inCellXfs) {
        const id = Number(a.numFmtId ?? 0);
        formats.push(custom.get(id) ?? id);
      }
    },
    close(name) {
      if (name === 'x:cellXfs') inCellXfs = false;
    },
  });
  return formats;
}

/** シートの XML からセルを読む */
interface DateContext {
  formats: (number | string)[];
  date1904: boolean;
  formatDate: DateFormatter;
}

function readCells(xml: string, sharedStrings: string[], sheet: string, dates?: DateContext): TextUnit[] {
  const units: TextUnit[] = [];
  let ref = '';
  let type = '';
  let style = 0; // セルの書式の番号（s 属性）
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
          style = Number(a.s ?? 0);
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
          else if (type === 'n' && dates && value !== '') {
            // 数値のセル：表示形式が日付なら、表示どおりの文字にする
            const format = dates.formats[style] ?? 0;
            text = dates.formatDate(Number(value), format, dates.date1904) ?? value;
          } else text = value;
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
export function extractExcelUnits(files: ZipFiles, labels: Labels, options: ExcelOptions = {}): TextUnit[] {
  const wbPath = mainPart(files);
  const wbXml = wbPath ? readText(files, wbPath) : undefined;
  if (wbPath === undefined || wbXml === undefined) throw new Error('workbook part not found');

  const sheets: { name: string; rid: string }[] = [];
  let date1904 = false; // 1904 年を起点とする日付の設定（主に古い Mac 版の Excel）
  walkXml(wbXml, {
    open(name, a) {
      if (name === 'x:sheet') sheets.push({ name: a.name, rid: a['r:id'] });
      else if (name === 'x:workbookPr') date1904 = a.date1904 === '1' || a.date1904 === 'true';
    },
  });

  const rels = readRels(files, wbPath);
  const sstPath = relsOfType(rels, '/sharedStrings')[0]?.target;
  const sstXml = sstPath ? readText(files, sstPath) : undefined;
  const sharedStrings = sstXml ? readSharedStrings(sstXml) : [];

  // 日付の表示に使う、セルの表示形式の一覧（formatDate がなければ読まない）
  let dates: DateContext | undefined;
  if (options.formatDate) {
    const stylesPath = relsOfType(rels, '/styles')[0]?.target;
    const stylesXml = stylesPath ? readText(files, stylesPath) : undefined;
    dates = { formats: stylesXml ? readCellFormats(stylesXml) : [], date1904, formatDate: options.formatDate };
  }

  const units: TextUnit[] = [];
  for (const sheet of sheets) {
    const rel = rels.get(sheet.rid);
    if (rel === undefined) continue;
    if (rel.type.endsWith('/worksheet')) {
      const xml = readText(files, rel.target);
      if (xml !== undefined) units.push(...readCells(xml, sharedStrings, sheet.name, dates));
      units.push(...readSheetDrawings(files, rel.target, sheet.name, labels));
    } else if (rel.type.endsWith('/chartsheet')) {
      units.push(...readSheetDrawings(files, rel.target, sheet.name, labels)); // グラフシートはセルを持たない
    }
  }
  return units;
}
