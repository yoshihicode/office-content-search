import { execFile } from 'child_process';
import * as path from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

/** ファイルを、OS で関連付けられたアプリ（Excel、Word など）で開く */
export async function openInDefaultApp(filePath: string): Promise<void> {
    const opening = openByPlatform(filePath);
    // PowerShell の起動などで少し時間がかかるので、開いている途中であることを表示する
    vscode.window.setStatusBarMessage(vscode.l10n.t('Opening {0}...', path.basename(filePath)), opening);
    try {
        await opening;
    } catch (e) {
        console.error('Office Content Search: could not open', filePath, e);
        vscode.window.showWarningMessage(vscode.l10n.t('Could not open {0}', filePath));
    }
}

/**
 * OS ごとに、日本語などを含むパスでも確実に開ける方法を選ぶ。
 * vscode.env.openExternal はパスを URL（%E6%97%A5… の形）に変換するため、
 * 環境によっては日本語の名前のファイルを開けないことがある
 */
async function openByPlatform(filePath: string): Promise<void> {
    if (process.platform === 'win32') {
        await invokeItem(filePath); // Windows
    } else if (process.env.WSL_DISTRO_NAME) {
        // WSL：Windows から見たパス（\\wsl.localhost\… や C:\…）に変換してから、Windows 側で開く
        const env = { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' };
        const { stdout } = await execFileAsync('wslpath', ['-w', filePath], { env });
        await invokeItem(stdout.trim(), env);
    } else if (process.platform === 'darwin') {
        await execFileAsync('open', [filePath]); // macOS
    } else {
        await execFileAsync('xdg-open', [filePath]); // Linux
    }
}

/**
 * Windows の PowerShell で、ファイルを関連付けられたアプリで開く。
 * パスを確実に渡すため、命令を UTF-16 の Base64（-EncodedCommand）にして渡す
 */
async function invokeItem(windowsPath: string, env?: NodeJS.ProcessEnv): Promise<void> {
    // PowerShell の '…' の中では、' を '' と2つ重ねて書く
    const command = `Invoke-Item -LiteralPath '${windowsPath.replace(/'/g, "''")}'`;
    const encoded = Buffer.from(command, 'utf16le').toString('base64');
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env });
}