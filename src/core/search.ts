import { promises as fs } from 'fs';
import { extractTextUnits } from './extract';
import { Matcher } from './query';
import type { DateFormatter } from './dateFormat';
import { defaultLabels, FileResult, Hit, Labels } from './types';
import { isCompoundFile, OfficeFileError, openOfficeFile } from './zip';

const LEGACY_FILE = /\.(doc|ppt)$/i; // .xls は SheetJS で読める
const XLS_FILE = /\.xls$/i;
const XLSX_FILE = /\.xlsx$/i;

export interface SearchOptions {
  /** これより大きいファイルは読まずにスキップする */
  maxFileSizeBytes: number;
  /** 1ファイルあたりのヒット数の上限 */
  maxHitsPerFile: number;
  /** Excel の「短い日付形式」の表示に使う書式（.xls と .xlsx の両方）。省略時は yyyy/m/d */
  xlsDateFormat?: string;
  /** 位置の表示名（翻訳済み）。省略時は英語 */
  labels?: Labels;
}

/**
 * 1つのファイルを検索する
 * @returns 条件を満たせば結果、満たさなければ undefined。開けないファイルは例外を投げる
 */
export async function searchFile(
  filePath: string,
  matcher: Matcher,
  options: SearchOptions,
): Promise<FileResult | undefined> {
  if (LEGACY_FILE.test(filePath)) {
    throw new OfficeFileError('legacy', 'legacy binary format (.doc/.ppt) is not supported');
  }
  // 読み込む前にサイズを確かめる（巨大なファイルで拡張機能ホストが固まるのを防ぐ）
  const { size } = await fs.stat(filePath);
  if (size > options.maxFileSizeBytes) {
    throw new OfficeFileError('tooLarge', 'file is larger than the size limit');
  }

  const units = XLS_FILE.test(filePath)
    ? await readXls(filePath, options.xlsDateFormat)
    : extractTextUnits(filePath, await openOfficeFile(filePath), options.labels ?? defaultLabels, {
        formatDate: XLSX_FILE.test(filePath) ? await getDateFormatter(options.xlsDateFormat) : undefined,
      });
  const found = new Set<string>();
  const hits: Hit[] = [];
  let truncated = false;
  for (const unit of units) {
    const matched = matcher.match(unit.text);
    if (matched.length === 0) continue;
    matched.forEach((k) => found.add(k));

    if (hits.length < options.maxHitsPerFile) {
      hits.push({ keywords: matched, location: unit.location, text: unit.text });
    } else {
      truncated = true;
      // 上限に達し、かつ条件も満たしていれば、これ以上照合する必要はない
      if (matcher.satisfiedBy(found)) break;
    }
  }
  return matcher.satisfiedBy(found) ? { path: filePath, hits, truncated } : undefined;
}

/** .xls を読む。SheetJS は .xls 以外の中身でもエラーにせず読もうとするので、先に形式を確かめる */
async function readXls(filePath: string, dateFormat?: string) {
  const data = await fs.readFile(filePath);
  if (!isCompoundFile(data)) {
    throw new OfficeFileError('notOfficeFile', 'not an Excel 97-2003 (.xls) file');
  }
  // 必要になったときに初めて SheetJS を読み込む（拡張機能の起動を遅くしないため）
  const { extractXlsUnits } = await import('./xls');
  try {
    return extractXlsUnits(data, dateFormat);
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    if (/password|encrypt/i.test(message)) throw new OfficeFileError('encrypted', message);
    throw new OfficeFileError('notOfficeFile', message);
  }
}

/** 日付を表示する関数を、書式ごとに1回だけ作って使い回す（SheetJS も、必要になったときに初めて読み込む） */
const formatters = new Map<string, DateFormatter>();
async function getDateFormatter(shortDateFormat = 'yyyy/m/d'): Promise<DateFormatter> {
  let formatter = formatters.get(shortDateFormat);
  if (!formatter) {
    const { createDateFormatter } = await import('./dateFormat');
    formatter = createDateFormatter(shortDateFormat);
    formatters.set(shortDateFormat, formatter);
  }
  return formatter;
}
