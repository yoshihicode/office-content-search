# Office Content Search

[日本語](README.ja.md)

Search text inside Word, Excel and PowerPoint files in a folder — and see exactly **where** it appears.

![Searching Office files and viewing the results](images/screenshot.gif)

## Features

- **Pinpoint locations** — Results show where each match is: `Sheet1 › B12`, `Body ¶24`, `First Page Header`, `Slide 3 › Notes`, `Chart "Sales" › Series Name`.
- **No Microsoft Office required** — Files are read directly, so searching is fast and works without Office installed.
- **Multiple keywords** — Separate keywords with spaces, use `"double quotes"` for phrases, and choose **Match any (OR)** or **Match all (AND)**.
- **Forgiving matching** — Case-insensitive and full-width/half-width-insensitive (`ＡＢＣ` matches `abc`).
- **Dates as displayed** — Excel date cells can be found by the text shown in Excel, such as `10/21/2026` or `2026年10月21日`.
- **Search form in the sidebar** — Enter keywords, choose a folder, and include subfolders in one place. You can cancel a running search.
- **Highlighted results** — Matches are highlighted in the results tree. Click a result to open the file in its default application.
- **Copy file names and paths** — From the context menu, or with `Ctrl+C` / `Ctrl+Alt+C` (`Cmd` on macOS) in the results view.
- **Results as text** — Open the list of results in an editor tab to read, save or share.
- **Local only** — All processing happens on your machine. Nothing is sent anywhere.
- **English and Japanese UI**

## What Is Searched

| Format | Searched content |
| --- | --- |
| Word (`.docx`) | Body paragraphs and tables, text boxes, headers and footers, footnotes, endnotes, comments, charts, SmartArt |
| Excel (`.xlsx`) | Cell values, shapes and text boxes, charts (titles, axis titles, series names), chart sheets, SmartArt |
| Excel 97-2003 (`.xls`) | Cell values (text in shapes and charts is not searched) |
| PowerPoint (`.pptx`) | Slide text and tables, speaker notes, charts, SmartArt |

Excel cells are matched as follows (the same for `.xlsx` and `.xls`):

- **Dates** are matched by the text displayed in Excel, e.g. `10/21/2026`, `2026年10月21日`, `10/21/2026 9:30`.
- **Other numbers** are matched by their values, regardless of the number format (`1234`, even if displayed as `1,234`).

## Usage

1. Click the **Office Search** icon in the Activity Bar.
2. Enter keywords.
3. Choose **Match any (OR)** or **Match all (AND)**. AND means the *file* contains every keyword (not necessarily in the same cell or paragraph).
4. Enter a folder or click **Browse...**, and select **Include subfolders** if needed.
5. Optionally select **Also open the results as text**.
6. Click **Search**.

You can also right-click a folder in the Explorer and select **Search Office Files in This Folder**.

Files that could not be searched are listed under **Skipped** with the reason.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `officeSearch.includeSubfolders` | `true` | Include subfolders by default |
| `officeSearch.excludeFolders` | `[".git", "node_modules"]` | Folder names to skip when searching subfolders |
| `officeSearch.maxFileSizeMB` | `50` | Files larger than this (MB) are skipped |
| `officeSearch.maxHitsPerFile` | `200` | Maximum hits listed per file |
| `officeSearch.excelShortDateFormat` | `""` | Format used to match Excel dates entered without a specific format, e.g. `yyyy/m/d`. If empty, it is chosen by the VS Code display language |

You can change these settings by searching for `Office Content Search` in the VS Code Settings (`Ctrl+,`).

### If dates are not found

Dates entered in Excel without a specific format (the "Short Date" format) are displayed according to the **regional settings of the PC running Excel**. Because the display format is not stored in the file, this extension chooses the format as follows:

- The format set in `officeSearch.excelShortDateFormat`, if any
- Otherwise, `yyyy/m/d` if the VS Code display language is Japanese, and `m/d/yyyy` for other languages

For example, if you use VS Code in English but Excel shows dates as `2026/10/21`, dates are matched as `10/21/2026` and `2026/10/21` is not found. In that case, set the format to match your Excel:

```json
"officeSearch.excelShortDateFormat": "yyyy/m/d"
```

## Limitations

- Legacy Word and PowerPoint formats (`.doc`, `.ppt`) are not supported and are listed as skipped.
- In `.xls` files, only cell values are searched. Text in shapes and charts is not searched.
- Password-protected or encrypted files (including files protected by sensitivity labels) are skipped.
- Only saved content is searched. Save your changes in Office before searching.
- Dates displayed in the Japanese era calendar (e.g. 令和) are matched in the Western calendar (e.g. `令和8年10月21日` is matched as `2026年10月21日`).
- Excel formulas themselves are not searched (only their results).
- Word text is matched per paragraph. A phrase that spans two paragraphs is not found.
- Text deleted with Track Changes is not searched.
- In remote environments (WSL, SSH, Dev Containers), opening a result may not work depending on your environment.

## Requirements

VS Code 1.85 or later.

## Contributing

Bug reports and feature requests are welcome on [GitHub Issues](https://github.com/yoshihicode/office-content-search/issues).

If a file is needed to reproduce a problem, please attach a sample file with fictional content instead of a real business document.

## License

[MIT](LICENSE)

For the licenses of the libraries used by this extension, see [ThirdPartyNotices.txt](ThirdPartyNotices.txt).

---

This extension is not affiliated with or endorsed by Microsoft. Microsoft, Word, Excel and PowerPoint are trademarks of the Microsoft group of companies.
