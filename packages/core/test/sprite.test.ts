import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { generateSprites } from '../src/image/sprite.js';
import type { PackedSprite } from '../src/types.js';
import { parseConfig } from '../src/config.js';

async function makeTestImage(width: number, height: number, r: number): Promise<Buffer> {
  return await sharp({
    create: { width, height, channels: 4, background: { r, g: 0, b: 0, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

const config = parseConfig({
  input: { cssSource: 'test.css' },
  output: { cssDist: './dist/' },
});

describe('generateSprites', () => {
  it('F5.1: should generate PNG sprite', async () => {
    const img1 = await makeTestImage(50, 50, 255);
    const img2 = await makeTestImage(30, 30, 128);

    const sprites: PackedSprite[] = [
      {
        spriteFile: 'sprite_0.png',
        canvasWidth: 80,
        canvasHeight: 50,
        items: [
          {
            asset: { url: 'a.png', buffer: img1, naturalWidth: 50, naturalHeight: 50, rules: [] },
            x: 0,
            y: 0,
            width: 50,
            height: 50,
          },
          {
            asset: { url: 'b.png', buffer: img2, naturalWidth: 30, naturalHeight: 30, rules: [] },
            x: 50,
            y: 0,
            width: 30,
            height: 30,
          },
        ],
      },
    ];

    const result = await generateSprites(sprites, config);
    expect(result.has('sprite_0.png')).toBe(true);

    const buf = result.get('sprite_0.png')!;
    expect(buf.length).toBeGreaterThan(0);

    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(80);
    expect(meta.height).toBe(50);
  });

  it('F5.2: should generate WebP when configured', async () => {
    const img = await makeTestImage(50, 50, 100);
    const webpConfig = parseConfig({
      input: { cssSource: 'test.css' },
      output: { cssDist: './dist/', format: 'webp' },
    });

    const sprites: PackedSprite[] = [
      {
        spriteFile: 'sprite_0.webp',
        canvasWidth: 50,
        canvasHeight: 50,
        items: [
          {
            asset: { url: 'a.png', buffer: img, naturalWidth: 50, naturalHeight: 50, rules: [] },
            x: 0,
            y: 0,
            width: 50,
            height: 50,
          },
        ],
      },
    ];

    const result = await generateSprites(sprites, webpConfig);
    const meta = await sharp(result.get('sprite_0.webp')!).metadata();
    expect(meta.format).toBe('webp');
  });

  it('should handle empty sprite list', async () => {
    const result = await generateSprites([], config);
    expect(result.size).toBe(0);
  });
});
