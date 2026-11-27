/**
 * Generates the restrained animated README banners used by the root project
 * README and the Practical 4 lab-work README. Uses the already-installed sharp
 * dev dependency; no network access or external artwork is involved.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const FRAMES = 24;
const DELAY_MS = 100;

const flow =
  'M610 156 C 700 156 720 96 810 126 S 930 196 1010 132 S 1100 104 1160 140';

function projectFrame(frame) {
  const t = frame / FRAMES;
  const offset = Math.round(t * 900);
  const pulse = 0.55 + ((Math.sin(t * Math.PI * 2) + 1) / 2) * 0.35;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="280" viewBox="0 0 1200 280">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0D1117" />
        <stop offset="1" stop-color="#161B22" />
      </linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#C8102E" stop-opacity="0" />
        <stop offset="0.5" stop-color="#DF1B3B" />
        <stop offset="1" stop-color="#F5A9B8" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect width="1200" height="280" fill="url(#bg)" />
    <line x1="0" y1="279" x2="1200" y2="279" stroke="#30363D" />
    <text x="64" y="104" fill="#F0F6FC" font-family="Georgia,'Times New Roman',serif" font-size="46">LifeLink</text>
    <rect x="66" y="128" width="164" height="2" fill="#C8102E" />
    <text x="66" y="164" fill="#8B949E" font-family="Arial,Helvetica,sans-serif" font-size="16">Blood bank coordination platform</text>
    <text x="66" y="192" fill="#6E7681" font-family="monospace" font-size="13" letter-spacing="1">JAVA 21  ·  SPRING BOOT  ·  REACT / TYPESCRIPT</text>
    <path d="${flow}" fill="none" stroke="#30363D" stroke-width="2" stroke-linecap="round" />
    <path d="${flow}" fill="none" stroke="url(#accent)" stroke-width="3" stroke-linecap="round" stroke-dasharray="90 900" stroke-dashoffset="${-offset}" />
    <circle cx="610" cy="156" r="4" fill="#8B949E" />
    <circle cx="1160" cy="140" r="4" fill="#8B949E" />
    <circle cx="1160" cy="140" r="10" fill="none" stroke="#DF1B3B" stroke-width="1.5" opacity="${pulse.toFixed(2)}" />
  </svg>`;
}

function labFrame(frame) {
  const t = frame / FRAMES;
  const offset = Math.round(t * 480);
  const pulse = 0.45 + ((Math.sin(t * Math.PI * 2) + 1) / 2) * 0.3;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="280" viewBox="0 0 1200 280">
    <defs>
      <linearGradient id="labbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0D1117" />
        <stop offset="1" stop-color="#111827" />
      </linearGradient>
      <linearGradient id="labaccent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0F766E" stop-opacity="0" />
        <stop offset="0.5" stop-color="#5EEAD4" />
        <stop offset="1" stop-color="#5EEAD4" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect width="1200" height="280" fill="url(#labbg)" />
    <line x1="0" y1="279" x2="1200" y2="279" stroke="#30363D" />
    <text x="64" y="104" fill="#F0F6FC" font-family="Georgia,'Times New Roman',serif" font-size="46">Practical 4</text>
    <text x="66" y="140" fill="#8B949E" font-family="Arial,Helvetica,sans-serif" font-size="16">Design by Contract  ·  LSP  ·  SOLID</text>
    <rect x="64" y="166" width="208" height="34" rx="17" fill="#0F241F" stroke="#0F766E" stroke-opacity="${pulse.toFixed(2)}" />
    <text x="82" y="188" fill="#5EEAD4" font-family="monospace" font-size="14">26 / 26 checks passed</text>
    <rect x="590" y="52" width="546" height="176" rx="8" fill="#0B1220" stroke="#30363D" />
    <rect x="590" y="52" width="546" height="30" rx="8" fill="#151B23" />
    <text x="610" y="72" fill="#8B949E" font-family="monospace" font-size="12">terminal — Practical4Demo</text>
    <g font-family="monospace" font-size="14" fill="#C9D1D9">
      <text x="610" y="112"><tspan fill="#5EEAD4">$</tspan> javac -encoding UTF-8 -d out src\\Practical4Demo.java</text>
      <text x="610" y="140"><tspan fill="#5EEAD4">$</tspan> java -cp out Practical4Demo</text>
      <text x="610" y="168" fill="#8B949E">5 case studies  ·  0 failures</text>
    </g>
    <line x1="610" y1="196" x2="1118" y2="196" stroke="#30363D" stroke-width="2" />
    <line x1="610" y1="196" x2="1118" y2="196" stroke="url(#labaccent)" stroke-width="2" stroke-dasharray="80 480" stroke-dashoffset="${-offset}" />
  </svg>`;
}

async function writeAnimatedAsset(name, frameFn, outDir) {
  await mkdir(outDir, { recursive: true });
  const frames = [];
  for (let i = 0; i < FRAMES; i += 1) {
    frames.push(await sharp(Buffer.from(frameFn(i))).png().toBuffer());
  }
  await sharp(frames[0]).png().toFile(path.join(outDir, `${name}-poster.png`));
  await sharp(frames, { join: { animated: true } })
    .gif({ loop: 0, delay: DELAY_MS, colours: 48, effort: 8 })
    .toFile(path.join(outDir, `${name}.gif`));
  console.log(`[readme-assets] wrote ${name}.gif and ${name}-poster.png`);
}

await writeAnimatedAsset(
  'lifelink-readme-banner',
  projectFrame,
  path.join(repoRoot, 'project/docs/assets'),
);

await writeAnimatedAsset(
  'practical4-readme-banner',
  labFrame,
  path.join(repoRoot, 'LAB-WORK/PRACTICAL-4/assets'),
);
