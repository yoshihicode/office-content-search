import { normalize } from './query';

export interface Snippet {
    /** 表示用の1行の文字列（必要なら前後に … が付く） */
    text: string;
    /** 強調する範囲 [開始, 終了) の一覧。text の中の位置 */
    highlights: [number, number][];
}

/**
 * ツリーに表示する抜粋を作り、キーワードの位置を強調範囲として返す
 * @param max  表示する最大文字数（… を除く）
 * @param lead キーワードの手前に残す文字数
 */
export function makeSnippet(text: string, keywords: string[], max = 80, lead = 20): Snippet {
    // 1. 改行・タブ・連続する空白を空白1つにまとめて1行にする
    const flat = text.replace(/\s+/g, ' ').trim();
    const normalized = normalize(flat);

    // 正規化で文字数が変わった場合（㈱ → (株) など）、位置の対応が取れないので強調しない
    const aligned = normalized.length === flat.length;
    const nKeywords = keywords.map(normalize);

    // 2. 表示範囲を決める：最初に見つかったキーワードの少し手前から
    let first = -1;
    if (aligned) {
        for (const k of nKeywords) {
            const i = normalized.indexOf(k);
            if (i >= 0 && (first < 0 || i < first)) first = i;
        }
    }
    let start = 0;
    if (flat.length > max) {
        start = Math.max(0, first - lead);           // 見つからなければ先頭から
        start = Math.min(start, flat.length - max);  // 末尾に近ければ、最後の max 文字を表示
    }
    const end = Math.min(flat.length, start + max);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < flat.length ? '…' : '';

    // 3. 表示範囲の中にある一致をすべて強調範囲にする（位置は prefix の分だけずらす）
    const ranges: [number, number][] = [];
    if (aligned) {
        for (const k of nKeywords) {
            for (let i = normalized.indexOf(k, start); i >= 0 && i + k.length <= end; i = normalized.indexOf(k, i + k.length)) {
                const s = i - start + prefix.length;
                ranges.push([s, s + k.length]);
            }
        }
    }

    return { text: prefix + flat.slice(start, end) + suffix, highlights: mergeRanges(ranges) };
}

/** 重なったり隣り合ったりしている範囲を1つにまとめる（「見積」と「見積書」の両方に一致した場合など） */
function mergeRanges(ranges: [number, number][]): [number, number][] {
    const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [s, e] of sorted) {
        const last = merged[merged.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
    }
    return merged;
}