import postcss from 'postcss';
import postcssImport from 'postcss-import';
import { IspriterError } from '../error.js';

/**
 * 展开 CSS 中的 @import 语句
 * 将所有 @import 替换为实际内容
 */
export async function expandImports(
  css: string,
  fromFile: string,
): Promise<string> {
  try {
    const result = await postcss([postcssImport()]).process(css, { from: fromFile });
    return result.css;
  } catch (e: any) {
    throw new IspriterError(
      `Failed to expand @import in ${fromFile}: ${e.message}`,
      'CSS_PARSE_ERROR',
      { file: fromFile },
    );
  }
}
