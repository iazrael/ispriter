import postcss, { type Root, type Rule, type Declaration } from 'postcss';
import type { BackgroundRule } from '../types.js';
import { analyseBackground, cleanImageUrl, isUnsprite, shouldSkip } from './background.js';

/**
 * 从多个 CSS 文件中提取所有 background 规则
 */
export function extractBackgrounds(
  cssContents: Map<string, string>,
): BackgroundRule[] {
  const rules: BackgroundRule[] = [];

  for (const [filename, css] of cssContents) {
    try {
      const root = postcss.parse(css);
      processRules(root, filename, false, rules);
      // 也处理 @keyframes 中的规则
      root.walkAtRules(/keyframes/i, (atRule) => {
        if (atRule.nodes) {
          const kfRoot = postcss.parse(atRule.toString().replace(/@[^{]+\{/, '').replace(/\}$/, ''));
          processRules(kfRoot as Root, filename, true, rules);
        }
      });
    } catch (e: any) {
      // @import 等语句在 Phase 5 处理，暂时忽略
      if (e.message?.includes('At-rule')) continue;
      throw e;
    }
  }

  return rules;
}

function processRules(
  root: Root | { walkRules: Root['walkRules'] },
  file: string,
  inAnimation: boolean,
  results: BackgroundRule[],
): void {
  root.walkRules((rule: Rule) => {
    const bgDecls: Declaration[] = [];
    const sizeDecls: Declaration[] = [];

    for (const node of rule.nodes) {
      if (node.type === 'decl') {
        const decl = node as Declaration;
        if (decl.prop === 'background' || decl.prop === 'background-image') {
          bgDecls.push(decl);
        }
        if (decl.prop === 'background-size') {
          sizeDecls.push(decl);
        }
      }
    }

    for (const decl of bgDecls) {
      const parsed = analyseBackground(decl.value);
      if (!parsed.imageUrl) continue;

      // 检查 #unsprite
      if (isUnsprite(parsed.imageUrl)) continue;

      // 检查 background-size 已设置（非默认）
      const hasSize = sizeDecls.length > 0;

      // 检查 shouldSkip（repeat/position）
      if (shouldSkip(parsed)) continue;

      // 清理 URL
      const cleanUrl = cleanImageUrl(parsed.imageUrl);

      results.push({
        file,
        selector: rule.selector,
        imageUrl: cleanUrl,
        position: { x: parsed.positionX, y: parsed.positionY },
        repeat: parsed.repeat,
        node: rule,
        inAnimation,
        ...(hasSize ? { size: parseSizeDecl(sizeDecls[0]) } : {}),
      });
    }
  });
}

function parseSizeDecl(decl: Declaration): { w: number; h: number } {
  const parts = decl.value.split(/\s+/);
  const w = parseFloat(parts[0]) || 0;
  const h = parseFloat(parts[1]) || w;
  return { w, h };
}
