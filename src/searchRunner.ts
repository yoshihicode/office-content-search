import * as path from 'path';
import * as vscode from 'vscode';
import { Matcher, MatchMode } from './core/query';
import { searchFile } from './core/search';
import { collectFiles } from './core/walk';
import { readConfig } from './config';
import { localizedLabels, skipReasonText } from './i18n';
import { OfficeFileError } from './core/zip';
import { ResultsProvider } from './resultsView';

/** 検索条件（入力方法が QuickPick でもフォームでも、最後はこの形にそろえる） */
export interface SearchParams {
    keywords: string[];
    mode: MatchMode;
    root: string;
    recursive: boolean;
}

/** 検索の実行と状態を管理する（同時に動く検索は1つだけ） */
export class SearchRunner {
    private running: vscode.CancellationTokenSource | undefined;
    private readonly stateEmitter = new vscode.EventEmitter<boolean>();
    /** 検索中かどうかが変わったときに発火する（フォームのボタン表示の切り替えに使う） */
    readonly onDidChangeRunning = this.stateEmitter.event;

    constructor(
        private readonly provider: ResultsProvider,
        private readonly view: vscode.TreeView<unknown>,
    ) { }

    get isRunning(): boolean {
        return this.running !== undefined;
    }

    cancel(): void {
        this.running?.cancel();
    }

    async run(params: SearchParams): Promise<void> {
        const { keywords, mode, root, recursive } = params;
        this.cancel(); // 前の検索が動いていれば止める
        const cts = new vscode.CancellationTokenSource();
        this.running = cts;
        this.stateEmitter.fire(true);

        this.provider.clear();
        const keywordText = keywords.join(' / ');
        this.view.message = vscode.l10n.t('Searching for {0}...', keywordText);
        await vscode.commands.executeCommand('officeSearch.results.focus');

        const matcher = new Matcher(keywords, mode);
        // 設定は検索のたびに読む（設定を変えたら、次の検索からすぐ反映される）
        const config = readConfig();
        const searchOptions = { maxFileSizeBytes: config.maxFileSizeBytes, labels: localizedLabels(), maxHitsPerFile: config.maxHitsPerFile };
        let scanned = 0;
        try {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Searching Office files'), cancellable: true },
                async (progress, token) => {
                    token.onCancellationRequested(() => cts.cancel());
                    const isCancelled = () => cts.token.isCancellationRequested;

                    const { files, errors } = await collectFiles(root, {
                        recursive,
                        excludeFolders: config.excludeFolders,
                        isCancelled,
                    });
                    errors.forEach((e) => this.provider.addSkipped({ path: e.path, reason: skipReasonText('folder') }));

                    for (const file of files) {
                        if (isCancelled()) break;
                        progress.report({ message: `${scanned + 1}/${files.length} ${path.basename(file)}`, increment: 100 / files.length });
                        try {
                            const result = await searchFile(file, matcher, searchOptions);
                            if (result) this.provider.addResult(result);
                        } catch (e) {
                            // 想定内のエラーは理由を翻訳して表示し、想定外のエラーは英語の詳細を添える
                            const reason =
                                e instanceof OfficeFileError
                                    ? skipReasonText(e.reason)
                                    : `${skipReasonText('unknown')}: ${(e as Error).message}`;
                            this.provider.addSkipped({ path: file, reason });
                        }
                        scanned++;
                        await new Promise((resolve) => setImmediate(resolve));
                    }
                },
            );
        } finally {
            // 例外が起きても、必ず「検索中」の状態を解除する
            this.view.message = cts.token.isCancellationRequested
                ? vscode.l10n.t('Cancelled: {0} — {1} of {2} files matched', keywordText, this.provider.fileCount, scanned)
                : vscode.l10n.t('Done: {0} — {1} of {2} files matched', keywordText, this.provider.fileCount, scanned);
            if (this.running === cts) {
                this.running = undefined;
                this.stateEmitter.fire(false);
            }
            cts.dispose();
        }
    }

    dispose(): void {
        this.cancel();
        this.stateEmitter.dispose();
    }
}
