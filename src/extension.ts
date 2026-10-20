import * as path from 'path';
import * as vscode from 'vscode';
import { openInDefaultApp } from './openFile';
import { Node, ResultsProvider } from './resultsView';
import { SearchFormProvider } from './searchForm';
import { SearchRunner } from './searchRunner';
import { openReport } from './report';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ResultsProvider();
    const view = vscode.window.createTreeView('officeSearch.results', { treeDataProvider: provider });
    const runner = new SearchRunner(provider, view);

    // サイドバーの検索フォーム
    const form = new SearchFormProvider(context.extensionUri, runner);
    const formRegistration = vscode.window.registerWebviewViewProvider(SearchFormProvider.viewId, form);

    // エクスプローラーの右クリック：フォームにフォルダを入れて表示する
    const searchInFolder = vscode.commands.registerCommand('officeSearch.searchInFolder', async (uri: vscode.Uri) => {
        form.setFolder(uri.fsPath);
        await vscode.commands.executeCommand(`${SearchFormProvider.viewId}.focus`);
    });

    const openFile = vscode.commands.registerCommand('officeSearch.openFile', (filePath: string) =>
        openInDefaultApp(filePath),
    );

    /**
     * 右クリック・インラインのボタンから呼ばれたときは、その行が引数で渡される。
     * キーボード（Ctrl+C）から呼ばれたときは引数がないので、選択中の行を使う
     */
    const selectedPath = (node?: Node): string | undefined => {
        const target = node ?? view.selection[0];
        return target ? ResultsProvider.pathOf(target) : undefined;
    };

    const copy = async (text: string) => {
        await vscode.env.clipboard.writeText(text);
        vscode.window.setStatusBarMessage(vscode.l10n.t('Copied: {0}', text), 3000); // 下のステータスバーに数秒表示する
    };

    const copyFileName = vscode.commands.registerCommand('officeSearch.copyFileName', async (node?: Node) => {
        const p = selectedPath(node);
        if (p) await copy(path.basename(p));
    });

    const copyPath = vscode.commands.registerCommand('officeSearch.copyPath', async (node?: Node) => {
        const p = selectedPath(node);
        if (p) await copy(p);
    });

    // 結果ビューのボタン：最後の検索結果をテキストで開く
    const openAsText = vscode.commands.registerCommand('officeSearch.openAsText', async () => {
        if (!runner.lastSummary) {
            vscode.window.showInformationMessage(vscode.l10n.t('Run a search first.'));
            return;
        }
        await openReport(runner.lastSummary);
    });
    const clearResults = vscode.commands.registerCommand('officeSearch.clearResults', () => {
        runner.cancel();
        runner.lastSummary = undefined;
        provider.clear();
        view.message = undefined;
    });

    context.subscriptions.push(view, runner, formRegistration, searchInFolder, openFile, clearResults, copyFileName, copyPath, openAsText);
}

export function deactivate() { }