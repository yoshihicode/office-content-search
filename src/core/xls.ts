import { CellObject, read, SSF } from 'xlsx';
import { createDateFormatter, hasJapaneseEra } from './dateFormat';
import { TextUnit } from './types';

/**
 * 旧形式の Excel ファイル（.xls）からセルの値を読む
 * ※ 図形やグラフの文字は読めない（SheetJS が扱うのはセルだけ）
 * @param dateFormat Excel の「短い日付形式」（組み込みの表示形式 14）を表示する書式。
 *   この形式は OS の地域設定で表示が変わるため、SheetJS の既定（米国式 m/d/yy）ではなく、指定した書式で表示する
 */
export function extractXlsUnits(data: Buffer, dateFormat = 'yyyy/m/d'): TextUnit[] {
  const workbook = read(data, {
    type: 'buffer',
    dateNF: dateFormat,
    cellNF: true, // セルの表示形式（z）も読む。日付かどうかの判定に使う
    // 検索に不要な情報は読まない（メモリと時間の節約）
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    bookVBA: false,
  });

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  let formatDate: ReturnType<typeof createDateFormatter> | undefined;

  /** .xlsx と同じ規則でセルを文字にする：日付は表示どおり、ほかの数値は値のまま */
  const toText = (cell: CellObject): string => {
    if (cell.t === 'n' && typeof cell.v === 'number') {
      const format = String(cell.z ?? 'General');
      if (!SSF.is_date(format)) return String(cell.v);
      if (hasJapaneseEra(format)) {
        // SheetJS は和暦を正しく表示できないので、.xlsx と同じ整形関数（西暦に置き換える）を使う
        formatDate ??= createDateFormatter(dateFormat);
        return formatDate(cell.v, format, date1904) ?? String(cell.v);
      }
      return cell.w ?? String(cell.v); // 「短い日付形式」は dateNF の書式で表示されている
    }
    return cell.w ?? (cell.v === undefined ? '' : String(cell.v));
  };

  const units: TextUnit[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    for (const [address, value] of Object.entries(sheet)) {
      if (address.startsWith('!')) continue; // "!ref" などはセルではなく、シートの情報
      const text = toText(value as CellObject);
      if (text !== '') units.push({ location: `${sheetName} › ${address}`, text });
    }
  }
  return units;
}
