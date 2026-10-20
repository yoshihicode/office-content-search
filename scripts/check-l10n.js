// 英語の一覧（bundle.l10n.json）と日本語訳（bundle.l10n.ja.json）を比べ、
// 訳が足りない文と、使われなくなった訳を表示する
const en = require('../l10n/bundle.l10n.json');
const ja = require('../l10n/bundle.l10n.ja.json');

const missing = Object.keys(en).filter((k) => !(k in ja));
const unused = Object.keys(ja).filter((k) => !(k in en));

if (missing.length) console.log('訳が足りない文:\n' + missing.map((k) => `  ${JSON.stringify(k)}`).join('\n'));
if (unused.length) console.log('使われなくなった訳:\n' + unused.map((k) => `  ${JSON.stringify(k)}`).join('\n'));
if (!missing.length && !unused.length) console.log(`OK（${Object.keys(en).length} 件すべて訳があります）`);

process.exitCode = missing.length ? 1 : 0; // 訳が足りなければ失敗にする