import { describe, it, expect } from 'vitest';
import { extractBackgrounds } from '../src/css/parser.js';

describe('extractBackgrounds', () => {
  it('F1.1: should extract background-image url', () => {
    const css = new Map([['test.css', '.icon { background: url(img/icon.png); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('img/icon.png');
  });

  it('F1.2: should extract background shorthand', () => {
    const css = new Map([['test.css', '.cls { background: #fff url(img/a.png) no-repeat 0 0; }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('img/a.png');
    expect(rules[0].repeat).toBe('no-repeat');
  });

  it('F1.3: should skip #unsprite', () => {
    const css = new Map([['test.css', '.cls { background: url(img/a.png#unsprite); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(0);
  });

  it('F1.4: should skip repeat', () => {
    const css = new Map([['test.css', '.cls { background: url(img/a.png) repeat; }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(0);
  });

  it('F1.6: should skip gradient', () => {
    const css = new Map([['test.css', '.cls { background-image: linear-gradient(to right, red, blue); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(0);
  });

  it('F1.10: should skip right/center/bottom position', () => {
    const css = new Map([['test.css', '.cls { background: url(a.png) right center; }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(0);
  });

  it('F1.11: should clean url query and hash', () => {
    const css = new Map([['test.css', '.cls { background: url(../img/a.png?t=123#hash); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('../img/a.png');
  });

  it('should handle multiple rules', () => {
    const css = new Map([['test.css', '.a { background: url(a.png); } .b { background: url(b.png); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(2);
  });

  it('should deduplicate same url in different selectors', () => {
    const css = new Map([['test.css', '.a { background: url(same.png); } .b { background: url(same.png); }']]);
    const rules = extractBackgrounds(css);
    expect(rules).toHaveLength(2); // parser 不去重，去重在 Spriter 层
    expect(rules.every(r => r.imageUrl === 'same.png')).toBe(true);
  });
});
