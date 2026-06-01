import { describe, it, expect } from 'vitest';
import { emitCSS } from '../src/css/emitter.js';
import type { PackedSprite } from '../src/types.js';
import { parseConfig } from '../src/config.js';

const baseConfig = parseConfig({
  input: { cssSource: 'test.css' },
  output: { cssDist: './dist/' },
});

function makeSprites(urls: string[]): PackedSprite[] {
  return [
    {
      spriteFile: 'sprite_0.png',
      canvasWidth: 200,
      canvasHeight: 100,
      items: urls.map((url, i) => ({
        asset: { url, buffer: Buffer.alloc(0), naturalWidth: 50, naturalHeight: 50, rules: [] },
        x: i * 50,
        y: 0,
        width: 50,
        height: 50,
      })),
    },
  ];
}

describe('emitCSS', () => {
  it('F6.1: should update background-position', async () => {
    const css = new Map([['test.css', '.icon { background: url(icon.png) no-repeat; }']]);
    const result = await emitCSS(css, makeSprites(['icon.png']), baseConfig);
    expect(result.get('test.css')).toContain('background-position');
    expect(result.get('test.css')).toContain('0px 0px'); // x=0, y=0
  });

  it('F6.2: should update background-image url', async () => {
    const css = new Map([['test.css', '.icon { background: url(icon.png) no-repeat; }']]);
    const result = await emitCSS(css, makeSprites(['icon.png']), baseConfig);
    expect(result.get('test.css')).toContain('./img/sprite_0.png');
  });

  it('F6.6: should not compress when compress=false', async () => {
    const css = new Map([['test.css', '.icon {\n  background: url(icon.png) no-repeat;\n}']]);
    const result = await emitCSS(css, makeSprites(['icon.png']), baseConfig);
    expect(result.get('test.css')).toContain('\n');
  });

  it('F6.7: should convert to rem when unit=rem', async () => {
    const remConfig = parseConfig({
      input: { cssSource: 'test.css' },
      output: { cssDist: './dist/', unit: 'rem', remBase: 16 },
    });
    const css = new Map([['test.css', '.icon { background: url(icon.png) no-repeat; }']]);
    const sprites = makeSprites(['icon.png']);
    sprites[0].items[0].x = 16; // 16px = 1rem
    const result = await emitCSS(css, sprites, remConfig);
    expect(result.get('test.css')).toContain('-1rem');
  });

  it('should keep unmodified rules for skipped images', async () => {
    const css = new Map([['test.css', '.a { background: url(a.png); } .b { background: url(b.png); }']]);
    const result = await emitCSS(css, makeSprites(['a.png']), baseConfig);
    const output = result.get('test.css')!;
    expect(output).toContain('./img/sprite_0.png'); // a.png replaced
    expect(output).toContain('url(b.png)'); // b.png kept
  });
});
