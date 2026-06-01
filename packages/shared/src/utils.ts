/**
 * 清理 CSS url() 中的图片路径
 * 去掉 query string、hash（保留 #unsprite 用于后续判断）
 */
export function cleanUrl(url: string): string {
  // 去掉 query string (?xxx)
  let cleaned = url.replace(/\?[^#]*/g, '');
  // 去掉非 #unsprite 的 hash
  cleaned = cleaned.replace(/#(?!unsprite).*/g, '');
  return cleaned;
}

/**
 * 检查图片路径是否匹配 glob 模式
 * 简单实现：支持 * 通配符
 */
export function matchGlob(pattern: string, path: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regex}$`).test(path);
}

/**
 * 检查路径是否匹配任一 glob 模式
 */
export function matchesAny(patterns: string | string[], path: string): boolean {
  const arr = Array.isArray(patterns) ? patterns : [patterns];
  return arr.some((p) => matchGlob(p, path));
}
