import { describe, it, expect } from 'vitest';
import { parseConfig, normalizeConfig } from '../src/config.js';
import { IspriterError } from '../src/error.js';

const validConfig = {
  input: { cssSource: 'style.css' },
  output: { cssDist: './dist/' },
};

describe('normalizeConfig', () => {
  it('should wrap string into standard structure', () => {
    const result = normalizeConfig('./css/');
    expect(result.input.cssSource).toBe('./css/');
    expect(result.output.cssDist).toBe('./css/');
  });

  it('should pass through object config', () => {
    const result = normalizeConfig(validConfig);
    expect(result).toEqual(validConfig);
  });
});

describe('parseConfig', () => {
  it('should fill defaults for minimal valid config', () => {
    const config = parseConfig(validConfig);
    expect(config.output.format).toBe('png');
    expect(config.output.margin).toBe(2);
    expect(config.output.prefix).toBe('sprite_');
    expect(config.output.combine).toBe(false);
    expect(config.output.combineCSSRule).toBe(true);
    expect(config.output.unit).toBe('px');
    expect(config.output.remBase).toBe(16);
    expect(config.output.quality).toBe(80);
    expect(config.output.imageDist).toBe('./img/');
    expect(config.workspace).toBe('./');
  });

  it('should accept array cssSource', () => {
    const config = parseConfig({
      input: { cssSource: ['a.css', 'b.css'] },
      output: { cssDist: 'out/' },
    });
    expect(config.input.cssSource).toEqual(['a.css', 'b.css']);
  });

  it('should reject missing input', () => {
    expect(() => parseConfig({ output: { cssDist: 'out/' } })).toThrow(IspriterError);
  });

  it('should reject missing output', () => {
    expect(() => parseConfig({ input: { cssSource: 'a.css' } })).toThrow(IspriterError);
  });

  it('should accept groups config', () => {
    const config = parseConfig({
      ...validConfig,
      groups: [{ name: 'nav', images: 'nav/*' }],
    });
    expect(config.groups).toEqual([{ name: 'nav', images: 'nav/*' }]);
  });

  it('should accept unit=rem', () => {
    const config = parseConfig({
      input: { cssSource: 'a.css' },
      output: { cssDist: 'out/', unit: 'rem', remBase: 20 },
    });
    expect(config.output.unit).toBe('rem');
    expect(config.output.remBase).toBe(20);
  });

  it('should accept compress as object', () => {
    const config = parseConfig({
      ...validConfig,
      output: { ...validConfig.output, compress: { keepBreaks: true } },
    });
    expect(config.output.compress).toEqual({ keepBreaks: true });
  });

  it('should accept retina config', () => {
    const config = parseConfig({
      ...validConfig,
      output: { ...validConfig.output, retina: 2 },
    });
    expect(config.output.retina).toBe(2);
  });

  it('should accept ignoreImages', () => {
    const config = parseConfig({
      input: { cssSource: 'a.css', ignoreImages: ['icons/*', 'logo.png'] },
      output: { cssDist: 'out/' },
    });
    expect(config.input.ignoreImages).toEqual(['icons/*', 'logo.png']);
  });
});
