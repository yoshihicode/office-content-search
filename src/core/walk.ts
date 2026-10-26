import { promises as fs } from 'fs';
import * as path from 'path';
import { AppKind, appOf } from './fileTypes';

export interface WalkOptions {
    recursive: boolean;          // サブフォルダも探すか
    excludeFolders: Set<string>; // 探さないフォルダ名（.git など）
    isCancelled?: () => boolean; // キャンセルされたか
    apps?: AppKind[]; // 検索するアプリの種類。省略または空ならすべて
}

export interface WalkResult {
    files: string[];
    /** 開けなかったフォルダ（アクセス権がないなど） */
    errors: { path: string; message: string }[];
}

/** フォルダの中の Office ファイルを集める */
export async function collectFiles(root: string, options: WalkOptions): Promise<WalkResult> {
    const result: WalkResult = { files: [], errors: [] };

    // アプリの指定があれば、そのアプリのファイルだけを対象にする
    const wanted = options.apps && options.apps.length > 0 ? new Set(options.apps) : undefined;
    const isTarget = (name: string) => {
        const app = appOf(name);
        return app !== undefined && (wanted === undefined || wanted.has(app));
    };

    async function visit(dir: string): Promise<void> {
        if (options.isCancelled?.()) return;

        let entries;
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch (e) {
            result.errors.push({ path: dir, message: (e as Error).message });
            return; // このフォルダだけ飛ばして、ほかのフォルダは続ける
        }

        entries.sort((a, b) => a.name.localeCompare(b.name)); // 結果の順番を毎回同じにする
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (options.recursive && !options.excludeFolders.has(entry.name)) await visit(full);
            } else if (entry.isFile() && isTarget(entry.name) && !entry.name.startsWith('~$')) {
                result.files.push(full);
            }
        }
    }

    await visit(root);
    return result;
}
