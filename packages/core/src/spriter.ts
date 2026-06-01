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

    // 1. 提取所有 background 规则
    const rules = extractBackgrounds(css);

    // 2. 过滤 + 去重 + 匹配图片 Buffer
    const { assets, skipped } = this.buildSpriteTasks(rules, images);

    // 3. 填充图片尺寸
    await this.fillImageSizes(assets);

    // 4. Bin-packing
    const packedSprites = this.packSprites(assets);

    // 5. 生成精灵图
    const spriteImages = await generateSprites(packedSprites, this.config);

    // 6. 更新 CSS
    const cssFiles = await emitCSS(css, packedSprites, this.config);

    // 6.5 Retina 支持
    if (this.config.output.retina) {
      const { generateRetinaSprites } = await import('./image/retina.js');
      const { packedSprites: retinaPacked } = await generateRetinaSprites(
        assets,
        this.config,
        this.config.output.retina,
      );

      // 生成 retina 精灵图
      const retinaImages = await generateSprites(retinaPacked, this.config);
      for (const [name, buf] of retinaImages) {
        spriteImages.set(name, buf);
      }
    }

    // 7. 构建 manifest
    const manifest = this.buildManifest(packedSprites);

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

  private async fillImageSizes(assets: ImageAsset[]): Promise<void> {
    for (const asset of assets) {
      const meta = await sharp(asset.buffer).metadata();
      asset.naturalWidth = meta.width || 0;
      asset.naturalHeight = meta.height || 0;
    }
  }

  private packSprites(assets: ImageAsset[]): PackedSprite[] {
    if (assets.length === 0) return [];

    const inputs = assets.map((a) => ({
      width: a.naturalWidth,
      height: a.naturalHeight,
      data: a,
    }));

    const results = pack(inputs, this.config.output.margin);

    if (results.length === 0) return [];

    const spriteFile = `${this.config.output.prefix}0.${this.config.output.format === 'webp' ? 'webp' : 'png'}`;

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
