import type { SpriterRunInput, SpriterResult, PackedSprite, ImageAsset, BackgroundRule } from './types.js';
import type { ResolvedConfig } from './config.js';
import { parseConfig, type SpriterConfig } from './config.js';
import { extractBackgrounds } from './css/parser.js';
import { emitCSS } from './css/emitter.js';
import { generateSprites } from './image/sprite.js';
import { pack } from './packer.js';
import { matchesAny } from '@ispriter/shared';
import sharp from 'sharp';

export class Spriter {
  private config: ResolvedConfig;

  constructor(config: SpriterConfig) {
    this.config = parseConfig(config);
  }

  async run(input: SpriterRunInput): Promise<SpriterResult> {
    const { css, images } = input;

    const rules = await extractBackgrounds(css);

    // 2. 过滤 + 去重 + 匹配图片 Buffer
    const { assets, skipped } = this.buildSpriteTasks(rules, images);

    // 3. 填充图片尺寸 (并行)
    await this.fillImageSizes(assets);

    // 4. 按 groups 分桶（Fix #14）
    const assetGroups = this.groupAssets(assets);

    // 5. Bin-packing（每组独立打包）
    const allPackedSprites: PackedSprite[] = [];
    for (let gi = 0; gi < assetGroups.length; gi++) {
      const group = assetGroups[gi];
      const packed = this.packSprites(group, gi);
      allPackedSprites.push(...packed);
    }

    // 6. maxSingleSize 拆分（Fix #13）
    const finalSprites = this.splitByMaxSize(allPackedSprites);

    // 7. 生成精灵图
    const spriteImages = await generateSprites(finalSprites, this.config);

    // 8. Retina 支持（Fix #8）
    let retinaInfo: Map<string, { width: number; height: number; scale: number }> | undefined;
    if (this.config.output.retina) {
      const { generateRetinaSprites } = await import('./image/retina.js');
      const scale = this.config.output.retina;
      const { packedSprites: retinaPacked, scaledAssets } = await generateRetinaSprites(
        assets,
        this.config,
        scale,
      );

      // 生成 retina 精灵图
      const retinaImages = await generateSprites(retinaPacked, this.config);
      for (const [name, buf] of retinaImages) {
        spriteImages.set(name, buf);
      }

      // 构建 retinaInfo 用于 CSS background-size
      retinaInfo = new Map<string, { width: number; height: number; scale: number }>();
      for (const [url, dims] of scaledAssets) {
        retinaInfo.set(url, { width: dims.width, height: dims.height, scale });
      }
    }

    // 9. 更新 CSS
    const cssFiles = await emitCSS(css, finalSprites, this.config, retinaInfo);

    // 10. 构建 manifest
    const manifest = this.buildManifest(finalSprites);

    return { cssFiles, spriteImages, manifest, skippedImages: skipped };
  }

  private buildSpriteTasks(
    rules: BackgroundRule[],
    images: Map<string, Buffer>,
  ): { assets: ImageAsset[]; skipped: string[] } {
    const assetMap = new Map<string, ImageAsset>();
    const skipped: string[] = [];
    const ignorePatterns = this.config.input.ignoreImages
      ? Array.isArray(this.config.input.ignoreImages)
        ? this.config.input.ignoreImages
        : [this.config.input.ignoreImages]
      : [];

    for (const rule of rules) {
      const url = rule.imageUrl;

      // 检查 ignoreImages
      if (ignorePatterns.length > 0 && matchesAny(ignorePatterns, url)) {
        continue;
      }

      // 去重：同一个 url 只打包一次
      if (assetMap.has(url)) {
        assetMap.get(url)!.rules.push(rule);
        continue;
      }

      // 匹配图片 Buffer
      const buffer = images.get(url);
      if (!buffer) {
        skipped.push(url);
        continue;
      }

      assetMap.set(url, {
        url,
        buffer,
        naturalWidth: 0,
        naturalHeight: 0,
        rules: [rule],
      });
    }

    return { assets: Array.from(assetMap.values()), skipped };
  }

  /** Fix #17: Promise.all 并行填充图片尺寸 */
  private async fillImageSizes(assets: ImageAsset[]): Promise<void> {
    await Promise.all(
      assets.map(async (asset) => {
        const meta = await sharp(asset.buffer).metadata();
        asset.naturalWidth = meta.width || 0;
        asset.naturalHeight = meta.height || 0;
      }),
    );
  }

  /** Fix #14: 按 groups 配置分桶 */
  private groupAssets(assets: ImageAsset[]): ImageAsset[][] {
    const groups = this.config.groups;
    if (!groups || groups.length === 0) {
      return [assets];
    }

    const buckets: ImageAsset[][] = groups.map(() => []);
    const assigned = new Set<string>();

    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const patterns = Array.isArray(group.images) ? group.images : [group.images];
      for (const asset of assets) {
        if (assigned.has(asset.url)) continue;
        if (matchesAny(patterns, asset.url)) {
          buckets[gi].push(asset);
          assigned.add(asset.url);
        }
      }
    }

    // 未分配的图片放入最后一个桶
    const lastBucket = buckets[buckets.length - 1];
    for (const asset of assets) {
      if (!assigned.has(asset.url)) {
        lastBucket.push(asset);
      }
    }

    return buckets.filter((b) => b.length > 0);
  }

  private packSprites(assets: ImageAsset[], groupIndex: number = 0): PackedSprite[] {
    if (assets.length === 0) return [];

    const inputs = assets.map((a) => ({
      width: a.naturalWidth,
      height: a.naturalHeight,
      data: a,
    }));

    const { placed: results, unfit } = pack(inputs, this.config.output.margin);

    if (unfit.length > 0) {
      console.warn(`[ispriter] ${unfit.length} image(s) could not be packed and were skipped`);
    }

    if (results.length === 0) return [];

    const spriteFile = `${this.config.output.prefix}${groupIndex}.${this.config.output.format === 'webp' ? 'webp' : 'png'}`;

    return [
      {
        spriteFile,
        canvasWidth: Math.max(...results.map((r) => r.x + r.width)),
        canvasHeight: Math.max(...results.map((r) => r.y + r.height)),
        items: results.map((r) => ({
          asset: r.data,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        })),
      },
    ];
  }

  /** Fix #13: 按 maxSingleSize 拆分精灵图 */
  private splitByMaxSize(sprites: PackedSprite[]): PackedSprite[] {
    const maxSize = this.config.output.maxSingleSize;
    if (!maxSize) return sprites;

    const maxBytes = maxSize * 1024; // KB to bytes
    const result: PackedSprite[] = [];

    for (const sprite of sprites) {
      // Rough estimate: RGBA pixels * 4 bytes
      const estimatedSize = sprite.canvasWidth * sprite.canvasHeight * 4;
      if (estimatedSize <= maxBytes) {
        result.push(sprite);
        continue;
      }

      // Split: take first half of items
      const mid = Math.ceil(sprite.items.length / 2);
      const chunks = [sprite.items.slice(0, mid), sprite.items.slice(mid)];

      for (let ci = 0; ci < chunks.length; ci++) {
        const items = chunks[ci];
        if (items.length === 0) continue;

        const ext = this.config.output.format === 'webp' ? 'webp' : 'png';
        const baseName = sprite.spriteFile.replace(`.${ext}`, '');
        const newFile = `${baseName}_part${ci}.${ext}`;

        result.push({
          spriteFile: newFile,
          canvasWidth: Math.max(...items.map((it) => it.x + it.width)),
          canvasHeight: Math.max(...items.map((it) => it.y + it.height)),
          items,
        });
      }
    }

    return result;
  }

  private buildManifest(
    packedSprites: PackedSprite[],
  ): Map<string, { spriteFile: string; x: number; y: number; width: number; height: number }> {
    const manifest = new Map<
      string,
      { spriteFile: string; x: number; y: number; width: number; height: number }
    >();
    for (const sprite of packedSprites) {
      for (const item of sprite.items) {
        manifest.set(item.asset.url, {
          spriteFile: sprite.spriteFile,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        });
      }
    }
    return manifest;
  }
}
