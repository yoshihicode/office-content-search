import { promises as fs } from 'fs';
import { extractTextUnits } from './extract';
import { Matcher } from './query';
import { defaultLabels, FileResult, Hit, Labels } from './types';
import { OfficeFileError, openOfficeFile } from './zip';

const LEGACY_FILE = /\.(doc|xls|ppt)$/i;

export interface SearchOptions {
    /** これより大きいファイルは読まずにスキップする */
    maxFileSizeBytes: number;
    /** 1ファイルあたりのヒット数の上限 */
    maxHitsPerFile: number;
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
        throw new OfficeFileError('legacy', 'legacy binary format is not supported');
    }
    // 読み込む前にサイズを確かめる（巨大なファイルで拡張機能ホストが固まるのを防ぐ）
    const { size } = await fs.stat(filePath);
    if (size > options.maxFileSizeBytes) {
        throw new OfficeFileError('tooLarge', 'file is larger than the size limit');
    }

    const units = extractTextUnits(filePath, await openOfficeFile(filePath), options.labels ?? defaultLabels);
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
