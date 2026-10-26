# Change Log

All notable changes to this extension are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-26
- Search macro-enabled files (`.xlsm`, `.docm`, `.pptm`). Macros are never run.
- Filter by application (Excel, Word, PowerPoint) in the search form.

## [0.3.0] - 2026-10-25

### Added

- Filter by file type in the search form.

## [0.2.0] - 2026-10-22

### Added

- Search cell values in Excel 97-2003 workbooks (`.xls`). Shapes and charts in `.xls` files are not searched.
- Dates in Excel cells (`.xlsx` and `.xls`) are now matched as displayed, e.g. `2026/10/15` or `2026年10月15日`.
  - Dates entered without a specific format follow the VS Code display language (`2026/10/15` in Japanese, `10/15/2026` in English).
  - Japanese era formats (e.g. 令和) are matched in the Western calendar.
- Third-party license notices (`ThirdPartyNotices.txt`).

### Changed

- `.xls` files are no longer listed as skipped. Only `.doc` and `.ppt` are skipped as legacy formats.

## [0.1.0] - 2026-10-21

### Added

- Initial release.
- Search text inside Word (`.docx`), Excel (`.xlsx`) and PowerPoint (`.pptx`) files, with locations such as sheet and cell, paragraph, slide and notes.
- Multiple keywords with AND / OR, and phrases in double quotes.
- Search form in the sidebar, with an option to include subfolders.
- Copy file names and paths from the results.
- Open the results as text.
- Settings: `includeSubfolders`, `excludeFolders`, `maxFileSizeMB`, `maxHitsPerFile`.
- English and Japanese UI.


[0.4.0]: https://github.com/yoshihicode/office-content-search/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yoshihicode/office-content-search/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yoshihicode/office-content-search/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yoshihicode/office-content-search/releases/tag/v0.1.0