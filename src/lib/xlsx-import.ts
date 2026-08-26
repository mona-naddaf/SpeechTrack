/** {rowNumber, reason} for a spreadsheet row that couldn't be imported —
 *  shared shape so every "X added, N skipped" summary looks the same
 *  regardless of what's being imported. */
export type ImportSkip = { rowNumber: number; reason: string };

/** `xlsx` is a large library and only a handful of toolkit pages ever use
 *  it — loaded on demand so it doesn't add to every other page's bundle. */
async function loadXlsx() {
  return import("xlsx");
}

/** Triggers a browser download of a small .xlsx workbook — one sheet, a
 *  header row plus whatever example rows are given. Every "Download
 *  template" button uses this, so the file it produces always lines up
 *  with what the matching upload parser (below) expects. */
export async function downloadXlsxTemplate(
  filename: string,
  headers: string[],
  exampleRows: (string | number)[][]
): Promise<void> {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...exampleRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** One parsed spreadsheet row. `get` looks up a cell by header name,
 *  case/whitespace-insensitively, trying each alias in turn — so callers
 *  can accept "Area" or "Subject" for the same column, or "Target %" typed
 *  as "target%" — without caring which one a given sheet used. */
export type XlsxRow = {
  /** Spreadsheet row number as a person would see it in Excel (accounts
   *  for the header row), for messages like "Row 4: missing goal text". */
  rowNumber: number;
  get: (...headerAliases: string[]) => string;
};

/** Reads the first sheet of an uploaded spreadsheet into rows. Cells are
 *  stringified and trimmed; a header this parser doesn't ask for is simply
 *  never looked up, so extra columns are harmless. */
export async function parseXlsxFile(file: File): Promise<XlsxRow[]> {
  const XLSX = await loadXlsx();
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "" }
  );

  return raw.map((row, i) => {
    const normalized = new Map<string, string>();
    for (const [key, value] of Object.entries(row)) {
      normalized.set(key.trim().toLowerCase(), String(value ?? "").trim());
    }
    return {
      // sheet_to_json rows are 0-indexed and already exclude the header
      // row, so the 1st data row (i=0) is spreadsheet row 2.
      rowNumber: i + 2,
      get: (...headerAliases: string[]) => {
        for (const alias of headerAliases) {
          const value = normalized.get(alias.trim().toLowerCase());
          if (value !== undefined) return value;
        }
        return "";
      },
    };
  });
}
