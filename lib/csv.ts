import Papa from "papaparse";
export function exportCsv(
  fields: string[],
  data: (string | number | null)[][],
) {
  return (
    "\uFEFF" +
    Papa.unparse(
      { fields, data },
      { delimiter: ";", newline: "\r\n", escapeFormulae: true },
    )
  );
}
