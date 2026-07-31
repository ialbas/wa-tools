// Rasteriza assets/icon.svg → public/icon/{size}.png (ícones da extensão).
// Fonte da verdade é o SVG; rode `pnpm gen:icons` após editá-lo.
import sharp from 'sharp';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';

const SIZES = [16, 32, 48, 128, 256];
mkdirSync('public/icon', { recursive: true });
const svg = readFileSync('assets/icon.svg');

for (const s of SIZES) {
  await sharp(svg, { density: 384 }).resize(s, s).png().toFile(`public/icon/${s}.png`);
}
console.log('ícones gerados:', readdirSync('public/icon').join(', '));
