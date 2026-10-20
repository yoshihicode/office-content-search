import { collectGraphicRefs, extractGraphics } from './drawingml';
import { Labels, TextUnit, ZipFiles } from './types';
import { mainPart, readRels, relsOfType, walkXml } from './xml';
import { readText } from './zip';

export interface Paragraph {
    /** 段落番号（1始まり）。テキストボックス内の段落は null */
    index: number | null;
    inTextBox: boolean;
    text: string;
}

/** WordprocessingML（本文、ヘッダー、脚注など）から段落ごとのテキストを取り出す */
export function extractParagraphs(xml: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const stack: string[] = []; // 組み立て中の段落（入れ子に対応）
    let runDepth = 0;
    let inText = false;
    let txbxDepth = 0;
    let index = 0;

    // mc:Fallback の読み飛ばしは walkXml が行うので、ここでは考えなくてよい
    walkXml(xml, {
        open(name) {
            switch (name) {
                case 'w:p':
                    stack.push('');
                    break;
                case 'w:r':
                    runDepth++;
                    break;
                case 'w:t':
                    inText = true;
                    break;
                case 'w:tab':
                case 'w:br':
                    if (runDepth > 0 && stack.length > 0) stack[stack.length - 1] += ' ';
                    break;
                case 'w:txbxContent':
                    txbxDepth++;
                    break;
            }
        },
        close(name) {
            switch (name) {
                case 'w:r':
                    runDepth--;
                    break;
                case 'w:t':
                    inText = false;
                    break;
                case 'w:txbxContent':
                    txbxDepth--;
                    break;
                case 'w:p': {
                    const text = stack.pop() ?? '';
                    const inTextBox = txbxDepth > 0;
                    if (!inTextBox) index++;
                    if (text.trim() !== '') paragraphs.push({ index: inTextBox ? null : index, inTextBox, text });
                    break;
                }
            }
        },
        text(t) {
            if (inText && stack.length > 0) stack[stack.length - 1] += t;
        },
    });
    return paragraphs;
}

/** 1つの部品（本文やヘッダー）の段落を TextUnit に変換する */
function partToUnits(xml: string, label: string, numbered: boolean, labels: Labels): TextUnit[] {
    return extractParagraphs(xml).map((p) => ({
        location: p.inTextBox ? `${label} › ${labels.textBox}` : numbered ? `${label} ¶${p.index}` : label,
        text: p.text,
    }));
}

/**
 * 本文のセクション情報（w:sectPr）から、ヘッダー・フッターの「r:id → 表示名」を作る
 * 例: 先頭ページのヘッダー、偶数ページのフッター（セクション 2）
 */
function readHeaderFooterLabels(docXml: string, labels: Labels): Map<string, string> {
    const refs: { rid: string; isHeader: boolean; type: string; section: number }[] = [];
    let section = 1;
    walkXml(docXml, {
        open(name, a) {
            if (name === 'w:headerReference' || name === 'w:footerReference') {
                refs.push({ rid: a['r:id'], isHeader: name === 'w:headerReference', type: a['w:type'] ?? 'default', section });
            }
        },
        close(name) {
            if (name === 'w:sectPr') section++; // w:sectPr が閉じるたびに次のセクションへ
        },
    });

    const multiSection = section - 1 > 1; // セクションが複数あるときだけ番号を付ける
    const result = new Map<string, string>();
    for (const r of refs) {
        if (result.has(r.rid)) continue;
        let name: string;
        if (r.type === 'first') name = r.isHeader ? labels.firstPageHeader : labels.firstPageFooter;
        else if (r.type === 'even') name = r.isHeader ? labels.evenPageHeader : labels.evenPageFooter;
        else name = r.isHeader ? labels.header : labels.footer;
        result.set(r.rid, multiSection ? `${name} (${labels.section(r.section)})` : name);
    }
    return result;
}

/** Word 文書全体（本文、ヘッダー・フッター、脚注、文末脚注、コメント）を読む */
export function extractWordUnits(files: ZipFiles, labels: Labels): TextUnit[] {
    const docPath = mainPart(files);
    const docXml = docPath ? readText(files, docPath) : undefined;
    if (docPath === undefined || docXml === undefined) throw new Error('document part not found');

    const units = partToUnits(docXml, labels.body, true, labels);

    const rels = readRels(files, docPath);
    units.push(...extractGraphics(files, docPath, collectGraphicRefs(docXml), labels.body, labels));

    // ヘッダー・フッター：r:id から「どのページの、どのセクションのものか」を表示名にする
    for (const [rid, label] of readHeaderFooterLabels(docXml, labels)) {
        const rel = rels.get(rid);
        if (rel === undefined) continue;
        const xml = readText(files, rel.target);
        if (xml === undefined) continue;
        units.push(...partToUnits(xml, label, false, labels));
        units.push(...extractGraphics(files, rel.target, collectGraphicRefs(xml), label, labels));
    }

    // 脚注・文末脚注・コメント：リレーションの種類で見分けてたどる
    const parts: [string, string][] = [
        ['/footnotes', labels.footnote],
        ['/endnotes', labels.endnote],
        ['/comments', labels.comment],
    ];
    for (const [typeSuffix, label] of parts) {
        for (const rel of relsOfType(rels, typeSuffix)) {
            const xml = readText(files, rel.target);
            if (xml !== undefined) units.push(...partToUnits(xml, label, false, labels));
        }
    }
    return units;
}
