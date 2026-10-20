import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

/** ファイルを、OS で関連付けられたアプリ（Excel、Word など）で開く */
export async function openInDefaultApp(filePath: string): Promise<void> {
    // WSL の中で動いているときは、Windows 側のアプリで開く必要がある
    if (process.env.WSL_DISTRO_NAME) {
        const { stdout } = await execFileAsync('wslpath', ['-w', filePath]); // /home/... → \\wsl.localhost\...
        // explorer.exe は成功しても終了コード 1 を返すことがあるので、結果は待たない
        spawn('explorer.exe', [stdout.trim()], { detached: true, stdio: 'ignore' }).unref();
        return;
    }
    const ok = await vscode.env.openExternal(vscode.Uri.file(filePath));
    if (!ok) vscode.window.showWarningMessage(vscode.l10n.t('Could not open {0}', filePath));
}
