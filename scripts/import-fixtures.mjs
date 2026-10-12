import ExcelJS from "exceljs";
import { mkdir } from "node:fs/promises";
const directory = ".fixtures/imports";
await mkdir(directory, { recursive: true });
const sample = new ExcelJS.Workbook();
sample.addWorksheet("Negozi").addRows([
  ["Codice negozio", "Ragione sociale", "Città", "Paese", "Email"],
  ["N001", "Negozio sintetico Uno", "Milano", "IT", "uno@example.test"],
  ["N002", "Negozio sintetico Due", "Roma", "IT", "email-invalida"],
]);
sample.addWorksheet("Ordini").addRows([
  [
    "Riferimento ordine",
    "Negozio",
    "Brand",
    "Stagione",
    "Data ordine",
    "SKU",
    "Quantità",
    "Prezzo unitario",
    "Sconto",
  ],
  [
    "O001",
    "N001",
    "Brand sintetico",
    "SS27",
    "15/01/2027",
    "SYN-M-NERO",
    2,
    "1.234,56 €",
    "10%",
  ],
  [
    "O002",
    "N002",
    "Brand sintetico",
    "SS27",
    "31/02/2027",
    "SYN-M-NERO",
    -1,
    "testo",
    0,
  ],
]);
sample.addWorksheet("Budget").addRows([
  [
    "Brand",
    "Stagione",
    "Negozio",
    "Importo budget",
    "Inizio periodo",
    "Fine periodo",
  ],
  ["Brand sintetico", "FW27", "N001", "5.000,00", "01/07/2027", "31/12/2027"],
]);
await sample.xlsx.writeFile(`${directory}/synthetic-import.xlsx`);
const large = new ExcelJS.Workbook(),
  sheet = large.addWorksheet("20k");
for (let i = 0; i < 20000; i++)
  sheet.addRow([
    `N${i}`,
    `Negozio sintetico ${i}`,
    "Brand sintetico",
    "SS27",
    1000 + i,
    "Milano",
    "IT",
    "EUROPE",
  ]);
await large.xlsx.writeFile(`${directory}/synthetic-20000.xlsx`);
const performance = new ExcelJS.Workbook(),
  recap = performance.addWorksheet("RECAP BUDGET ");
recap.addRow(["MDC SHOWROOM - PERFORMANCE"]);
recap.addRow([
  "BRAND",
  "Commerciale",
  "AREA",
  "STATO",
  "REGIONE",
  "CITTA",
  "CLIENTI",
  "APP",
  "STATUS",
  "SELLOUT",
  "SS24",
  "FW24.25",
  "SS25",
  "FW25",
  "SELLOUT FW25",
  "FORECAST SS26",
  "ORDINE SS26",
  "Δ%",
  "BDG FW26",
  "FORECAST W26 AL 6/03",
  "ORDINE FW26",
  "Δ%",
  "BDG SS27",
  "FORECAST SS27",
  "ORDINE SS27",
  "Δ%",
  "Note ",
]);
for (const [brand, area, q, s, u, w, y] of [
  ["Brand sintetico A", "EUROPE", 100.25, 200, 150.5, 300, 250.75],
  ["Brand sintetico B", "ASIA ", 20, 30, 40, 50, 60],
  ["Brand escluso", "EUROPE", 999, 900, 800, 700, 600],
]) {
  const row = recap.addRow([
    brand,
    "Agente sintetico",
    area,
    "ITALY",
    "LOMBARDIA",
    "Milano",
    "Negozio sintetico",
    null,
    "ATTIVO",
  ]);
  for (const [col, value] of [
    [17, q],
    [19, s],
    [21, u],
    [23, w],
    [25, y],
  ])
    row.getCell(col).value = value;
  row.getCell(26).value = { formula: "Y3/W3-1", result: y / w - 1 };
}
performance
  .addWorksheet("Analisi Pivot")
  .addRows([
    [],
    [],
    ["AREA", "(Tutto)"],
    [],
    [
      "Etichette di riga",
      "Somma di ORDINE SS26",
      "Somma di BDG FW26",
      "Somma di ORDINE FW26",
      "Somma di BDG SS27",
      "Somma di ORDINE SS27",
    ],
    ["Brand sintetico A", 100.25, 200, 150.5, 300, 250.75],
    ["Brand sintetico B", 20, 30, 40, 50, 60],
    ["Totale complessivo", 120.25, 230, 190.5, 350, 310.75],
  ]);
await performance.xlsx.writeFile(`${directory}/synthetic-performance.xlsx`);
console.log("Tre fixture sintetiche generate, nessun dato reale.");
