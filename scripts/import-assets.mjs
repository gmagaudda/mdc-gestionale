import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
mkdirSync("public/vendor", { recursive: true });
copyFileSync(
  require.resolve("exceljs/dist/exceljs.min.js"),
  "public/vendor/exceljs-4.4.0.min.js",
);
copyFileSync(
  require.resolve("papaparse/papaparse.min.js"),
  "public/vendor/papaparse-5.7.0.min.js",
);
console.log("Asset del parser importazione disponibili localmente.");
