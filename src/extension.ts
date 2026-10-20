import * as vscode from 'vscode';
import { openInDefaultApp } from './openFile';
import { ResultsProvider } from './resultsView';
import { SearchFormProvider } from './searchForm';
import { SearchRunner } from './searchRunner';

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

    const clearResults = vscode.commands.registerCommand('officeSearch.clearResults', () => {
        runner.cancel();
        provider.clear();
        view.message = undefined;
    });

    context.subscriptions.push(view, runner, formRegistration, searchInFolder, openFile, clearResults);
}

export function deactivate() { }