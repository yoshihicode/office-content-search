import * as vscode from 'vscode';
import { Labels } from './core/types';
import { OfficeFileErrorReason } from './core/zip';

/**
 * 位置の表示名を、VS Code の表示言語に翻訳してコアに渡す
 * ※ 翻訳する文字列は、必ず vscode.l10n.t('...') と直接書く（抽出ツールが見つけられるように）
 */
export function localizedLabels(): Labels {
  return {
    body: vscode.l10n.t('Body'),
    textBox: vscode.l10n.t('Text Box'),
    header: vscode.l10n.t('Header'),
    footer: vscode.l10n.t('Footer'),
    firstPageHeader: vscode.l10n.t('First Page Header'),
    firstPageFooter: vscode.l10n.t('First Page Footer'),
    evenPageHeader: vscode.l10n.t('Even Page Header'),
    evenPageFooter: vscode.l10n.t('Even Page Footer'),
    section: (n) => vscode.l10n.t('Section {0}', n),
    footnote: vscode.l10n.t('Footnote'),
    endnote: vscode.l10n.t('Endnote'),
    comment: vscode.l10n.t('Comment'),
    chart: vscode.l10n.t('Chart'),
    smartArt: vscode.l10n.t('SmartArt'),
    seriesName: vscode.l10n.t('Series Name'),
    slide: (n) => vscode.l10n.t('Slide {0}', n),
    notes: vscode.l10n.t('Notes'),
  };
}

/** スキップした理由を、利用者向けの文に翻訳する */
export function skipReasonText(reason: OfficeFileErrorReason | 'folder' | 'unknown'): string {
  switch (reason) {
    case 'legacy':
      return vscode.l10n.t('Legacy format (.doc/.ppt) is not supported');
    case 'tooLarge':
      return vscode.l10n.t('File is larger than the size limit (officeSearch.maxFileSizeMB)');
    case 'encrypted':
      return vscode.l10n.t('Password-protected file');
    case 'notOfficeFile':
      return vscode.l10n.t('Not an Office file, or the file is corrupt');
    case 'folder':
      return vscode.l10n.t('Could not open the folder');
    case 'unknown':
      return vscode.l10n.t('Could not read the file');
  }
}
