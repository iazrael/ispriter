import { describe, it, expect, beforeAll } from 'vitest';
import { Spriter } from '../../packages/core/dist/index.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURES_CSS = path.join(ROOT, 'tests/fixtures/css');
const FIXTURES_IMAGES = path.join(ROOT, 'tests/fixtures/images');

async function loadFixtureImages(): Promise<Map<string, Buffer>> {
  const images = new Map<string, Buffer>();
  const files = await readdir(FIXTURES_IMAGES);
  for (const file of files) {
    const buf = await readFile(path.join(FIXTURES_IMAGES, file));
    images.set(`../images/${file}`, buf);
  }
  return images;
}

async function loadCssFiles(...filenames: string[]): Promise<Map<string, string>> {
  const css = new Map<string, string>();
  for (const f of filenames) {
    const content = await readFile(path.join(FIXTURES_CSS, f), 'utf-8');
    css.set(f, content);
  }
  return css;
}

/** Mimics the example configs but with absolute workspace so it works from any CWD */
function exampleConfig(overrides: {
  cssSource: string[];
  cssDist: string;
  imageDist?: string;
  margin?: number;
  combine?: boolean;
  maxSingleSize?: number;
  ignoreImages?: string[];
  format?: 'png' | 'webp';
}) {
  return {
    workspace: ROOT,
    input: {
      cssSource: overrides.cssSource.map((f) => path.join('tests/fixtures/css', f)),
      ignoreImages: overrides.ignoreImages,
    },
    output: {
      cssDist: overrides.cssDist,
      imageDist: overrides.imageDist || '../img/',
      margin: overrides.margin ?? 2,
      combine: overrides.combine ?? false,
      maxSingleSize: overrides.maxSingleSize,
      format: overrides.format || 'png',
    },
  };
}

describe('E2E: examples', () => {
  let images: Map<string, Buffer>;

  beforeAll(async () => {
    images = await loadFixtureImages();
    expect(images.size).toBeGreaterThan(0);
  });

  it('animation — @keyframes + hover states', async () => {
    const css = await loadCssFiles('style2.css');
    const config = exampleConfig({
      cssSource: ['style2.css'],
      cssDist: 'examples/animation/dist/css/',
      margin: 3,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    expect(result.spriteImages.size).toBeGreaterThan(0);
    expect(result.cssFiles.size).toBeGreaterThan(0);

    for (const [, buf] of result.spriteImages) {
      const meta = await sharp(buf).metadata();
      expect(meta.width).toBeGreaterThan(0);
      expect(meta.height).toBeGreaterThan(0);
    }
  });

  it('import-css — @import expansion', async () => {
    // main.css imports style.css, style2.css, style3.css
    const css = await loadCssFiles('main.css');
    const config = exampleConfig({
      cssSource: ['main.css'],
      cssDist: 'examples/import-css/dist/css/',
      margin: 5,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    // main.css itself has no direct background images, but imported CSS files do
    expect(result.cssFiles.size).toBeGreaterThan(0);
  });

  it('include-gif — ignore gif images', async () => {
    const css = await loadCssFiles('style.css');
    const config = exampleConfig({
      cssSource: ['style.css'],
      cssDist: 'examples/include-gif/dist/css/',
      margin: 5,
      ignoreImages: ['*.gif'],
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    expect(result.spriteImages.size).toBeGreaterThan(0);
  });

  it('limit-image-size — split by maxSingleSize', async () => {
    const css = await loadCssFiles('style.css');
    const config = exampleConfig({
      cssSource: ['style.css'],
      cssDist: 'examples/limit-image-size/dist/css/',
      margin: 5,
      maxSingleSize: 20,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    // With maxSingleSize=20KB, large sprites should split
    expect(result.spriteImages.size).toBeGreaterThan(0);
    expect(result.cssFiles.size).toBeGreaterThan(0);
  });

  it('multi-combine — multiple CSS files combined', async () => {
    const css = await loadCssFiles('style.css', 'style3.css');
    const config = exampleConfig({
      cssSource: ['style.css', 'style3.css'],
      cssDist: 'examples/multi-combine/dist/css/',
      margin: 5,
      combine: true,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    expect(result.spriteImages.size).toBeGreaterThan(0);
    expect(result.cssFiles.size).toBeGreaterThanOrEqual(1);
  });

  it('multi — glob pattern matching multiple CSS', async () => {
    const css = await loadCssFiles('style.css', 'style2.css', 'style3.css');
    const config = exampleConfig({
      cssSource: ['style.css', 'style2.css', 'style3.css'],
      cssDist: 'examples/multi/dist/css/',
      margin: 5,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    expect(result.spriteImages.size).toBeGreaterThan(0);
    expect(result.cssFiles.size).toBeGreaterThan(0);
  });

  it('single — basic sprite with noimg CSS', async () => {
    const css = await loadCssFiles('style.css', 'style_noimg.css');
    const config = exampleConfig({
      cssSource: ['style.css', 'style_noimg.css'],
      cssDist: 'examples/single/dist/css/',
      margin: 5,
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: path.join(ROOT, 'tests/fixtures/css') });

    expect(result.spriteImages.size).toBeGreaterThan(0);
    expect(result.cssFiles.size).toBe(2);

    // Skipped images: http://www.qq.com/... and non-existent
    expect(result.skippedImages.length).toBeGreaterThan(0);
  });

  it('dry-run — preview without writing files', async () => {
    const css = await loadCssFiles('style.css');
    const config = exampleConfig({
      cssSource: ['style.css'],
      cssDist: 'examples/single/dist/css/',
    });
    const spriter = new Spriter(config);
    const result = await spriter.run({
      css,
      images,
      cssBaseDir: path.join(ROOT, 'tests/fixtures/css'),
      dryRun: true,
    });

    expect(result.spriteImages.size).toBe(0);
    expect(result.cssFiles.size).toBe(0);
    expect(result.dryRunReport).toBeTruthy();
    expect(result.dryRunReport!).toContain('Dry-run report');
    expect(result.dryRunReport!).toContain('Sprite sheets');
    expect(result.manifest.size).toBeGreaterThan(0);
  });
});
