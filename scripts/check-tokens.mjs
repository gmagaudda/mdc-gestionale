import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const patterns = [
  /#[\da-f]{3,8}\b/i,
  /\b(?:rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/,
  /\b(?:bg|text|border|ring|outline|fill|stroke|shadow)-(?:black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d+)?\b/,
  /\bfont-(?:bold|semibold|extrabold|black)\b/,
];
let failures = 0;
async function scan(dir) {
  for (const item of await readdir(dir, { withFileTypes: true }).catch(
    () => [],
  )) {
    const file = path.join(dir, item.name);
    if (file.startsWith("components/arc") || item.name.includes(".test."))
      continue;
    if (item.isDirectory()) {
      await scan(file);
      continue;
    }
    if (!/\.(?:tsx?|jsx?|css)$/.test(file)) continue;
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (patterns.some((pattern) => pattern.test(line))) {
        console.error(`${file}:${index + 1}: use Arc semantic tokens`);
        failures++;
      }
    });
  }
}
for (const root of ["app", "components", "modules"]) await scan(root);
if (failures) process.exitCode = 1;
else console.log("Arc token checks passed");
