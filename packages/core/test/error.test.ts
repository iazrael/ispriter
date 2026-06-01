import { describe, it, expect } from 'vitest';
import { IspriterError } from '../src/error.js';

describe('IspriterError', () => {
  it('should have correct name and code', () => {
    const err = new IspriterError('test message', 'CONFIG_INVALID');
    expect(err.name).toBe('IspriterError');
    expect(err.code).toBe('CONFIG_INVALID');
    expect(err.message).toBe('test message');
  });

  it('should carry context', () => {
    const err = new IspriterError('fail', 'CSS_PARSE_ERROR', { file: 'a.css', line: 10 });
    expect(err.context).toEqual({ file: 'a.css', line: 10 });
  });

  it('should be instanceof Error', () => {
    const err = new IspriterError('x', 'PACK_ERROR');
    expect(err).toBeInstanceOf(Error);
  });
});
