import { SaxesParser } from 'saxes';
import { ZipFiles } from './types';
import { readText } from './zip';

export type Attrs = Record<string, string>;

export interface XmlHandlers {
    open?(name: string, attrs: Attrs): void;
    close?(name: string): void;
    text?(text: string): void;
}

// ---------------------------------------------------------------------------
// 名前空間：接頭辞（w: や c: など）ではなく、名前空間の URI で要素を見分ける
// ---------------------------------------------------------------------------

/** 名前空間 URI → このプログラムで使う標準の接頭辞 */
const NAMESPACES: Record<string, string> = {
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
    'http://schemas.openxmlformats.org/spreadsheetml/2006/main': 'x',
    'http://schemas.openxmlformats.org/presentationml/2006/main': 'p',
    'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
    'http://schemas.openxmlformats.org/drawingml/2006/chart': 'c',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
    'http://schemas.openxmlformats.org/package/2006/relationships': 'pr',
    'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
};

function canonicalName(uri: string, local: string, prefix: string): string {
    if (!uri) return local; // 名前空間なし（属性に多い）
    const p = NAMESPACES[uri];
    if (p) return `${p}:${local}`;
    return prefix ? `${prefix}:${local}` : local; // 知らない名前空間は元の接頭辞のまま
}

/**
 * 中身を丸ごと読み飛ばす要素
 * - mc:Fallback … mc:Choice と同じ内容の代替表現（Word のテキストボックス）
 * - x:rPh       … Excel のふりがな
 */
const SKIP = new Set(['mc:Fallback', 'x:rPh']);

/** XML を先頭から順に読み、標準の接頭辞に直した名前でハンドラを呼ぶ */
export function walkXml(xml: string, handlers: XmlHandlers): void {
    const parser = new SaxesParser({ xmlns: true });
    const names: string[] = []; // 開いている要素の名前（closetag で使う）
    let skipDepth = 0;

    parser.on('opentag', (tag) => {
        const name = canonicalName(tag.uri, tag.local, tag.prefix);
        names.push(name);
        if (skipDepth > 0) {
            skipDepth++;
            return;
        }
        if (SKIP.has(name)) {
            skipDepth = 1;
            return;
        }
        const attrs: Attrs = {};
        for (const a of Object.values(tag.attributes)) {
            if (a.prefix === 'xmlns' || a.name === 'xmlns') continue; // 名前空間の宣言そのものは除く
            attrs[canonicalName(a.uri, a.local, a.prefix)] = a.value;
        }
        handlers.open?.(name, attrs);
    });

    parser.on('closetag', () => {
        const name = names.pop() ?? '';
        if (skipDepth > 0) {
            skipDepth--;
            return;
        }
        handlers.close?.(name);
    });

    parser.on('text', (text) => {
        if (skipDepth === 0) handlers.text?.(text);
    });

    parser.write(xml).close();
}

// ---------------------------------------------------------------------------
// リレーション（.rels）
// ---------------------------------------------------------------------------

export interface Rel {
    type: string;   // 種類（URI。末尾で判定する）
    target: string; // 参照先（ZIP 内の完全なパスに変換済み）
}

/** 部品のパスから、その部品の .rels のパスを求める（xl/workbook.xml → xl/_rels/workbook.xml.rels） */
export function relsPathFor(part: string): string {
    if (part === '') return '_rels/.rels'; // パッケージ全体の入口
    const i = part.lastIndexOf('/');
    return `${part.slice(0, i + 1)}_rels/${part.slice(i + 1)}.rels`;
}

/** 相対パスの Target を、ZIP 内の完全なパスに変換する */
export function resolvePath(basePart: string, target: string): string {
    if (target.startsWith('/')) return target.slice(1); // 絶対パス
    const dir = basePart.includes('/') ? basePart.slice(0, basePart.lastIndexOf('/')).split('/') : [];
    for (const seg of target.split('/')) {
        if (seg === '..') dir.pop();
        else if (seg !== '.' && seg !== '') dir.push(seg);
    }
    return dir.join('/');
}

/** 部品のリレーションを「ID → Rel」の対応表として読む。part に '' を渡すとパッケージの入口 */
export function readRels(files: ZipFiles, part: string): Map<string, Rel> {
    const rels = new Map<string, Rel>();
    const xml = readText(files, relsPathFor(part));
    if (xml === undefined) return rels;
    walkXml(xml, {
        open(name, a) {
            if (name !== 'pr:Relationship' || a.TargetMode === 'External') return; // 外部 URL は対象外
            rels.set(a.Id, { type: a.Type, target: resolvePath(part, a.Target) });
        },
    });
    return rels;
}

/** 種類の末尾が一致するリレーションを探す（例: '/header'） */
export function relsOfType(rels: Map<string, Rel>, typeSuffix: string): Rel[] {
    return [...rels.values()].filter((r) => r.type.endsWith(typeSuffix));
}

/** パッケージの入口（_rels/.rels）から本体の部品を特定する */
export function mainPart(files: ZipFiles): string | undefined {
    return relsOfType(readRels(files, ''), '/officeDocument')[0]?.target;
}
