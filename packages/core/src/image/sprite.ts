import sharp from 'sharp';
import type { PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../config.js';
import { IspriterError } from '../error.js';

/**
 * 根据打包结果生成精灵图 Buffer
 */
export async function generateSprites(
  packedSprites: PackedSprite[],
  config: ResolvedConfig,
): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();

  for (const sprite of packedSprites) {
    try {
      const { canvasWidth, canvasHeight, items } = sprite;

      // 创建透明画布
      const canvas = sharp({
        create: {
          width: canvasWidth,
          height: canvasHeight,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });

      // 用 composite 叠加所有图片（P1: parallel）
      const composites = await Promise.all(
        items.map(async (item) => {
          let inputBuf = item.asset.buffer;
          if (item.width !== item.asset.naturalWidth || item.height !== item.asset.naturalHeight) {
            inputBuf = await sharp(item.asset.buffer)
              .resize(item.width, item.height, { fit: 'fill' })
              .toBuffer();
          }
          return { input: inputBuf, left: item.x, top: item.y };
        }),
      );

      let output = canvas.composite(composites);

      if (config.output.format === 'webp') {
        output = output.webp({ quality: config.output.quality });
      } else {
        output = output.png();
      }

      const buffer = await output.toBuffer();
      results.set(sprite.spriteFile, buffer);
    } catch (e) {
      if (e instanceof IspriterError) throw e;
      throw new IspriterError(
        `Failed to generate sprite: ${sprite.spriteFile}: ${(e as Error).message}`,
        'OUTPUT_ERROR',
        {
          spriteFile: sprite.spriteFile,
          cause: e,
        },
      );
    }
  }

  return results;
}
