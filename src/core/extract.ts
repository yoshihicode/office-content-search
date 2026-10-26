import { ExcelOptions, extractExcelUnits } from './excel';
import { appOf } from './fileTypes';
import { extractPowerPointUnits } from './powerpoint';
import { defaultLabels, Labels, TextUnit, ZipFiles } from './types';
import { extractWordUnits } from './word';

export type { TextUnit } from './types';

/** ファイルの種類に応じて抽出方法を切り替える（.xlsm・.docm・.pptm も中身の構造は同じ） */
export function extractTextUnits(
  path: string,
  files: ZipFiles,
  labels: Labels = defaultLabels,
  excel: ExcelOptions = {},
): TextUnit[] {
  const app = appOf(path);
  if (app === 'excel') return extractExcelUnits(files, labels, excel);
  if (app === 'word') return extractWordUnits(files, labels);
  if (app === 'powerpoint') return extractPowerPointUnits(files, labels);
  throw new Error(`unsupported file type: ${path}`);
}
