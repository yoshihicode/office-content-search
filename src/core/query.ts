const SPACES = new Set([' ', '\u3000', '\t']); // 半角スペース、全角スペース、タブ

/**
 * 検索文字列をキーワードの配列に分解する
 * - 半角・全角スペースで区切る
 * - "..." で囲んだ部分はスペースを含めて1語（全角の “ ” ＂ も可）
 * - 閉じ引用符がなければ末尾までを1語とする
 * - 空の語句と重複（大文字小文字・全角半角の違いだけのもの）は除く
 */
export function parseQuery(input: string): string[] {
    const s = input.replace(/[\u201C\u201D\uFF02]/g, '"'); // “ ” ＂ を " に統一
    const keywords: string[] = [];
    const seen = new Set<string>();
    let token = '';
    let inQuote = false;

    const flush = () => {
        const t = token.trim(); // 前後の空白（全角スペースも含む）を除く
        token = '';
        if (t === '') return;
        const key = normalize(t);
        if (seen.has(key)) return;
        seen.add(key);
        keywords.push(t);
    };

    for (const ch of s) {
        if (ch === '"') {
            flush();
            inQuote = !inQuote;
        } else if (!inQuote && SPACES.has(ch)) {
            flush();
        } else {
            token += ch;
        }
    }
    flush();
    return keywords;
}

/** 大文字小文字・全角半角の違いを吸収する */
export function normalize(s: string): string {
    return s.normalize('NFKC').toLowerCase();
}

export type MatchMode = 'any' | 'all';

export class Matcher {
    private readonly normalizedKeywords: string[];

    constructor(
        readonly keywords: string[],
        readonly mode: MatchMode,
    ) {
        // キーワードの正規化
        this.normalizedKeywords = keywords.map(normalize);
    }

    /** テキストに含まれるキーワードを、元の表記のまま返す */
    match(text: string): string[] {
        const normalizedText = normalize(text); // テキストの正規化
        const hits: string[] = [];
        this.keywords.forEach((keyword, i) => {
            if (normalizedText.includes(this.normalizedKeywords[i])) {
                hits.push(keyword);
            }
        });
        return hits;
    }

    /** ファイル全体で見つかったキーワードの集合が、条件を満たすか */
    satisfiedBy(found: Set<string>): boolean {
        if (this.mode === 'any') {
            return this.keywords.some(keyword => found.has(keyword));
        } else {
            return this.keywords.every(keyword => found.has(keyword));
        }
    }
}
