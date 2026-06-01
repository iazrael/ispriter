import type { PackInput, PackResult } from './types.js';

interface Block<T> {
  x: number;
  y: number;
  w: number;
  h: number;
  data: T;
  fit?: { x: number; y: number; w: number; h: number };
}

export function pack<T>(blocks: PackInput<T>[], margin: number = 0): PackResult<T>[] {
  if (blocks.length === 0) return [];

  // 按面积降序排序
  const sorted = [...blocks].sort((a, b) => b.width * b.height - a.width * a.height);

  const packerBlocks: Block<T>[] = sorted.map((b) => ({
    x: 0,
    y: 0,
    w: b.width + margin,
    h: b.height + margin,
    data: b.data,
  }));

  const packer = new GrowingPacker<T>();
  packer.fit(packerBlocks);

  return packerBlocks
    .filter((b) => b.fit)
    .map((b) => ({
      width: b.w - margin,
      height: b.h - margin,
      x: b.fit!.x,
      y: b.fit!.y,
      rotated: false,
      data: b.data,
    }));
}

class GrowingPacker<T> {
  private root!: { x: number; y: number; w: number; h: number; used?: boolean; down?: any; right?: any };

  fit(blocks: Block<T>[]): void {
    const first = blocks[0];
    this.root = { x: 0, y: 0, w: first.w, h: first.h };

    for (const block of blocks) {
      const node = this.findNode(this.root, block.w, block.h);
      if (node) {
        block.fit = { x: node.x, y: node.y, w: node.w, h: node.h };
        this.splitNode(node, block.w, block.h);
      } else {
        const result = this.growNode(block.w, block.h);
        if (result) {
          block.fit = { x: result.x, y: result.y, w: result.w, h: result.h };
          this.splitNode(result, block.w, block.h);
        }
      }
    }
  }

  private findNode(root: any, w: number, h: number): any {
    if (root.used) {
      return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
    }
    if (w <= root.w && h <= root.h) {
      return root;
    }
    return null;
  }

  private splitNode(node: any, w: number, h: number): void {
    node.used = true;
    node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
    node.right = { x: node.x + w, y: node.y, w: node.w - w, h: h };
  }

  private growNode(w: number, h: number): any {
    const canGrowDown = w <= this.root.w;
    const canGrowRight = h <= this.root.h;

    const shouldGrowDown = canGrowDown && this.root.w >= this.root.h;
    const shouldGrowRight = canGrowRight && this.root.h >= this.root.w;

    if (shouldGrowRight) {
      return this.growRight(w, h);
    } else if (shouldGrowDown) {
      return this.growDown(w, h);
    } else if (canGrowRight) {
      return this.growRight(w, h);
    } else if (canGrowDown) {
      return this.growDown(w, h);
    }
    return null;
  }

  private growRight(w: number, h: number): any {
    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w + w,
      h: this.root.h,
      down: this.root,
      right: { x: this.root.w, y: 0, w: w, h: this.root.h },
    };
    let node: any;
    if ((node = this.findNode(this.root, w, h))) {
      return node;
    }
    return null;
  }

  private growDown(w: number, h: number): any {
    this.root = {
      used: true,
      x: 0,
      y: 0,
      w: this.root.w,
      h: this.root.h + h,
      down: { x: 0, y: this.root.h, w: this.root.w, h: h },
      right: this.root,
    };
    let node: any;
    if ((node = this.findNode(this.root, w, h))) {
      return node;
    }
    return null;
  }
}
