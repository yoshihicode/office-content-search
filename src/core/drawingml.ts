import { Labels, TextUnit, ZipFiles } from './types';
import { Attrs, readRels, walkXml } from './xml';
import { readText } from './zip';

/** 図形の中から参照されているグラフ・SmartArt */
export interface GraphicRef {
    kind: 'chart' | 'smartArt';
    rid: string;  // リレーション ID
    name: string; // 図形の名前（「グラフ 1」など）
}

/**
 * 図形の名前を追跡し、グラフ・SmartArt への参照を集める
 * Excel（xdr:cNvPr）、PowerPoint（p:cNvPr）、Word（wp:docPr）のどれにも対応する
 */
class GraphicRefCollector {
    shapeName = '';
    readonly refs: GraphicRef[] = [];

    open(name: string, a: Attrs): void {
        if (name.endsWith(':cNvPr') || name === 'wp:docPr') {
            this.shapeName = a.name ?? '';
        } else if (name === 'c:chart' && a['r:id']) {
            this.refs.push({ kind: 'chart', rid: a['r:id'], name: this.shapeName });
        } else if (name === 'dgm:relIds' && a['r:dm']) {
            this.refs.push({ kind: 'smartArt', rid: a['r:dm'], name: this.shapeName });
        }
    }
}

/**
 * DrawingML の段落（a:p）を図形ごとに取り出す
 * @param prefix 位置の先頭（シート名やスライド番号）
 * @param withShapeName 位置に図形の名前を付けるか
 */
export function extractShapes(
    xml: string,
    prefix: string,
    withShapeName = true,
): { units: TextUnit[]; refs: GraphicRef[] } {
    const units: TextUnit[] = [];
    const collector = new GraphicRefCollector();
    let current: string | null = null;
    let inText = false;

    walkXml(xml, {
        open(name, a) {
            collector.open(name, a);
            if (name === 'a:p') current = '';
            else if (name === 'a:t') inText = true;
            else if (name === 'a:br' && current !== null) current += ' ';
        },
        close(name) {
            if (name === 'a:t') inText = false;
            else if (name === 'a:p') {
                const text = (current ?? '').trim();
                current = null;
                if (text === '') return;
                const shape = collector.shapeName;
                units.push({ location: withShapeName && shape ? `${prefix} › ${shape}` : prefix, text });
            }
        },
        text(t) {
            if (inText && current !== null) current += t;
        },
    });
    return { units, refs: collector.refs };
}

/** Word の本文など、DrawingML 以外の部品からグラフ・SmartArt への参照だけを集める */
export function collectGraphicRefs(xml: string): GraphicRef[] {
    const collector = new GraphicRefCollector();
    walkXml(xml, { open: (name, a) => collector.open(name, a) });
    return collector.refs;
}

/** グラフのタイトル・軸ラベル（a:p）と系列名（c:ser の c:tx）を取り出す */
function extractChart(xml: string, location: string, labels: Labels): TextUnit[] {
    const units: TextUnit[] = [];
    let current: string | null = null; // a:p の組み立て
    let inText = false;
    let seriesDepth = 0;
    let seriesName: string | null = null; // c:ser > c:tx の組み立て
    let inValue = false;

    walkXml(xml, {
        open(name) {
            if (name === 'a:p') current = '';
            else if (name === 'a:t') inText = true;
            else if (name === 'c:ser') seriesDepth++;
            else if (name === 'c:tx' && seriesDepth > 0) seriesName = '';
            else if (name === 'c:v') inValue = true;
        },
        close(name) {
            if (name === 'a:t') inText = false;
            else if (name === 'c:v') inValue = false;
            else if (name === 'c:ser') seriesDepth--;
            else if (name === 'a:p') {
                const text = (current ?? '').trim();
                current = null;
                if (text !== '') units.push({ location, text });
            } else if (name === 'c:tx' && seriesName !== null) {
                const text = seriesName.trim();
                seriesName = null;
                if (text !== '') units.push({ location: `${location} › ${labels.seriesName}`, text });
            }
        },
        text(t) {
            if (inText && current !== null) current += t;
            if (inValue && seriesName !== null) seriesName += t;
        },
    });
    return units;
}

/** 部品から参照されているグラフ・SmartArt を、リレーションをたどって読む */
export function extractGraphics(
    files: ZipFiles,
    sourcePart: string,
    refs: GraphicRef[],
    prefix: string,
    labels: Labels,
): TextUnit[] {
    if (refs.length === 0) return [];
    const rels = readRels(files, sourcePart);
    const units: TextUnit[] = [];
    for (const ref of refs) {
        const rel = rels.get(ref.rid);
        const xml = rel ? readText(files, rel.target) : undefined;
        if (xml === undefined) continue;
        const kind = ref.kind === 'chart' ? labels.chart : labels.smartArt;
        const location = `${prefix} › ${kind}${ref.name ? ` "${ref.name}"` : ''}`;
        if (ref.kind === 'chart') units.push(...extractChart(xml, location, labels));
        else units.push(...extractShapes(xml, location, false).units); // SmartArt のデータも a:p で書かれている
    }
    return units;
}
