// Generates the favicon and app icons from the brand marks
// (packages/ui/src/brand/marks.ts) into apps/web/public. Run after changing
// the marks: `pnpm icons:generate`. The outputs are committed.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

import { ICON, ICON_COLORS } from "../packages/ui/src/brand/marks.ts";

const out = fileURLToPath(new URL("../apps/web/public/", import.meta.url));

/**
 * @param {{ radius: number, scale: number }} o radius 0 = full bleed (the OS
 *   masks it); scale shrinks the k around its center to stay in the safe zone.
 */
function iconSvg({ radius, scale }) {
  const [cx, cy] = ICON.kCenter;
  const transform =
    scale === 1
      ? ""
      : ` transform="translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ICON.viewBox}">
  <rect width="${ICON.size}" height="${ICON.size}" rx="${radius}" fill="${ICON_COLORS.fill}"/>
  <path d="${ICON.k}"${transform} fill="none" stroke="${ICON_COLORS.ink}" stroke-width="${ICON.strokeWidth}" stroke-linecap="square" stroke-linejoin="miter"/>
</svg>
`;
}

const rounded = iconSvg({ radius: ICON.radius, scale: 1 });
const png = (svg, size) =>
  sharp(Buffer.from(svg), { density: (72 * size) / ICON.size })
    .resize(size, size)
    .png()
    .toBuffer();

/** ICO container holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4); // color planes
    header.writeUInt16LE(32, e + 6); // bits per pixel
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const files = {
  "favicon.svg": Buffer.from(rounded),
  "favicon.ico": ico(
    await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) }))),
  ),
  // iOS applies its own mask and ignores transparency: full bleed, slightly smaller k.
  "apple-touch-icon.png": await png(iconSvg({ radius: 0, scale: 0.8 }), 180),
  // PWA manifest icons (manifest itself: Phase 16).
  "icon-192.png": await png(rounded, 192),
  "icon-512.png": await png(rounded, 512),
  // Maskable: full bleed with the k inside the central 40% safe zone.
  "icon-maskable-512.png": await png(iconSvg({ radius: 0, scale: 0.62 }), 512),
};

for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(out, name), data);
  console.log(`${name.padEnd(24)} ${String(data.length).padStart(6)} bytes`);
}
