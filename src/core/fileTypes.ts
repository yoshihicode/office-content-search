import * as path from 'path';

/** 検索フォームで選べるアプリの種類 */
export type AppKind = 'excel' | 'word' | 'powerpoint';

/**
 * アプリごとの拡張子の一覧）
 * - extensions: 検索できる拡張子
 * - legacy:     旧形式。集めるが、検索はせずに「スキップ」に理由を表示する
 */
export const FILE_TYPES: Record<AppKind, { label: string; extensions: string[]; legacy: string[] }> = {
    excel: { label: 'Excel', extensions: ['.xlsx', '.xlsm', '.xls'], legacy: [] },
    word: { label: 'Word', extensions: ['.docx', '.docm'], legacy: ['.doc'] },
    powerpoint: { label: 'PowerPoint', extensions: ['.pptx', '.pptm'], legacy: ['.ppt'] },
};

export const APP_KINDS = Object.keys(FILE_TYPES) as AppKind[];

/** ファイル名から、どのアプリのファイルかを返す（対象外なら undefined） */
export function appOf(fileName: string): AppKind | undefined {
    const ext = path.extname(fileName).toLowerCase();
    return APP_KINDS.find((app) => FILE_TYPES[app].extensions.includes(ext) || FILE_TYPES[app].legacy.includes(ext));
}

/** 旧形式（.doc / .ppt）か */
export function isLegacy(fileName: string): boolean {
    const ext = path.extname(fileName).toLowerCase();
    return APP_KINDS.some((app) => FILE_TYPES[app].legacy.includes(ext));
}
