import sharp from 'sharp';
import type { ImageAsset, PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../config.js';
import { pack } from '../packer.js';

/**
 * 从图片资产中识别 @2x/@3x 版本
 * 命名约定：icon.png → icon@2x.png, icon@3x.png
 */
export function matchRetinaImages(
  assets: ImageAsset[],
  scale: 2 | 3,
): { standard: ImageAsset[]; retina: Map<string, ImageAsset> } {
  const retinaMap = new Map<string, ImageAsset>();
  const standard: ImageAsset[] = [];

  for (const asset of assets) {
    const retinaSuffix = `@${scale}x`;
    // 检查是否是 @Nx 版本
    const match = asset.url.match(/^(.+?)(@\dx)(\.\w+)$/);
    if (match && match[2] === retinaSuffix) {
      retinaMap.set(match[1] + match[3], asset);
    } else if (!asset.url.includes('@2x') && !asset.url.includes('@3x')) {
      standard.push(asset);
    }
  }

  return { standard, retina: retinaMap };
}

/**
 * 生成 Retina 精灵图
 * - 如果有 @2x 版本，使用高清版
 * - 如果没有，放大普通版本
 * - CSS 中设置 background-size 为实际尺寸的 1/scale
 */
export async function generateRetinaSprites(
  assets: ImageAsset[],
  config: ResolvedConfig,
  scale: 2 | 3,
): Promise<{ packedSprites: PackedSprite[]; scaledAssets: Map<string, { width: number; height: number }> }> {
  const scaledAssets = new Map<string, { width: number; height: number }>();
  const retinaMatch = matchRetinaImages(assets, scale);

  // 准备图片：使用 @Nx 版本或放大普通版本
  const preparedAssets: ImageAsset[] = [];

  for (const asset of assets) {
    // 跳过已经是 @Nx 版本的
    if (asset.url.includes('@2x') || asset.url.includes('@3x')) continue;

    const retinaAsset = retinaMatch.retina.get(asset.url);
    let buffer: Buffer;
    let width: number;
    let height: number;

    if (retinaAsset) {
      // 使用高清版本
      buffer = retinaAsset.buffer;
      width = retinaAsset.naturalWidth;
      height = retinaAsset.naturalHeight;
    } else {
      // 放大普通版本
      const resized = await sharp(asset.buffer)
        .resize(asset.naturalWidth * scale, asset.naturalHeight * scale, { fit: 'fill' })
        .toBuffer();
      const meta = await sharp(resized).metadata();
      buffer = resized;
      width = meta.width || asset.naturalWidth * scale;
      height = meta.height || asset.naturalHeight * scale;
    }

    preparedAssets.push({
      ...asset,
      buffer,
      naturalWidth: width,
      naturalHeight: height,
    });

    // 记录原始尺寸，用于 CSS background-size
    scaledAssets.set(asset.url, { width, height });
  }

  // 打包
  const inputs = preparedAssets.map((a) => ({
    width: a.naturalWidth,
    height: a.naturalHeight,
    data: a,
  }));

  const { placed: packedResults, unfit } = pack(inputs, config.output.margin * scale);

  if (unfit.length > 0) {
    console.warn(`[ispriter] ${unfit.length} retina image(s) could not be packed`);
  }

  if (packedResults.length === 0) {
    return { packedSprites: [], scaledAssets };
  }

  const ext = config.output.format === 'webp' ? 'webp' : 'png';
  const spriteFile = `${config.output.prefix}retina_${scale}x.${ext}`;

  const canvasWidth = Math.max(...packedResults.map((r) => r.x + r.width));
  const canvasHeight = Math.max(...packedResults.map((r) => r.y + r.height));

  const packedSprite: PackedSprite = {
    spriteFile,
    canvasWidth,
    canvasHeight,
    items: packedResults.map((r) => ({
      asset: r.data,
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
    })),
  };

  return { packedSprites: [packedSprite], scaledAssets };
}
