import { describe, it, expect } from 'vitest';
import { analyseBackground, shouldSkip, cleanImageUrl, isUnsprite } from '../src/css/background.js';

describe('analyseBackground', () => {
  it('should extract url from background-image', () => {
    const result = analyseBackground("url('img/icon.png')");
    expect(result.imageUrl).toBe('img/icon.png');
  });

  it('should extract from background shorthand', () => {
    const result = analyseBackground('#fff url(img/a.png) no-repeat 0 0');
    expect(result.imageUrl).toBe('img/a.png');
    expect(result.repeat).toBe('no-repeat');
  });

  it('should detect repeat', () => {
    expect(analyseBackground('url(a.png) repeat').repeat).toBe('repeat');
    expect(analyseBackground('url(a.png) repeat-x').repeat).toBe('repeat-x');
    expect(analyseBackground('url(a.png) no-repeat').repeat).toBe('no-repeat');
  });

  it('should return null for gradient', () => {
    const result = analyseBackground('linear-gradient(to right, red, blue)');
    expect(result.imageUrl).toBeNull();
  });
});

describe('shouldSkip', () => {
  it('should skip repeat', () => {
    expect(shouldSkip({ ...baseParsed(), repeat: 'repeat' })).toBe(true);
  });

  it('should not skip no-repeat', () => {
    expect(shouldSkip({ ...baseParsed(), repeat: 'no-repeat' })).toBe(false);
  });

  it('should skip right position', () => {
    expect(shouldSkip({ ...baseParsed(), positionX: '100%' })).toBe(true);
  });

  it('should skip center center', () => {
    expect(shouldSkip({ ...baseParsed(), positionX: 'center', positionY: 'center' })).toBe(true);
  });
});

describe('cleanImageUrl', () => {
  it('should remove query string', () => {
    expect(cleanImageUrl('a.png?t=123')).toBe('a.png');
  });

  it('should remove hash', () => {
    expect(cleanImageUrl('a.png#hash')).toBe('a.png');
  });

  it('should keep #unsprite', () => {
    expect(cleanImageUrl('a.png#unsprite')).toBe('a.png#unsprite');
  });
});

describe('isUnsprite', () => {
  it('should detect #unsprite', () => {
    expect(isUnsprite('a.png#unsprite')).toBe(true);
    expect(isUnsprite('a.png')).toBe(false);
  });
});

function baseParsed() {
  return {
    imageUrl: 'test.png',
    positionX: '0' as const,
    positionY: '0' as const,
    repeat: 'no-repeat',
    size: '',
  };
}
