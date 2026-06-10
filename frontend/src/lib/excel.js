// Excel read/write in the browser (replaces openpyxl on the backend)
import * as XLSX from "xlsx";

export async function readRows(file) {
  let wb;
  try {
    const buf = await file.arrayBuffer();
    wb = XLSX.read(buf, { type: "array" });
  } catch (e) {
    const err = new Error("invalid file");
    err.invalidFile = true;
    throw err;
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
}

export function rowsToBlob(rows, sheetName = "Sheet1") {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
