import postcss, { type Rule, type Declaration } from 'postcss';
import type { PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../config.js';
import { IspriterError } from '../error.js';
import CleanCSS from 'clean-css';

/**
 * 更新 CSS 内容：替换 background-image url 和 background-position
 */
export async function emitCSS(
  cssContents: Map<string, string>,
  packedSprites: PackedSprite[],
  config: ResolvedConfig,
): Promise<Map<string, string>> {
  // 构建 url → sprite 位置映射
  const urlToSprite = new Map<
    string,
    { spriteFile: string; x: number; y: number; w: number; h: number }
  >();
  for (const sprite of packedSprites) {
    for (const item of sprite.items) {
      urlToSprite.set(item.asset.url, {
        spriteFile: sprite.spriteFile,
        x: item.x,
        y: item.y,
        w: item.width,
        h: item.height,
      });
    }
  }

  const results = new Map<string, string>();

  for (const [filename, css] of cssContents) {
    try {
      const root = postcss.parse(css);

      root.walkRules((rule: Rule) => {
        for (const node of rule.nodes) {
          if (node.type === 'decl') {
            const decl = node as Declaration;
            if (decl.prop === 'background' || decl.prop === 'background-image') {
              const urlMatch = decl.value.match(/url\(['"]?([^'")]+)['"]?\)/);
              if (!urlMatch) continue;

              const originalUrl = urlMatch[1].replace(/\?[^#]*/g, '').replace(/#(?!unsprite).*/g, '');
              const mapping = urlToSprite.get(originalUrl);
              if (!mapping) continue; // 跳过的图片保持原样

              // 替换 url
              const newUrl = `${config.output.imageDist}${mapping.spriteFile}`;
              decl.value = decl.value.replace(urlMatch[0], `url('${newUrl}')`);

              // 更新/添加 background-position
              const posX = convertUnit(-mapping.x, config);
              const posY = convertUnit(-mapping.y, config);

              let posDecl: Declaration | undefined;
              for (const n of rule.nodes) {
                if (n.type === 'decl' && (n as Declaration).prop === 'background-position') {
                  posDecl = n as Declaration;
                  break;
                }
              }

              if (posDecl) {
                posDecl.value = `${posX} ${posY}`;
              } else {
                rule.append({ prop: 'background-position', value: `${posX} ${posY}` });
              }
            }
          }
        }
      });

      let output = root.toString();

      // 压缩
      if (config.output.compress) {
        const cleaner = new CleanCSS(
          typeof config.output.compress === 'object' ? (config.output.compress as ConstructorParameters<typeof CleanCSS>[0]) : {},
        );
        const minified = cleaner.minify(output);
        if (minified.errors.length > 0) {
          throw new IspriterError(`CSS compression failed: ${minified.errors.join(', ')}`, 'OUTPUT_ERROR');
        }
        output = minified.styles;
      }

      results.set(filename, output);
    } catch (e) {
      if (e instanceof IspriterError) throw e;
      throw new IspriterError(`Failed to emit CSS for ${filename}`, 'OUTPUT_ERROR', { file: filename });
    }
  }

  return results;
}

function convertUnit(px: number, config: ResolvedConfig): string {
  if (config.output.unit === 'rem') {
    return `${(px / config.output.remBase).toFixed(6).replace(/\.?0+$/, '')}rem`;
  }
  return `${px}px`;
}
