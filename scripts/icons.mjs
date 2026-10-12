import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
const sharp = createRequire(import.meta.resolve("next/package.json"))("sharp");
const foundation = await readFile(
  new URL("../components/arc/foundation.css", import.meta.url),
  "utf8",
);
// Metadata and raster files need concrete sRGB values. Derive them from Arc.
function neutral(pattern) {
  const match = foundation.match(pattern);
  if (!match) throw Error("Arc background token changed. Review PWA colors.");
  const linear = (Number(match[1]) / 100) ** 3;
  const channel = Math.round(
    255 *
      (linear <= 0.0031308
        ? 12.92 * linear
        : 1.055 * linear ** (1 / 2.4) - 0.055),
  );
  return `#${channel.toString(16).padStart(2, "0").repeat(3)}`;
}
const colors = {
  backgroundLight: neutral(/--neutral-0:\s*oklch\(([\d.]+)% 0 0\)/),
  backgroundDark: neutral(
    /:root\[data-theme="dark"\][\s\S]*?--background:\s*oklch\(([\d.]+)% 0 0\)/,
  ),
  foregroundLight: neutral(/--neutral-11:\s*oklch\(([\d.]+)% 0 0\)/),
};
await mkdir("public/icons", { recursive: true });
await mkdir("lib/pwa", { recursive: true });
await writeFile("lib/pwa/colors.json", JSON.stringify(colors, null, 2) + "\n");
// Deterministic geometric MDC monogram, entirely inside the maskable safe zone.
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="${colors.backgroundLight}" d="M0 0h512v512H0z"/><path fill="none" stroke="${colors.foregroundLight}" stroke-width="14" stroke-linecap="square" stroke-linejoin="round" d="M128 294v-76l32 44 32-44v76 M224 218h20c52 0 52 76 0 76h-20z M378 228c-46-34-84 8-56 54 14 19 39 16 56 2"/></svg>`,
);
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["maskable-512", 512],
  ["apple-touch-icon", 180],
])
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
const png = await sharp(svg).resize(192, 192).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = 192;
ico[7] = 192;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
await writeFile("app/favicon.ico", Buffer.concat([ico, png]));
console.log("Generated neutral MDC icons and metadata colors from Arc tokens.");
