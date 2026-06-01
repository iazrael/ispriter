import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { matchRetinaImages, generateRetinaSprites } from '../src/image/retina.js';
import type { ImageAsset } from '../src/types.js';
import { parseConfig } from '../src/config.js';

async function makePng(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 128, g: 0, b: 0, alpha: 255 } } }).png().toBuffer();
}

function makeAsset(url: string, w: number, h: number, buffer: Buffer): ImageAsset {
  return { url, buffer, naturalWidth: w, naturalHeight: h, rules: [] };
}

describe('matchRetinaImages', () => {
  it('should match @2x images', async () => {
    const buf1 = await makePng(50, 50);
    const buf2 = await makePng(100, 100);
    const assets = [
      makeAsset('icon.png', 50, 50, buf1),
      makeAsset('icon@2x.png', 100, 100, buf2),
    ];
    const result = matchRetinaImages(assets, 2);
    expect(result.standard).toHaveLength(1);
    expect(result.standard[0].url).toBe('icon.png');
    expect(result.retina.get('icon.png')?.url).toBe('icon@2x.png');
  });

  it('should handle missing @2x', async () => {
    const buf = await makePng(50, 50);
    const assets = [makeAsset('icon.png', 50, 50, buf)];
    const result = matchRetinaImages(assets, 2);
    expect(result.standard).toHaveLength(1);
    expect(result.retina.size).toBe(0);
  });
});

describe('generateRetinaSprites', () => {
  it('F9.2: should upscale when no @2x exists', async () => {
    const buf = await makePng(50, 50);
    const config = parseConfig({ input: { cssSource: 'test.css' }, output: { cssDist: './dist/' } });
    const assets = [makeAsset('icon.png', 50, 50, buf)];

    const { packedSprites, scaledAssets } = await generateRetinaSprites(assets, config, 2);
    expect(packedSprites).toHaveLength(1);
    expect(packedSprites[0].spriteFile).toContain('retina_2x');
    expect(scaledAssets.get('icon.png')?.width).toBe(100); // 放大 2x
  });

  it('F9.1: should use @2x when available', async () => {
    const buf1 = await makePng(50, 50);
    const buf2 = await makePng(100, 100);
    const config = parseConfig({ input: { cssSource: 'test.css' }, output: { cssDist: './dist/' } });
    const assets = [
      makeAsset('icon.png', 50, 50, buf1),
      makeAsset('icon@2x.png', 100, 100, buf2),
    ];

    const { packedSprites, scaledAssets } = await generateRetinaSprites(assets, config, 2);
    expect(packedSprites).toHaveLength(1);
    expect(scaledAssets.get('icon.png')?.width).toBe(100); // 使用 @2x 的尺寸
  });
});
