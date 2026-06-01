/** 待打包的图片块 */
export interface PackInput<T = unknown> {
  width: number;
  height: number;
  data: T;
}

/** 打包后的定位结果 */
export interface PackResult<T = unknown> {
  width: number;
  height: number;
  x: number;
  y: number;
  rotated: boolean;
  data: T;
}

/** 图片资产信息 */
export interface ImageAsset {
  url: string;
  buffer: Buffer;
  naturalWidth: number;
  naturalHeight: number;
  rules: BackgroundRule[];
}

import type { Rule } from 'postcss';

/** CSS background 规则提取结果 */
export interface BackgroundRule {
  file: string;
  selector: string;
  imageUrl: string;
  position: { x: number | string; y: number | string };
  size?: { w: number; h: number };
  repeat: string;
  node: Rule;
  inAnimation: boolean;
}

/** Spriter.run() 输入 */
export interface SpriterRunInput {
  css: Map<string, string>;
  images: Map<string, Buffer>;
  cssBaseDir: string;
  dryRun?: boolean;
}

/** 打包后的精灵图条目 */
export interface PackedSprite {
  spriteFile: string;
  canvasWidth: number;
  canvasHeight: number;
  items: Array<{
    asset: ImageAsset;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/** Spriter.run() 输出 */
export interface SpriterResult {
  cssFiles: Map<string, string>;
  spriteImages: Map<string, Buffer>;
  manifest: Map<
    string,
    { spriteFile: string; x: number; y: number; width: number; height: number }
  >;
  skippedImages: string[];
  /** Only present when dryRun=true */
  dryRunReport?: string;
}
