import { extractGraphics, extractShapes } from './drawingml';
import { Labels, TextUnit, ZipFiles } from './types';
import { mainPart, readRels, relsOfType, walkXml } from './xml';
import { readText } from './zip';

/** プレゼンテーション全体（スライド、ノート、グラフ、SmartArt）を読む */
export function extractPowerPointUnits(files: ZipFiles, labels: Labels): TextUnit[] {
    const presPath = mainPart(files);
    const presXml = presPath ? readText(files, presPath) : undefined;
    if (presPath === undefined || presXml === undefined) throw new Error('presentation part not found');

    // スライドの順番は presentation.xml の p:sldIdLst で決まる（ファイル名の番号ではない）
    const slideRids: string[] = [];
    walkXml(presXml, {
        open(name, a) {
            if (name === 'p:sldId' && a['r:id']) slideRids.push(a['r:id']);
        },
    });

    const presRels = readRels(files, presPath);
    const units: TextUnit[] = [];

    slideRids.forEach((rid, i) => {
        const slide = presRels.get(rid);
        const xml = slide ? readText(files, slide.target) : undefined;
        if (slide === undefined || xml === undefined) return;
        const prefix = labels.slide(i + 1);

        const { units: shapeUnits, refs } = extractShapes(xml, prefix);
        units.push(...shapeUnits, ...extractGraphics(files, slide.target, refs, prefix, labels));

        // ノートはスライドのリレーションからたどる
        for (const notes of relsOfType(readRels(files, slide.target), '/notesSlide')) {
            const notesXml = readText(files, notes.target);
            if (notesXml !== undefined) units.push(...extractShapes(notesXml, `${prefix} › ${labels.notes}`, false).units);
        }
    });
    return units;
}
