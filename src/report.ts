import * as vscode from 'vscode';
import { makeSnippet } from './core/snippet';
import { FileResult } from './core/types';
import type { Skipped } from './resultsView';
import type { SearchParams } from './searchRunner';

/** 1回の検索の結果のまとめ（テキスト出力に使う） */
export interface SearchSummary {
    params: SearchParams;
    scanned: number;
    cancelled: boolean;
    results: readonly FileResult[];
    skipped: readonly Skipped[];
}

const SEPARATOR = '-'.repeat(60);

function quoteIfNeeded(keyword: string): string {
    return /[\s\u3000]/.test(keyword) ? `"${keyword}"` : keyword;
}

/** 検索結果をテキストの一覧にする */
export function buildReport(s: SearchSummary): string {
    const { params } = s;
    const multi = params.keywords.length > 1;
    const hitCount = s.results.reduce((n, r) => n + r.hits.length, 0);
    const lines: string[] = [];

    // --- 見出し：何を、どこで検索したか ---
    lines.push(vscode.l10n.t('Office Content Search results'));
    lines.push(vscode.l10n.t('Keywords: {0}', params.keywords.map(quoteIfNeeded).join(' / ')));
    if (multi) {
        lines.push(params.mode === 'all' ? vscode.l10n.t('Mode: match all (AND)') : vscode.l10n.t('Mode: match any (OR)'));
    }
    lines.push(vscode.l10n.t('Folder: {0}', params.root));
    lines.push(params.recursive ? vscode.l10n.t('Subfolders: included') : vscode.l10n.t('Subfolders: not included'));
    if (params.fileTypes && params.fileTypes.length < 4) {
        lines.push(vscode.l10n.t('File types: {0}', params.fileTypes.map((t) => '.' + t).join(', ')));
    }
    lines.push(
        vscode.l10n.t(
            'Files scanned: {0} / Matching files: {1} / Hits: {2} / Skipped: {3}',
            s.scanned,
            s.results.length,
            hitCount,
            s.skipped.length,
        ),
    );
    if (s.cancelled) lines.push(vscode.l10n.t('* The search was cancelled. The results may be incomplete.'));
    lines.push(SEPARATOR);

    // --- ファイルごとの結果 ---
    if (s.results.length === 0) lines.push(vscode.l10n.t('No matching files were found.'));
    for (const r of s.results) {
        lines.push('', r.path);
        for (const h of r.hits) {
            const prefix = multi ? `<${h.keywords.join(', ')}> ` : ''; // 複数キーワードのときは、一致した語を先頭に付ける
            lines.push(`  ${prefix}${h.location} : ${makeSnippet(h.text, h.keywords, 200).text}`);
        }
        if (r.truncated) lines.push('  ' + vscode.l10n.t('More hits were omitted (officeSearch.maxHitsPerFile)'));
    }

    // --- スキップしたファイル ---
    if (s.skipped.length > 0) {
        lines.push('', SEPARATOR, vscode.l10n.t('Skipped ({0})', s.skipped.length));
        for (const k of s.skipped) lines.push(`  ${k.path} : ${k.reason}`);
    }
    return lines.join('\n') + '\n';
}

/** 結果を、保存されていない新しいエディタのタブに開く */
export async function openReport(s: SearchSummary): Promise<void> {
    const doc = await vscode.workspace.openTextDocument({ content: buildReport(s), language: 'plaintext' });
    await vscode.window.showTextDocument(doc, { preview: false });
}