import { SSF } from 'xlsx';

/**
 * 日本語版の Excel の組み込みの表示形式（番号 27〜36、50〜58）
 * SheetJS の表には入っていないため補う。和暦の形式は、西暦の形式に置き換えている
 */
const JA_BUILTIN_FORMATS: Record<number, string> = {
  27: 'yyyy/m/d', 36: 'yyyy/m/d', 50: 'yyyy/m/d', 57: 'yyyy/m/d',
  28: 'yyyy"年"m"月"d"日"', 29: 'yyyy"年"m"月"d"日"', 51: 'yyyy"年"m"月"d"日"',
  54: 'yyyy"年"m"月"d"日"', 58: 'yyyy"年"m"月"d"日"', 31: 'yyyy"年"m"月"d"日"',
  30: 'm/d/yy',
  32: 'h"時"mm"分"',
  33: 'h"時"mm"分"ss"秒"',
  34: 'yyyy"年"m"月"', 52: 'yyyy"年"m"月"', 55: 'yyyy"年"m"月"',
  35: 'm"月"d"日"', 53: 'm"月"d"日"', 56: 'm"月"d"日"',
};

/** 和暦の指定（g や e、[$-411]）を含む表示形式か。"…" で囲まれた文字は見ない */
export function hasJapaneseEra(format: string): boolean {
  const unquoted = format.replace(/"[^"]*"/g, '');
  return /\[\$-[0-9a-f]*411\]/i.test(unquoted) || /g/i.test(unquoted.replace(/general/gi, ''));
}

/** 和暦の指定（[$-411] や ggge）を、西暦の指定に置き換える。"…" で囲まれた文字はそのまま残す */
function replaceJapaneseEra(format: string): string {
  return format
    .replace(/\[\$-[0-9a-f]*\]/gi, '') // [$-411] などのロケール指定を取り除く
    .split(/("[^"]*")/) // "年" のような、そのまま表示する文字と、それ以外に分ける
    .map((part) => (part.startsWith('"') ? part : part.replace(/g+/gi, '').replace(/e+/gi, 'yyyy')))
    .join('');
}

/** 日付を表示する関数。日付の表示形式でなければ undefined を返す */
export type DateFormatter = (serial: number, format: string | number, date1904: boolean) => string | undefined;

/**
 * 日付の表示形式に従って、シリアル値を表示どおりの文字にする関数を作る
 * @param shortDateFormat 「短い日付形式」（番号 14）の書式。OS の地域設定で表示が変わるため、外から指定する
 */
export function createDateFormatter(shortDateFormat = 'yyyy/m/d'): DateFormatter {
  const table = SSF.get_table();
  return (serial, format, date1904) => {
    let code: string | undefined;
    if (typeof format === 'number') {
      if (format === 14) code = shortDateFormat;
      else if (format === 22) code = `${shortDateFormat} h:mm`; // 日付と時刻（これも地域設定で変わる）
      else code = JA_BUILTIN_FORMATS[format] ?? table[format];
    } else {
      code = replaceJapaneseEra(format);
    }
    if (!code || !SSF.is_date(code)) return undefined;
    try {
      return SSF.format(code, serial, { date1904 });
    } catch {
      return undefined; // 表示形式を解釈できなければ、日付として扱わない
    }
  };
}
