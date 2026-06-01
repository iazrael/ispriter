import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { Spriter } from '../src/spriter.js';

async function makePng(w: number, h: number, color: number): Promise<Buffer> {
  return sharp({
    create: { width: w, height: h, channels: 4, background: { r: color, g: 0, b: 0, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

describe('Spriter', () => {
  it('should run end-to-end with minimal config', async () => {
    const imgA = await makePng(50, 50, 255);
    const imgB = await makePng(30, 30, 128);

    const spriter = new Spriter({
      input: { cssSource: 'test.css' },
      output: { cssDist: './dist/' },
    });

    const result = await spriter.run({
      css: new Map([
        [
          'test.css',
          '.a { background: url(a.png) no-repeat; } .b { background: url(b.png) no-repeat; }',
        ],
      ]),
      images: new Map([
        ['a.png', imgA],
        ['b.png', imgB],
      ]),
      cssBaseDir: '.',
    });

    expect(result.spriteImages.size).toBe(1);
    expect(result.cssFiles.size).toBe(1);
    expect(result.manifest.size).toBe(2);
    expect(result.skippedImages).toHaveLength(0);

    const css = result.cssFiles.get('test.css')!;
    expect(css).toContain('sprite_0.png');
    expect(css).toContain('background-position');
  });

  it('should skip missing images', async () => {
    const imgA = await makePng(50, 50, 255);

    const spriter = new Spriter({
      input: { cssSource: 'test.css' },
      output: { cssDist: './dist/' },
    });

    const result = await spriter.run({
      css: new Map([
        [
          'test.css',
          '.a { background: url(a.png) no-repeat; } .b { background: url(b.png) no-repeat; }',
        ],
      ]),
      images: new Map([['a.png', imgA]]),
      cssBaseDir: '.',
    });

    expect(result.skippedImages).toContain('b.png');
    expect(result.manifest.size).toBe(1);
  });

  it('should deduplicate same url', async () => {
    const imgA = await makePng(50, 50, 255);

    const spriter = new Spriter({
      input: { cssSource: 'test.css' },
      output: { cssDist: './dist/' },
    });

    const result = await spriter.run({
      css: new Map([
        [
          'test.css',
          '.a { background: url(a.png) no-repeat; } .b { background: url(a.png) no-repeat; }',
        ],
      ]),
      images: new Map([['a.png', imgA]]),
      cssBaseDir: '.',
    });

    expect(result.manifest.size).toBe(1);
  });
});
