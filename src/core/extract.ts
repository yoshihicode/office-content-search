import { extractExcelUnits } from './excel';
import { extractPowerPointUnits } from './powerpoint';
import { defaultLabels, Labels, TextUnit, ZipFiles } from './types';
import { extractWordUnits } from './word';

export type { TextUnit } from './types';

/** ファイルの種類に応じて抽出方法を切り替える */
export function extractTextUnits(path: string, files: ZipFiles, labels: Labels = defaultLabels): TextUnit[] {
    const ext = path.toLowerCase().split('.').pop();
    if (ext === 'xlsx') return extractExcelUnits(files, labels);
    if (ext === 'docx') return extractWordUnits(files, labels);
    if (ext === 'pptx') return extractPowerPointUnits(files, labels);
    throw new Error(`unsupported file type: .${ext}`);
}
