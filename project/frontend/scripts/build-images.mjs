#!/usr/bin/env node
/**
 * Offline, deterministic image pipeline for LifeLink.
 *
 * Reads original SVG artwork from public/images/source/, rasterizes it with
 * sharp, and writes responsive AVIF/WebP/JPEG variants, blur placeholders,
 * favicons, social preview images and a web app manifest. No network access,
 * no third-party assets, no dependencies beyond the existing sharp devDependency.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, '..', 'public');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'images');
const SOURCE_DIR = path.join(IMAGES_DIR, 'source');
const MANIFEST_MODULE_DIR = path.resolve(HERE, '..', 'src', 'data');

const WIDTHS = [480, 960, 1440, 2400];
const FORMATS = ['avif', 'webp', 'jpeg'];
const FAVICON_SIZES = [16, 32, 48, 180, 192, 512];
const BLUR_WIDTH = 24;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

const ILLUSTRATIONS = [
  { name: 'vessel', file: 'vessel.svg' },
  { name: 'compatibility-orbs', file: 'compatibility-orbs.svg' },
  { name: 'privacy-rings', file: 'privacy-rings.svg' },
  { name: 'emergency-handoff', file: 'emergency-handoff.svg' },
  { name: 'social-og', file: 'social-og.svg' },
];

const FAVICON_SOURCE = 'favicon-drop.svg';

function dimensionsFromSvg(svg, file) {
  const source = Buffer.isBuffer(svg) ? svg.toString('utf8') : svg;
  const match = source.match(
    /<svg\b[^>]*\bviewBox\s*=\s*["']\s*-?[\d.]+\s+-?[\d.]+\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*["']/,
  );
  if (!match) {
    throw new Error(`${file}: missing or invalid viewBox; expected "0 0 W H".`);
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`${file}: viewBox width and height must be positive numbers.`);
  }
  return { width, height };
}

/** Render vector art at the target pixel density, then snap to exact dimensions. */
function render(svg, sourceWidth, targetWidth, targetHeight) {
  const density = Math.max(1, Math.round((72 * targetWidth) / sourceWidth));
  return sharp(svg, { density }).resize({
    width: targetWidth,
    height: targetHeight,
    fit: 'fill',
  });
}

function withFormat(pipeline, format) {
  if (format === 'avif') return pipeline.avif({ quality: 52, effort: 5 });
  if (format === 'webp') return pipeline.webp({ quality: 78 });
  if (format === 'jpeg') return pipeline.jpeg({ quality: 84, mozjpeg: true });
  throw new Error(`Unsupported image format: ${format}`);
}

async function buildIllustrations() {
  const manifest = {};
  let fileCount = 0;

  for (const { name, file } of ILLUSTRATIONS) {
    const svg = await readFile(path.join(SOURCE_DIR, file));
    const { width: sourceWidth, height: sourceHeight } = dimensionsFromSvg(svg, file);
    const paths = {};

    for (const width of WIDTHS) {
      const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
      const base = render(svg, sourceWidth, width, height);
      const variants = {};
      for (const format of FORMATS) {
        const outputName = `${name}-${width}.${format === 'jpeg' ? 'jpg' : format}`;
        const outputPath = path.join(IMAGES_DIR, outputName);
        await withFormat(base.clone(), format).toFile(outputPath);
        variants[format] = `/images/${outputName}`;
        fileCount += 1;
      }
      paths[String(width)] = variants;
    }

    // A 24px WebP is intentionally tiny: CSS/blur-up scaling supplies the blur.
    const blurHeight = Math.max(1, Math.round((BLUR_WIDTH * sourceHeight) / sourceWidth));
    const blurBuffer = await render(svg, sourceWidth, BLUR_WIDTH, blurHeight)
      .blur(0.4)
      .webp({ quality: 40 })
      .toBuffer();

    manifest[name] = {
      width: sourceWidth,
      height: sourceHeight,
      paths,
      blurDataURL: `data:image/webp;base64,${blurBuffer.toString('base64')}`,
    };
  }

  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(IMAGES_DIR, 'manifest.json'), manifestText, 'utf8');
  await writeFile(path.join(MANIFEST_MODULE_DIR, 'imageManifest.json'), manifestText, 'utf8');
  return fileCount;
}

async function buildFavicons() {
  const svg = await readFile(path.join(SOURCE_DIR, FAVICON_SOURCE));
  const { width: sourceWidth } = dimensionsFromSvg(svg, FAVICON_SOURCE);
  for (const size of FAVICON_SIZES) {
    await render(svg, sourceWidth, size, size)
      .png({ compressionLevel: 9 })
      .toFile(path.join(PUBLIC_DIR, `favicon-${size}.png`));
  }
  return FAVICON_SIZES.length;
}

async function buildSocialImages() {
  const ogSvg = await readFile(path.join(SOURCE_DIR, 'social-og.svg'));
  const base = render(ogSvg, OG_WIDTH, OG_WIDTH, OG_HEIGHT);
  await base.clone().png({ compressionLevel: 9 }).toFile(path.join(PUBLIC_DIR, 'og-image.png'));
  await base.clone().webp({ quality: 88 }).toFile(path.join(PUBLIC_DIR, 'og-image.webp'));
  return 2;
}

async function buildWebManifest() {
  const webManifest = {
    name: 'LifeLink',
    short_name: 'LifeLink',
    theme_color: '#10070c',
    background_color: '#ffffff',
    start_url: '/',
    display: 'standalone',
    icons: FAVICON_SIZES.map((size) => ({
      src: `/favicon-${size}.png`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })),
  };
  await writeFile(
    path.join(PUBLIC_DIR, 'manifest.webmanifest'),
    `${JSON.stringify(webManifest, null, 2)}\n`,
    'utf8',
  );
}

async function main() {
  await mkdir(SOURCE_DIR, { recursive: true });
  await mkdir(IMAGES_DIR, { recursive: true });
  await mkdir(MANIFEST_MODULE_DIR, { recursive: true });
  await mkdir(PUBLIC_DIR, { recursive: true });

  const imageCount = await buildIllustrations();
  const faviconCount = await buildFavicons();
  const socialCount = await buildSocialImages();
  await buildWebManifest();

  console.log(`[build-images] ${ILLUSTRATIONS.length} vector sources -> ${imageCount} images`);
  console.log('[build-images] widths: 480, 960, 1440, 2400 | formats: avif, webp, jpg');
  console.log(`[build-images] ${faviconCount} favicons, ${socialCount} social images`);
  console.log('[build-images] wrote image manifests + public/manifest.webmanifest');
  console.log('[build-images] done (offline, idempotent)');
}

try {
  await main();
} catch (error) {
  console.error('[build-images] FAILED:', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
}
