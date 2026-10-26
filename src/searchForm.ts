import { randomBytes } from 'crypto';
import * as vscode from 'vscode';
import { readConfig } from './config';
import { APP_KINDS, AppKind, FILE_TYPES } from './core/fileTypes';
import { MatchMode, parseQuery } from './core/query';
import { SearchRunner } from './searchRunner';

/** Webview → 拡張機能 のメッセージ */
type FromWebview =
    | { type: 'ready' }
    | { type: 'browse' }
    | { type: 'cancel' }
    | { type: 'search'; query: string; mode: MatchMode; folder: string; recursive: boolean; outputText: boolean; apps: string[] };

/** 拡張機能 → Webview のメッセージ */
type ToWebview =
    | { type: 'defaults'; recursive: boolean }
    | { type: 'setFolder'; folder: string; initial?: boolean }
    | { type: 'running'; running: boolean }
    | { type: 'error'; message: string };

/** サイドバーの検索フォーム */
export class SearchFormProvider implements vscode.WebviewViewProvider {
    static readonly viewId = 'officeSearch.form';
    private view: vscode.WebviewView | undefined;
    /** フォームが表示される前に指定されたフォルダ（表示されたら反映する） */
    private pendingFolder: string | undefined;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly runner: SearchRunner,
    ) {
        // 検索の開始・終了を、フォームのボタン表示に反映する
        runner.onDidChangeRunning((running) => this.post({ type: 'running', running }));
    }

    /** フォームが初めて表示されたとき（または作り直されたとき）に VS Code から呼ばれる */
    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        const media = vscode.Uri.joinPath(this.extensionUri, 'media');
        view.webview.options = {
            enableScripts: true,          // フォームの JavaScript を動かす
            localResourceRoots: [media],  // 読み込みを許可するのは media フォルダだけ
        };
        view.webview.html = this.getHtml(view.webview, media);
        view.webview.onDidReceiveMessage((msg: FromWebview) => this.onMessage(msg));
        view.onDidDispose(() => (this.view = undefined));
    }

    /** 右クリックで選ばれたフォルダをフォームに入れる */
    setFolder(folder: string): void {
        if (this.view) this.post({ type: 'setFolder', folder });
        else this.pendingFolder = folder; // まだ表示されていなければ、表示されたときに入れる
    }

    private post(message: ToWebview): void {
        void this.view?.webview.postMessage(message);
    }

    private async onMessage(msg: FromWebview): Promise<void> {
        switch (msg.type) {
            case 'ready': {
                // 設定の既定値（保存済みの入力がなければ、フォーム側で使う）
                this.post({ type: 'defaults', recursive: readConfig().includeSubfolders });
                // 初期値：保留中のフォルダ、なければ開いているワークスペースの最初のフォルダ
                if (this.pendingFolder) {
                    this.post({ type: 'setFolder', folder: this.pendingFolder }); // 右クリックで選ばれたフォルダは必ず入れる
                    this.pendingFolder = undefined;
                } else {
                    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    // initial: 入力済みのフォルダがあれば、フォーム側で上書きしない
                    if (folder) this.post({ type: 'setFolder', folder, initial: true });
                }
                this.post({ type: 'running', running: this.runner.isRunning });
                break;
            }
            case 'browse': {
                // Webview の中からはファイルシステムに触れないので、拡張機能側で選択画面を開く
                const picked = await vscode.window.showOpenDialog({
                    canSelectFiles: false,
                    canSelectFolders: true,
                    openLabel: vscode.l10n.t('Search This Folder'),
                });
                if (picked) this.post({ type: 'setFolder', folder: picked[0].fsPath });
                break;
            }
            case 'cancel':
                this.runner.cancel();
                break;
            case 'search': {
                // 入力の検証は拡張機能側で行う（Webview から届く値は信用しない）
                const keywords = parseQuery(msg.query ?? '');
                if (keywords.length === 0) {
                    this.post({ type: 'error', message: vscode.l10n.t('Enter at least one keyword') });
                    return;
                }
                if (!msg.folder) {
                    this.post({ type: 'error', message: vscode.l10n.t('Specify a folder to search') });
                    return;
                }
                // フォルダが存在し、本当にフォルダであるかを確かめる（Step 10 の課題1）
                let stat: vscode.FileStat;
                try {
                    stat = await vscode.workspace.fs.stat(vscode.Uri.file(msg.folder));
                } catch {
                    this.post({ type: 'error', message: vscode.l10n.t('The folder does not exist') });
                    return;
                }
                if ((stat.type & vscode.FileType.Directory) === 0) {
                    this.post({ type: 'error', message: vscode.l10n.t('The path is not a folder') });
                    return;
                }
                // アプリの種類は、決められた値だけを受け付ける（Webview から届く値は信用しない）
                const apps = (Array.isArray(msg.apps) ? msg.apps : []).filter((a): a is AppKind =>
                    (APP_KINDS as string[]).includes(a),
                );
                if (apps.length === 0) {
                    this.post({ type: 'error', message: vscode.l10n.t('Select at least one file type') });
                    return;
                }
                const mode: MatchMode = msg.mode === 'all' ? 'all' : 'any';
                await this.runner.run({
                    keywords,
                    mode,
                    root: msg.folder,
                    recursive: msg.recursive === true,
                    outputText: msg.outputText === true,
                    apps,
                });
                break;
            }
        }
    }

    private getHtml(webview: vscode.Webview, media: vscode.Uri): string {
        const nonce = makeNonce();
        const script = webview.asWebviewUri(vscode.Uri.joinPath(media, 'form.js'));
        const style = webview.asWebviewUri(vscode.Uri.joinPath(media, 'form.css'));
        // CSP：スタイルは media フォルダから、スクリプトは nonce の付いたものだけを許可する
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource}`,
            `script-src 'nonce-${nonce}'`,
        ].join('; ');

        const e = escapeHtml; // 翻訳した文字は必ずエスケープして埋め込む
        return `<!DOCTYPE html>
<html lang="${escapeHtml(vscode.env.language)}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${style}">
</head>
<body>
  <form id="form">
    <label for="query">${e(vscode.l10n.t('Keywords'))}</label>
    <input id="query" type="text" placeholder="${e(vscode.l10n.t('e.g. invoice 2026 "project plan"'))}" autocomplete="off">

    <fieldset>
      <legend>${e(vscode.l10n.t('With multiple keywords'))}</legend>
      <label class="inline"><input type="radio" name="mode" value="any" checked> ${e(vscode.l10n.t('Match any (OR)'))}</label>
      <label class="inline"><input type="radio" name="mode" value="all"> ${e(vscode.l10n.t('Match all (AND)'))}</label>
    </fieldset>

    <label for="folder">${e(vscode.l10n.t('Folder'))}</label>
    <div class="row">
      <input id="folder" type="text" placeholder="${e(vscode.l10n.t('Folder to search'))}">
      <button id="browse" type="button" class="secondary">${e(vscode.l10n.t('Browse...'))}</button>
    </div>

    <label class="inline"><input id="recursive" type="checkbox" checked> ${e(vscode.l10n.t('Include subfolders'))}</label>

    <fieldset>
      <legend>${e(vscode.l10n.t('File types'))}</legend>
      ${APP_KINDS.map((app) => {
            // 例: Excel（.xlsx / .xlsm / .xls）。チェックボックスは FILE_TYPES の一覧から作る
            const label = `${FILE_TYPES[app].label} (${FILE_TYPES[app].extensions.join(' / ')})`;
            return `<label class="inline"><input type="checkbox" name="app" value="${app}" checked> ${e(label)}</label>`;
        }).join('\n      ')}
    </fieldset>
    <fieldset>
        <legend>${e(vscode.l10n.t('Output'))}</legend>
        <label class="inline"><input id="outputText" type="checkbox"> ${e(vscode.l10n.t('Also open the results as text'))}</label>
    </fieldset>
    <p id="error" class="error" role="alert"></p>

    <div class="row">
      <button id="search" type="submit">${e(vscode.l10n.t('Search'))}</button>
      <button id="cancel" type="button" class="secondary" hidden>${e(vscode.l10n.t('Cancel'))}</button>
    </div>
  </form>
  <script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
    }
}

/** HTML に埋め込む文字列の特殊文字を、文字として表示されるように置き換える */
function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** CSP の nonce（推測できないランダムな文字列）を作る */
function makeNonce(): string {
    return randomBytes(16).toString('base64');
}
