import { readFile } from 'fs/promises';
import { strFromU8, unzipSync } from 'fflate';
import { ZipFiles } from './types';

/** ファイル先頭のシグネチャ（マジックナンバー） */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"
const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]; // OLE 複合ファイル

function startsWith(data: Uint8Array, signature: number[]): boolean {
    return data.length >= signature.length && signature.every((byte, i) => data[i] === byte);
}

export type OfficeFileErrorReason = 'legacy' | 'tooLarge' | 'encrypted' | 'notOfficeFile';

/** 原因の種類（reason）を持つエラー */
export class OfficeFileError extends Error {
    constructor(
        readonly reason: OfficeFileErrorReason,
        message: string,
    ) {
        super(message);
        this.name = 'OfficeFileError';
    }
}

/** Office ファイルを開き、XML と .rels だけを展開して返す */
export async function openOfficeFile(path: string): Promise<ZipFiles> {
    const data = await readFile(path);

    if (startsWith(data, CFB_SIGNATURE)) {
        throw new OfficeFileError('encrypted', 'encrypted (password-protected) file');
    }
    if (!startsWith(data, ZIP_SIGNATURE)) {
        throw new OfficeFileError('notOfficeFile', 'not an Office Open XML file, or the file is corrupt');
    }

    return unzipSync(data, {
        // 画像や動画は検索に不要なので展開しない
        filter: (file) => file.name.endsWith('.xml') || file.name.endsWith('.rels'),
    });
}

/** 展開済みのファイルから、指定したパスのテキストを取り出す */
export function readText(files: ZipFiles, name: string): string | undefined {
    const data = files[name];
    return data ? strFromU8(data) : undefined;
}
