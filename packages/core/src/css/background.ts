export interface ParsedBackground {
  imageUrl: string | null;
  positionX: string | number;
  positionY: string | number;
  repeat: string;
  size: string;
}

/**
 * 分析 background 简写属性
 * 提取 url、position、repeat、size
 */
export function analyseBackground(value: string): ParsedBackground {
  const result: ParsedBackground = {
    imageUrl: null,
    positionX: '0',
    positionY: '0',
    repeat: 'no-repeat',
    size: '',
  };

  // 提取 url()
  const urlMatch = value.match(/url\(['"]?([^'")]+)['"]?\)/);
  if (urlMatch) {
    result.imageUrl = urlMatch[1];
  }

  // 检测 repeat（no-repeat 必须先于 repeat 检测，因为 \brepeat\b 会匹配 no-repeat 中的 repeat）
  if (/\bno-repeat\b/i.test(value)) result.repeat = 'no-repeat';
  else if (/\brepeat-x\b/i.test(value)) result.repeat = 'repeat-x';
  else if (/\brepeat-y\b/i.test(value)) result.repeat = 'repeat-y';
  else if (/\brepeat\b/i.test(value)) result.repeat = 'repeat';

  // 检测 background-size
  const sizeMatch = value.match(/\/\s*(.+?)(?:\s|$)/);
  if (sizeMatch) {
    result.size = sizeMatch[1].trim();
  }

  // 提取 position（在 url 之后、repeat 之前的部分）
  if (result.imageUrl) {
    const afterUrl = value.replace(/url\([^)]*\)/, '').trim();
    const posTokens = afterUrl
      .split(/\s+/)
      .filter((t) => t && !['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'repeat-space'].includes(t))
      .filter((t) => !t.startsWith('/') && !t.startsWith('#'));

    if (posTokens.length >= 1) {
      result.positionX = parsePositionValue(posTokens[0]);
    }
    if (posTokens.length >= 2) {
      result.positionY = parsePositionValue(posTokens[1]);
    }
  }

  return result;
}

function parsePositionValue(val: string): string | number {
  if (val === 'left' || val === 'top') return 0;
  if (val === 'center') return 'center';
  if (val === 'right' || val === 'bottom') return '100%';
  const pxMatch = val.match(/^(-?\d+(?:\.\d+)?)px$/i);
  if (pxMatch) return Number(pxMatch[1]);
  if (val.endsWith('%')) return val;
  return val;
}

/**
 * 检查是否应该跳过该规则（right/center/bottom position 或 repeat）
 */
export function shouldSkip(parsed: ParsedBackground): boolean {
  // 跳过 repeat
  if (parsed.repeat === 'repeat' || parsed.repeat === 'repeat-x' || parsed.repeat === 'repeat-y') {
    return true;
  }
  // 跳过 right/center/bottom position
  if (parsed.positionX === '100%' || parsed.positionY === '100%') return true;
  if (parsed.positionX === 'center' && parsed.positionY === 'center') return true;
  // 跳过百分比 position（暂时不支持精确计算）
  if (typeof parsed.positionX === 'string' && parsed.positionX.endsWith('%') && parsed.positionX !== '100%') return true;
  if (typeof parsed.positionY === 'string' && parsed.positionY.endsWith('%') && parsed.positionY !== '100%') return true;
  return false;
}

/**
 * 清理 URL 中的 hash 和 query string
 */
export function cleanImageUrl(url: string): string {
  // 检查 #unsprite
  if (url.includes('#unsprite')) return url; // 保留标记，让上层判断
  let cleaned = url.replace(/\?[^#]*/g, '');
  cleaned = cleaned.replace(/#(?!unsprite).*/g, '');
  return cleaned;
}

/**
 * 判断是否为 #unsprite 标记
 */
export function isUnsprite(url: string): boolean {
  return url.includes('#unsprite');
}
