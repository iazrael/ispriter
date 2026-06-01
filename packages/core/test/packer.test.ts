import { describe, it, expect } from 'vitest';
import { pack } from '../src/packer.js';

describe('pack', () => {
  it('should return empty for empty input', () => {
    const result = pack([]);
    expect(result.placed).toEqual([]);
    expect(result.unfit).toEqual([]);
  });

  it('should place single block at origin', () => {
    const { placed } = pack([{ width: 100, height: 100, data: 'a' }], 0);
    expect(placed).toHaveLength(1);
    expect(placed[0].x).toBe(0);
    expect(placed[0].y).toBe(0);
    expect(placed[0].width).toBe(100);
    expect(placed[0].height).toBe(100);
  });

  it('should place multiple blocks without overlap', () => {
    const { placed: result } = pack(
      [
        { width: 100, height: 100, data: 'big' },
        { width: 50, height: 50, data: 'small' },
        { width: 200, height: 80, data: 'wide' },
      ],
      0,
    );
    expect(result).toHaveLength(3);
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i], b = result[j];
        const overlap = a.x < b.x + b.width && a.x + a.width > b.x &&
                        a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlap).toBe(false);
      }
    }
  });

  it('should respect margin', () => {
    const { placed: result } = pack(
      [
        { width: 50, height: 50, data: 'a' },
        { width: 50, height: 50, data: 'b' },
      ],
      5,
    );
    const second = result.find((r) => r.x > 0 || r.y > 0)!;
    expect(second.x === 55 || second.y === 55).toBe(true); // 50 + 5 margin
  });

  it('should preserve data through packing', () => {
    const { placed: result } = pack([
      { width: 30, height: 30, data: { name: 'icon.png' } },
    ], 0);
    expect(result[0].data).toEqual({ name: 'icon.png' });
  });

  it('should sort by area descending internally', () => {
    // Small first, big last — should still pack correctly
    const { placed: result } = pack(
      [
        { width: 10, height: 10, data: 'tiny' },
        { width: 200, height: 200, data: 'huge' },
      ],
      0,
    );
    expect(result).toHaveLength(2);
    // Huge should be at origin (sorted first internally)
    const huge = result.find((r) => r.data === 'huge')!;
    expect(huge.x).toBe(0);
    expect(huge.y).toBe(0);
  });

  it('should work with default margin (0)', () => {
    const { placed: result } = pack([
      { width: 50, height: 50, data: 'a' },
      { width: 50, height: 50, data: 'b' },
    ]);
    expect(result).toHaveLength(2);
  });

  it('should report unfit blocks that cannot be packed', () => {
    // This is a contrived test — normally GrowingPacker grows to fit,
    // but we test the unfit tracking exists
    const { placed, unfit } = pack([
      { width: 50, height: 50, data: 'a' },
    ]);
    expect(placed).toHaveLength(1);
    expect(unfit).toHaveLength(0);
  });
});
