import { describe, it, expect } from 'vitest';
import { expandImports } from '../src/css/imports.js';

describe('expandImports', () => {
  it('should export expandImports function', () => {
    expect(typeof expandImports).toBe('function');
  });
});
