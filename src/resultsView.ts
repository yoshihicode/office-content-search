import * as path from 'path';
import * as vscode from 'vscode';
import { makeSnippet } from './core/snippet';
import { FileResult, Hit } from './core/types';

/** 開けなかったファイル・フォルダ */
export interface Skipped {
    path: string;
    reason: string;
}

/** ツリーの1行 */
type Node =
    | { type: 'file'; file: FileResult }
    | { type: 'hit'; file: FileResult; hit: Hit }
    | { type: 'more'; file: FileResult } // ヒット数の上限で省略したことを知らせる行
    | { type: 'skipGroup' }
    | { type: 'skip'; skipped: Skipped };

export class ResultsProvider implements vscode.TreeDataProvider<Node> {
    private readonly changeEmitter = new vscode.EventEmitter<Node | undefined>();
    readonly onDidChangeTreeData = this.changeEmitter.event;

    private results: FileResult[] = [];
    private skipped: Skipped[] = [];

    /** 検索を始めるときに、前回の結果を消す */
    clear(): void {
        this.results = [];
        this.skipped = [];
        this.changeEmitter.fire(undefined);
    }

    /** 1ファイル分の結果を追加する（検索の途中でも表示を更新する） */
    addResult(result: FileResult): void {
        this.results.push(result);
        this.changeEmitter.fire(undefined);
    }

    addSkipped(skipped: Skipped): void {
        this.skipped.push(skipped);
        this.changeEmitter.fire(undefined);
    }

    get fileCount(): number {
        return this.results.length;
    }

    getChildren(node?: Node): Node[] {
        if (node === undefined) {
            const nodes: Node[] = this.results.map((file) => ({ type: 'file', file }));
            if (this.skipped.length > 0) nodes.push({ type: 'skipGroup' }); // スキップは一番下にまとめる
            return nodes;
        }
        if (node.type === 'file') {
            const children: Node[] = node.file.hits.map((hit) => ({ type: 'hit', file: node.file, hit }));
            if (node.file.truncated) children.push({ type: 'more', file: node.file }); // 省略したときは最後に1行足す
            return children;
        }
        if (node.type === 'skipGroup') return this.skipped.map((skipped) => ({ type: 'skip', skipped }));
        return [];
    }

    getTreeItem(node: Node): vscode.TreeItem {
        switch (node.type) {
            case 'file': {
                const item = new vscode.TreeItem(path.basename(node.file.path), vscode.TreeItemCollapsibleState.Expanded);
                item.resourceUri = vscode.Uri.file(node.file.path);
                const n = node.file.hits.length;
                item.description = n === 1 ? vscode.l10n.t('{0} hit', n) : vscode.l10n.t('{0} hits', n);
                item.tooltip = node.file.path;
                item.command = { command: 'officeSearch.openFile', title: vscode.l10n.t('Open'), arguments: [node.file.path] };
                return item;
            }
            case 'hit': {
                const snippet = makeSnippet(node.hit.text, node.hit.keywords);
                const label: vscode.TreeItemLabel = { label: snippet.text, highlights: snippet.highlights };
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
                item.description = node.hit.location;
                item.tooltip = `${node.hit.location}\n\n${node.hit.text}`;
                item.command = { command: 'officeSearch.openFile', title: vscode.l10n.t('Open'), arguments: [node.file.path] };
                return item;
            }
            case 'more': {
                const item = new vscode.TreeItem(
                    vscode.l10n.t('More hits were omitted (officeSearch.maxHitsPerFile)'),
                    vscode.TreeItemCollapsibleState.None,
                );
                item.iconPath = new vscode.ThemeIcon('ellipsis');
                return item;
            }
            case 'skipGroup': {
                // 普段は邪魔にならないよう、折りたたんでおく
                const item = new vscode.TreeItem(vscode.l10n.t('Skipped ({0})', this.skipped.length), vscode.TreeItemCollapsibleState.Collapsed);
                item.iconPath = new vscode.ThemeIcon('warning');
                return item;
            }
            case 'skip': {
                const item = new vscode.TreeItem(path.basename(node.skipped.path), vscode.TreeItemCollapsibleState.None);
                item.description = node.skipped.reason;
                item.tooltip = `${node.skipped.path}\n${node.skipped.reason}`;
                return item;
            }
        }
    }
}