import { describe, it, expect, beforeAll } from 'vitest';
import { Spriter } from '../../packages/core/dist/index.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TEST_CSS_DIR = path.join(ROOT, 'tests/fixtures/css');
const TEST_IMAGES_DIR = path.join(ROOT, 'tests/fixtures/images');

/** Read all images from test/images into a Map<relativeUrl, Buffer> */
async function loadTestImages(): Promise<Map<string, Buffer>> {
  const images = new Map<string, Buffer>();
  const files = await readdir(TEST_IMAGES_DIR);
  for (const file of files) {
    const buf = await readFile(path.join(TEST_IMAGES_DIR, file));
    // Key matches CSS url(../images/xxx.png) → we use relative path from css dir
    images.set(`../images/${file}`, buf);
  }
  return images;
}

/** Read a single CSS file into Map<filename, content> */
async function loadCssFile(filename: string): Promise<Map<string, string>> {
  const content = await readFile(path.join(TEST_CSS_DIR, filename), 'utf-8');
  return new Map([[filename, content]]);
}

describe('E2E: original project fixtures', () => {
  let images: Map<string, Buffer>;

  beforeAll(async () => {
    images = await loadTestImages();
    expect(images.size).toBeGreaterThan(0);
  });

  describe('style.css (basic backgrounds)', () => {
    it('should generate sprite and update CSS', async () => {
      const css = await loadCssFile('style.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style.css' },
        output: {
          cssDist: 'test/css/',
          imageDist: 'test/img/',
          prefix: 'sprite_',
          format: 'png',
        },
      });

      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      // Should produce sprite images
      expect(result.spriteImages.size).toBeGreaterThan(0);

      // Should produce updated CSS
      expect(result.cssFiles.size).toBeGreaterThan(0);

      // Sprite image should have valid dimensions
      for (const [name, buf] of result.spriteImages) {
        const meta = await sharp(buf).metadata();
        expect(meta.width).toBeGreaterThan(0);
        expect(meta.height).toBeGreaterThan(0);
        expect(buf.length).toBeGreaterThan(0);
      }

      // CSS should have updated references
      const cssContent = Array.from(result.cssFiles.values())[0];
      expect(cssContent).toBeDefined();
      // Should contain sprite_ in the updated CSS
      expect(cssContent).toContain('sprite_');
      // Original local images should be replaced (at least some)
      expect(cssContent).toContain('background-position');
    });

    it('should skip non-existent images and report them', async () => {
      const css = await loadCssFile('style.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style.css' },
        output: { cssDist: 'test/css/', imageDist: 'test/img/' },
      });

      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      // style.css references level_5_no_exits.png and http://www.qq.com/...
      // These should be in skippedImages
      expect(result.skippedImages.length).toBeGreaterThan(0);
    });
  });

  describe('style2.css (animations, hover, unsprite)', () => {
    it('should handle CSS with @keyframes and #unsprite markers', async () => {
      const css = await loadCssFile('style2.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style2.css' },
        output: { cssDist: 'test/css/', imageDist: 'test/img/' },
      });

      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      expect(result.spriteImages.size).toBeGreaterThan(0);

      // Verify sprite dimensions are reasonable
      for (const [, buf] of result.spriteImages) {
        const meta = await sharp(buf).metadata();
        expect(meta.width as number).toBeLessThanOrEqual(4096);
        expect(meta.height as number).toBeLessThanOrEqual(4096);
      }

      // CSS output should exist
      expect(result.cssFiles.size).toBeGreaterThan(0);
    });
  });

  describe('style3.css (simple backgrounds)', () => {
    it('should generate sprite from third CSS file', async () => {
      const css = await loadCssFile('style3.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style3.css' },
        output: { cssDist: 'test/css/', imageDist: 'test/img/' },
      });

      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      expect(result.spriteImages.size).toBeGreaterThan(0);
      expect(result.cssFiles.size).toBeGreaterThan(0);

      // All sprite images should be valid PNGs
      for (const [, buf] of result.spriteImages) {
        const meta = await sharp(buf).metadata();
        expect(meta.format).toBe('png');
      }
    });
  });

  describe('style_noimg.css (no background images)', () => {
    it('should handle CSS with no image references gracefully', async () => {
      const css = await loadCssFile('style_noimg.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style_noimg.css' },
        output: { cssDist: 'test/css/', imageDist: 'test/img/' },
      });

      // Should not crash
      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      // No sprite images expected (no background-image references)
      expect(result.spriteImages.size).toBe(0);
      expect(result.skippedImages).toEqual([]);
    });
  });

  describe('multi-CSS input', () => {
    it('should process multiple CSS files together', async () => {
      const cssMap = new Map<string, string>();
      for (const file of ['style.css', 'style2.css', 'style3.css']) {
        const content = await readFile(path.join(TEST_CSS_DIR, file), 'utf-8');
        cssMap.set(file, content);
      }

      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: ['style.css', 'style2.css', 'style3.css'] },
        output: { cssDist: 'test/css/', imageDist: 'test/img/', combine: true },
      });

      const result = await spriter.run({ css: cssMap, images, cssBaseDir: 'test/css' });

      expect(result.spriteImages.size).toBeGreaterThan(0);
      expect(result.cssFiles.size).toBeGreaterThanOrEqual(1);

      // Verify manifest has entries
      expect(result.manifest.size).toBeGreaterThan(0);

      // Verify manifest entries have correct structure
      for (const [url, info] of result.manifest) {
        expect(info.spriteFile).toBeTruthy();
        expect(info.x).toBeGreaterThanOrEqual(0);
        expect(info.y).toBeGreaterThanOrEqual(0);
        expect(info.width).toBeGreaterThan(0);
        expect(info.height).toBeGreaterThan(0);
      }
    });
  });

  describe('webp output format', () => {
    it('should generate webp sprites when configured', async () => {
      const css = await loadCssFile('style3.css');
      const spriter = new Spriter({
        workspace: ROOT,
        input: { cssSource: 'test/css/style3.css' },
        output: { cssDist: 'test/css/', imageDist: 'test/img/', format: 'webp' },
      });

      const result = await spriter.run({ css, images, cssBaseDir: 'test/css' });

      expect(result.spriteImages.size).toBeGreaterThan(0);
      for (const [name, buf] of result.spriteImages) {
        expect(name).toContain('.webp');
        const meta = await sharp(buf).metadata();
        expect(meta.format).toBe('webp');
      }
    });
  });
});
