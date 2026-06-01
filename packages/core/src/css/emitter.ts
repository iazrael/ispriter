import postcss, { type Rule, type Declaration } from 'postcss';
import type { PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../config.js';
import { IspriterError } from '../error.js';
import { cleanImageUrl } from './background.js';
import CleanCSS from 'clean-css';

export interface RetinaInfo {
  width: number;
  height: number;
  scale: number;
}

/**
 * 更新 CSS 内容：替换 background-image url 和 background-position
 * Fix #8: 支持传入 retinaInfo，自动添加 background-size
 * Fix #12: 支持 combineCSSRule 合并同一精灵图的选择器
 */
export async function emitCSS(
  cssContents: Map<string, string>,
  packedSprites: PackedSprite[],
  config: ResolvedConfig,
  retinaInfo?: Map<string, RetinaInfo>,
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

      // Fix #12: combineCSSRule — 收集同一精灵图的选择器
      const spriteSelectors = new Map<string, { rule: Rule; decl: Declaration }[]>();

      root.walkRules((rule: Rule) => {
        for (const node of rule.nodes) {
          if (node.type === 'decl') {
            const decl = node as Declaration;
            if (decl.prop === 'background' || decl.prop === 'background-image') {
              const urlMatch = decl.value.match(/url\(['"]?([^'")]+)['"]?\)/);
              if (!urlMatch) continue;

              const originalUrl = cleanImageUrl(urlMatch[1]);
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

              // Fix #8: Retina background-size
              if (retinaInfo) {
                const info = retinaInfo.get(originalUrl);
                if (info) {
                  const bgW = convertUnit(Math.round(info.width / info.scale), config);
                  const bgH = convertUnit(Math.round(info.height / info.scale), config);

                  let sizeDecl: Declaration | undefined;
                  for (const n of rule.nodes) {
                    if (n.type === 'decl' && (n as Declaration).prop === 'background-size') {
                      sizeDecl = n as Declaration;
                      break;
                    }
                  }

                  if (sizeDecl) {
                    sizeDecl.value = `${bgW} ${bgH}`;
                  } else {
                    rule.append({ prop: 'background-size', value: `${bgW} ${bgH}` });
                  }
                }
              }

              // Fix #12: 收集选择器用于合并
              if (config.output.combineCSSRule) {
                const key = mapping.spriteFile;
                if (!spriteSelectors.has(key)) {
                  spriteSelectors.set(key, []);
                }
                spriteSelectors.get(key)!.push({ rule, decl });
              }
            }
          }
        }
      });

      // Fix #12: combineCSSRule — 合并同一精灵图的选择器的 background-image
      if (config.output.combineCSSRule) {
        for (const [, entries] of spriteSelectors) {
          if (entries.length <= 1) continue;

          // 创建合并规则
          const selectors = entries.map((e) => e.rule.selector);
          const combinedRule = postcss.rule({ selector: selectors.join(', ') });
          const firstEntry = entries[0];

          // 添加 background-image
          const bgImageDecl = firstEntry.decl.clone();
          combinedRule.append(bgImageDecl);

          // 从原规则中移除 background-image
          for (const entry of entries) {
            entry.decl.remove();
          }

          // 将合并规则插入到第一个原规则之前
          firstEntry.rule.before(combinedRule);
        }
      }

      let output = root.toString();

      // 压缩
      if (config.output.compress) {
        const cleaner = new CleanCSS(
          typeof config.output.compress === 'object'
            ? (config.output.compress as ConstructorParameters<typeof CleanCSS>[0])
            : {},
        );
        const minified = cleaner.minify(output);
        if (minified.errors.length > 0) {
          throw new IspriterError(
            `CSS compression failed: ${minified.errors.join(', ')}`,
            'OUTPUT_ERROR',
          );
        }
        output = minified.styles;
      }

      results.set(filename, output);
    } catch (e) {
      if (e instanceof IspriterError) throw e;
      throw new IspriterError(`Failed to emit CSS for ${filename}`, 'OUTPUT_ERROR', {
        file: filename,
      });
    }
  }

  // Fix #11: combine — 当 combine=true 时合并所有 CSS 为一个
  if (config.output.combine && results.size > 1) {
    const combined = Array.from(results.values()).join('\n');
    const combinedName = Array.from(results.keys())[0];
    results.clear();
    results.set(combinedName, combined);
  }

  return results;
}

function convertUnit(px: number, config: ResolvedConfig): string {
  if (config.output.unit === 'rem') {
    return `${(px / config.output.remBase).toFixed(6).replace(/\.?0+$/, '')}rem`;
  }
  return `${px}px`;
}
