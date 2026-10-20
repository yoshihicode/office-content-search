import * as vscode from 'vscode';

/** 設定（settings.json）から、この拡張機能の設定値を読む */
export function readConfig() {
    const c = vscode.workspace.getConfiguration('officeSearch');
    return {
        includeSubfolders: c.get<boolean>('includeSubfolders', true),
        excludeFolders: new Set(c.get<string[]>('excludeFolders', ['.git', 'node_modules'])),
        // 0 や負の値が設定されても動くように、最小 1MB にそろえる
        maxFileSizeBytes: Math.max(1, c.get<number>('maxFileSizeMB', 50)) * 1024 * 1024,
        maxHitsPerFile: Math.max(1, c.get<number>('maxHitsPerFile', 200)),
    };
}