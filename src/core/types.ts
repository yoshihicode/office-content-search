/** 検索の対象になる文字のまとまり（セル、段落など）と、その位置 */
export interface TextUnit {
    location: string;
    text: string;
}

/** fflate で展開した ZIP の中身（パス → バイト列） */
export type ZipFiles = Record<string, Uint8Array>;

/** 1件のヒット */
export interface Hit {
    keywords: string[]; // この位置で見つかったキーワード
    location: string;
    text: string;
}

/** 1ファイル分の検索結果 */
export interface FileResult {
    path: string;
    hits: Hit[];
    truncated?: boolean;
}

/**
 * 位置の表示名。コア（src/core）は VS Code に依存しないので、
 * 翻訳した表示名は拡張機能側から渡してもらう。既定値は英語
 */
export interface Labels {
    body: string;
    textBox: string;
    header: string;
    footer: string;
    firstPageHeader: string;
    firstPageFooter: string;
    evenPageHeader: string;
    evenPageFooter: string;
    section: (n: number) => string;
    footnote: string;
    endnote: string;
    comment: string;
    chart: string;
    smartArt: string;
    seriesName: string;
    slide: (n: number) => string;
    notes: string;
}

export const defaultLabels: Labels = {
    body: 'Body',
    textBox: 'Text Box',
    header: 'Header',
    footer: 'Footer',
    firstPageHeader: 'First Page Header',
    firstPageFooter: 'First Page Footer',
    evenPageHeader: 'Even Page Header',
    evenPageFooter: 'Even Page Footer',
    section: (n) => `Section ${n}`,
    footnote: 'Footnote',
    endnote: 'Endnote',
    comment: 'Comment',
    chart: 'Chart',
    smartArt: 'SmartArt',
    seriesName: 'Series Name',
    slide: (n) => `Slide ${n}`,
    notes: 'Notes',
};
