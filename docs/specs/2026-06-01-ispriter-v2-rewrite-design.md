# iSpriter v2 重写设计文档

> 日期: 2026-06-01
> 分支: `feat/v2-rewrite`
> 状态: Draft

---

## 1. 背景与目标

### 1.1 现状

iSpriter v0.3.9 是一个 2013-2015 年的 Node.js CSS 精灵图合并工具，纯 ES5 JS，2200 行代码。审查发现 3 个 bug、1 个安全漏洞、全局状态泛滥、1483 行上帝模块、依赖全部过期、零测试零 CI。代码质量评分 3/10。

### 1.2 重写目标

从零重写 iSpriter，打造一个现代化的 CSS 精灵图工具：

- **个人项目**：不考虑向后兼容，可以大胆改
- **核心库优先**：纯逻辑 core + CLI/构建插件分层
- **主流构建工具集成**：Vite、Webpack、Rollup 插件
- **TypeScript + ESM**：全面类型安全
- **postcss 替代 CSSOM**：成熟生态，支持现代 CSS
- **sharp 替代 pngjs**：PNG/WebP 一把梭

### 1.3 不做的事

- 不兼容 v0.3.x API
- 不保留 bundledDependencies
- 不支持 Mod 构建工具
- 不做 source map（精灵图场景意义不大）
- 不做 Rspack/esbuild 插件（后续可扩展）

---

## 2. 架构设计

### 2.1 Monorepo 结构

使用 pnpm workspace 管理，6 个 package：

```
ispriter/
├── packages/
│   ├── core/                  # @ispriter/core — 核心逻辑库
│   │   ├── src/
│   │   │   ├── index.ts           # 公开 API
│   │   │   ├── spriter.ts         # Spriter 类，主流程编排
│   │   │   ├── config.ts          # 配置解析 + zod 校验
│   │   │   ├── packer.ts          # bin-packing 算法
│   │   │   ├── types.ts           # 核心类型定义
│   │   │   ├── css/
│   │   │   │   ├── parser.ts      # postcss 解析 CSS
│   │   │   │   ├── background.ts  # background 属性分析
│   │   │   │   └── emitter.ts     # CSS 输出（更新坐标）
│   │   │   └── image/
│   │   │       ├── sprite.ts      # 精灵图生成（sharp）
│   │   │       ├── output.ts      # PNG/WebP 输出
│   │   │       └── retina.ts      # @2x/@3x 多倍图
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                   # @ispriter/cli — 命令行工具
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugin-vite/           # @ispriter/plugin-vite
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugin-webpack/        # @ispriter/plugin-webpack
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── plugin-rollup/         # @ispriter/plugin-rollup
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                # @ispriter/shared — 共享类型 + 工具
│       ├── src/
│       │   ├── types.ts
│       │   └── utils.ts
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── package.json
├── vitest.config.ts
└── .github/
    └── workflows/
        └── ci.yml
```

### 2.2 包依赖关系

```
shared ← core ← cli
              ← plugin-vite
              ← plugin-webpack
              ← plugin-rollup
```

- `shared` 零依赖
- `core` 依赖：postcss、sharp、clean-css、zod
- `cli` 依赖：core + commander
- 插件 peerDep：各自构建工具

### 2.3 分层职责

| 层 | 职责 | 副作用 |
|----|------|--------|
| `shared` | 类型定义、纯工具函数 | ❌ |
| `core` | CSS 解析、图片处理、精灵图生成、坐标计算 | ✅ 最小（通过 IO 接口注入） |
| `cli` | 命令行参数解析、文件系统读写、日志输出 | ✅ |
| `plugin-*` | 对接构建工具 hooks、文件系统操作 | ✅ |

---

## 3. 核心模块设计

### 3.1 Spriter 类（core/src/spriter.ts）

```typescript
import type { ResolvedConfig, SpriterResult, PackedSprite, ImageAsset } from './types.js';
import { parseConfig } from './config.js';
import { extractBackgrounds } from './css/parser.js';
import { generateSprite } from './image/sprite.js';
import { emitCSS } from './css/emitter.js';

export interface SpriterRunInput {
  /** CSS 文件名 → 内容 */
  css: Map<string, string>;
  /** 图片相对路径 → Buffer。由调用方负责读取 CSS 中引用的所有图片 */
  images: Map<string, Buffer>;
  /** CSS 文件的 base 目录，用于解析图片相对路径 */
  cssBaseDir: string;
}

export interface SpriterResult {
  /** 输出的 CSS：文件名 → 内容 */
  cssFiles: Map<string, string>;
  /** 精灵图：文件名 → Buffer */
  spriteImages: Map<string, Buffer>;
  /** 图片映射表：原始路径 → { spriteFile, x, y, width, height } */
  manifest: Map<string, { spriteFile: string; x: number; y: number; width: number; height: number }>;
  /** 跳过的图片（读取失败等） */
  skippedImages: string[];
}

export class Spriter {
  private config: ResolvedConfig;

  constructor(config: SpriterConfig) {
    this.config = parseConfig(config); // zod 校验，失败即抛 IspriterError
  }

  async run(input: SpriterRunInput): Promise<SpriterResult> {
    // 1. postcss 解析所有 CSS，提取 background 规则
    const rules = extractBackgrounds(input.css, this.config);

    // 2. 过滤（排除/去重）+ 从 input.images 中匹配图片 Buffer
    const { tasks, skipped } = this.buildSpriteTasks(rules, input.images);

    // 3. bin-packing 排列
    const packedTasks: PackedSprite[] = this.packSprites(tasks);

    // 4. sharp 生成精灵图（PNG/WebP）
    const spriteImages = await this.generateImages(packedTasks);

    // 5. 可选：生成 retina 多倍图
    if (this.config.output.retina) {
      const retinaImages = await this.generateRetina(packedTasks, this.config.output.retina);
      // 合并到 spriteImages
    }

    // 6. 更新 CSS 坐标 + 压缩
    const cssFiles = emitCSS(packedTasks, input.css, this.config);

    // 7. 生成 manifest
    const manifest = this.buildManifest(packedTasks);

    return { cssFiles, spriteImages, manifest, skippedImages: skipped };
  }
}
```

**关键设计决策**：
- `run()` 接收 `SpriterRunInput`，包含 CSS 内容、图片 Buffer 和 CSS 基础目录。**不直接碰文件系统**。
- **调用方（CLI/插件）负责**：读取 CSS 文件、解析 CSS 中的图片路径、读取图片为 Buffer、将结果写入磁盘。
- 这样 core 是纯逻辑，方便测试（直接传内存数据），且构建插件可以对接虚拟文件系统。
- `SpriterResult` 返回的也是内存数据（`Map<string, Buffer>`），写入由调用方负责。

**图片路径解析规则**：
- CSS 中的 `url(../images/icon.png)` 相对路径由调用方根据 `cssBaseDir` 解析为绝对路径
- 调用方读取图片后，以**原始相对路径**为 key 存入 `input.images`
- core 内部用相对路径做去重和匹配

### 3.2 配置 Schema（core/src/config.ts）

```typescript
import { z } from 'zod';

export const SpriterConfigSchema = z.object({
  /** 工作目录，所有相对路径基于此解析 */
  workspace: z.string().default('./'),

  input: z.object({
    /** CSS 文件路径或 glob 列表 */
    cssSource: z.union([z.string(), z.array(z.string())]),
    /** 排除的图片，支持 glob 通配符 */
    ignoreImages: z.union([z.string(), z.array(z.string())]).optional(),
  }),

  output: z.object({
    /** CSS 输出目录 */
    cssDist: z.string(),
    /** 精灵图相对于 cssDist 的路径（写在 CSS 中的相对路径） */
    imageDist: z.string().default('./img/'),
    /** 输出图片格式 */
    format: z.enum(['png', 'webp']).default('png'),
    /** WebP 质量 (1-100) */
    quality: z.number().min(1).max(100).default(80),
    /** Retina 倍数 */
    retina: z.union([z.literal(2), z.literal(3)]).optional(),
    /** 单个精灵图最大大小，单位 KB (1024 bytes)，超限则拆分 */
    maxSingleSize: z.number().positive().optional(),
    /** 图片间距，单位 px */
    margin: z.number().nonnegative().default(2),
    /** 精灵图文件名前缀 */
    prefix: z.string().default('sprite_'),
    /** CSS 压缩（true 用默认配置，false 不压缩，对象用指定配置） */
    compress: z.union([z.boolean(), z.record(z.unknown())]).default(false),
    /**
     * 合并模式：
     * - false（默认）：每个 CSS 文件生成独立精灵图
     * - true：所有 CSS 中的图片合并为一张精灵图，所有 CSS 合并为一个文件
     * 注意：maxSingleSize 仍然生效，超限时也会拆分
     */
    combine: z.boolean().default(false),
    /**
     * 将使用同一精灵图的选择器合并为一条规则：
     * .cls1, .cls2 { background-image: url(sprite.png); }
     */
    combineCSSRule: z.boolean().default(true),
    /** 输出 CSS 中的 position 单位，默认 px，可设为 rem */
    unit: z.enum(['px', 'rem']).default('px'),
    /** rem 基准值，当 unit=rem 时生效。16 表示 1rem = 16px */
    remBase: z.number().positive().default(16),
  }),

  /**
   * 图片分组（解决 #28 #18）：
   * 可指定某些图片合并到特定精灵图中。
   * 不配置时按 CSS 文件自动分组（combine=true 时合并为一组）。
   */
  groups: z.array(z.object({
    name: z.string(),
    images: z.union([z.string(), z.array(z.string())]),
  })).optional(),
});

// 最简配置支持：字符串自动包装为标准结构
export function normalizeConfig(
  input: string | SpriterConfig
): z.input<typeof SpriterConfigSchema> {
  if (typeof input === 'string') {
    return { input: { cssSource: input }, output: { cssDist: input } };
  }
  return input;
}

export type SpriterConfig = z.input<typeof SpriterConfigSchema>;
export type ResolvedConfig = z.output<typeof SpriterConfigSchema>;
```

### 3.3 CSS 解析（core/src/css/parser.ts）

```typescript
import postcss from 'postcss';
import { analyseBackground } from './background.js';

export interface BackgroundRule {
  file: string;           // 所属 CSS 文件
  selector: string;       // CSS 选择器
  imageUrl: string;       // 原始图片路径
  position: { x: number | string; y: number | string };  // 支持 px 和百分比 (#13)
  size?: { w: number; h: number };     // 原 background-size
  repeat: string;         // repeat 值
  node: postcss.Rule;     // postcss 节点引用（用于修改）
  inAnimation: boolean;   // 是否在 @keyframes 中 (#14)
}

export function extractBackgrounds(
  cssContents: Map<string, string>,
  config: ResolvedConfig
): BackgroundRule[] {
  const rules: BackgroundRule[] = [];

  for (const [filename, css] of cssContents) {
    const root = postcss.parse(css);

    // 1. 遍历普通规则
    root.walkRules((rule) => {
      extractFromRule(rule, filename, false, rules);
    });

    // 2. 遍历 @keyframes 中的规则 (#14 animation 支持)
    root.walkAtRules(/keyframes/, (atRule) => {
      const keyframeRoot = postcss.parse(atRule.nodes);
      keyframeRoot.walkRules((rule) => {
        extractFromRule(rule, filename, true, rules);
      });
    });
  }

  return rules;
}

function extractFromRule(
  rule: postcss.Rule,
  file: string,
  inAnimation: boolean,
  results: BackgroundRule[]
): void {
  for (const decl of rule.nodes) {
    if (decl.prop === 'background' || decl.prop === 'background-image') {
      const url = extractUrl(decl.value);
      if (!url) continue;

      // 跳过 #unsprite 标记
      if (url.includes('#unsprite')) continue;

      // 跳过渐变 (#32) — linear-gradient / radial-gradient 等不是 url
      // extractUrl 只提取 url()，渐变自然被忽略

      // 跳过 repeat
      if (decl.prop === 'background' && /repeat/.test(decl.value)) continue;

      // 跳过 background-size 已设置的
      // (在 rule 级别检查是否有 background-size declaration)

      // 跳过 position 是 right/center/bottom 的情况
      // 但保留像素值 (#23: `415px center` 不应丢 415px)

      results.push({
        file,
        selector: rule.selector,
        imageUrl: cleanUrl(url),  // 去掉 hash 和 query string
        position: parsePosition(decl.value),
        repeat: parseRepeat(decl.value),
        node: rule,
        inAnimation,
      });
    }
  }
}
```

**关键设计决策**：
- 使用 postcss 精确解析，**只修改 `url()` 和 `background-position`**，不动其他属性（解决 #16 hack 样式消失）
- **渐变**（`linear-gradient`）不是 `url()` 调用，天然被忽略（解决 #32）
- **animation 中的背景图**也会被提取和处理（解决 #14）
- **`background-position` 使用标准短写法**，不用 `-x` / `-y` 拆分（解决 #26 Firefox 兼容）
- **center + px 混合**时保留 px 值不变（解决 #23）
- 百分比 position 支持标记，Phase 5 完整实现（#13）

### 3.4 Bin-Packing（core/src/packer.ts）

从 GrowingPacker 移植，加 TypeScript + strict：

```typescript
/** 待打包的图片块 */
export interface PackInput<T = ImageAsset> {
  width: number;
  height: number;
  data: T;  // 关联的图片资产信息（泛型，默认 ImageAsset）
}

/** 打包后的定位结果 */
export interface PackResult<T = ImageAsset> {
  width: number;
  height: number;
  x: number;
  y: number;
  rotated: boolean;
  data: T;
}

/** 图片资产信息 */
export interface ImageAsset {
  /** 图片原始相对路径（CSS 中的 url） */
  url: string;
  /** 图片 Buffer */
  buffer: Buffer;
  /** 图片实际像素尺寸 */
  naturalWidth: number;
  naturalHeight: number;
  /** 引用该图片的 CSS 规则列表 */
  rules: BackgroundRule[];
}

export function pack<T>(blocks: PackInput<T>[], margin: number): PackResult<T>[] {
  // GrowingPacker 算法，带 margin 支持
  // 输入按面积降序排序
  // 返回每个块的最终坐标
}
```

### 3.5 图片读取（调用方职责）

core 不负责文件 I/O。图片读取由调用方完成：

```typescript
// CLI/插件中的示例
async function loadImages(
  cssContents: Map<string, string>,
  cssBaseDir: string
): Promise<Map<string, Buffer>> {
  const images = new Map<string, Buffer>();
  // 1. 解析所有 CSS 中的 background url()
  // 2. 将相对路径转为绝对路径：path.resolve(cssBaseDir, url)
  // 3. 读取文件为 Buffer
  // 4. 以原始相对路径为 key 存储
  return images;
}
```

对于 Retina 图片，命名约定为 `icon@2x.png` / `icon@3x.png`：
- 当配置 `retina: 2` 时，调用方同时查找 `icon.png` 和 `icon@2x.png`
- 如果 `@2x` 版本存在，使用高清版本；否则用普通版本放大
- 高清版和普通版分别生成独立精灵图，CSS 中通过 `background-size` 适配

### 3.6 图片生成（core/src/image/sprite.ts）

```typescript
import sharp from 'sharp';

export async function generateSprite(
  images: { buffer: Buffer; x: number; y: number; width: number; height: number }[],
  canvasWidth: number,
  canvasHeight: number,
  format: 'png' | 'webp',
  quality: number
): Promise<Buffer> {
  const channels = 4; // RGBA
  const canvas = Buffer.alloc(canvasWidth * canvasHeight * channels);

  for (const img of images) {
    const raw = await sharp(img.buffer).raw().toBuffer();
    // 将 raw 像素写入 canvas 对应位置（带 margin）
  }

  return sharp(canvas, { raw: { width: canvasWidth, height: canvasHeight, channels } })
    .toFormat(format, { quality })
    .toBuffer();
}
```

### 3.7 Retina 支持（core/src/image/retina.ts）

```typescript
export async function generateRetinaSprite(
  images: SpriteImage[],
  scale: 2 | 3,
  format: 'png' | 'webp'
): Promise<{ image: Buffer; width: number; height: number }> {
  // 1. 将所有图片放大 scale 倍
  // 2. 用放大后的尺寸重新 pack
  // 3. 生成精灵图
  // 4. CSS 中设置 background-size 为实际尺寸的 1/scale
}
```

---

## 4. 构建插件设计

### 4.1 插件通用工作流

所有构建插件遵循相同的后处理模式：

```
构建完成 → 插件读取输出的 CSS 文件 → 收集图片引用 → 读取图片 Buffer
→ new Spriter(config).run(input) → 写入精灵图 + 更新后的 CSS
```

**为什么用后处理而非管线中间插入？**
- 精灵图合并需要看到所有 CSS 的完整内容才能做全局去重和最优排列
- 管线中间插入需要和构建工具的文件解析/输出系统深度集成，复杂且各工具差异大
- 后处理简单可靠，所有构建工具都支持

### 4.2 Vite 插件

```typescript
import type { Plugin, ResolvedConfig as ViteConfig } from 'vite';
import { Spriter } from '@ispriter/core';
import type { SpriterConfig } from '@ispriter/shared';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';

export default function ispriterVite(options: SpriterConfig): Plugin {
  let viteConfig: ViteConfig;

  return {
    name: '@ispriter/plugin-vite',
    apply: 'build',

    configResolved(config) {
      viteConfig = config;
    },

    async closeBundle() {
      // 1. 从输出目录读取所有匹配的 CSS
      const cssDir = path.resolve(viteConfig.build.outDir, options.output.cssDist);
      const cssFiles = await glob('**/*.css', { cwd: cssDir });

      const css = new Map<string, string>();
      for (const file of cssFiles) {
        css.set(file, await readFile(path.join(cssDir, file), 'utf-8'));
      }

      // 2. 收集并读取图片
      const images = await loadImages(css, cssDir);

      // 3. 执行精灵图合并
      const spriter = new Spriter(options);
      const result = await spriter.run({ css, images, cssBaseDir: cssDir });

      // 4. 写入输出
      const imgDir = path.resolve(viteConfig.build.outDir, options.output.imageDist);
      await mkdir(imgDir, { recursive: true });
      for (const [name, buf] of result.spriteImages) {
        await writeFile(path.join(imgDir, name), buf);
      }
      for (const [name, content] of result.cssFiles) {
        await writeFile(path.join(cssDir, name), content);
      }
    },
  };
}
```

### 4.3 Webpack 插件

```typescript
import type { Compiler } from 'webpack';
import { Spriter } from '@ispriter/core';
import type { SpriterConfig } from '@ispriter/shared';

export class IspriterWebpackPlugin {
  constructor(private options: SpriterConfig) {}

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapPromise('IspriterWebpackPlugin', async () => {
      const outDir = compiler.outputPath;
      // 同样的后处理流程：读取 CSS → 收集图片 → run() → 写入
    });
  }
}
```

### 4.4 Rollup 插件

```typescript
import type { Plugin } from 'rollup';
import { Spriter } from '@ispriter/core';
import type { SpriterConfig } from '@ispriter/shared';

export default function ispriterRollup(options: SpriterConfig): Plugin {
  return {
    name: '@ispriter/plugin-rollup',
    async closeBundle() {
      // 同样的后处理流程
    },
  };
}
```

**可抽取 `packages/shared/src/plugin-helper.ts`**：封装图片收集、文件写入等通用逻辑，三个插件共用。

---

## 5. CLI 设计

```bash
# 通过配置文件
ispriter -c config.json

# 通过参数
ispriter -f style.css,style2.css -o ./dist/css/

# watch 模式
ispriter -c config.json --watch
```

```typescript
// packages/cli/src/index.ts
import { Command } from 'commander';
import { Spriter } from '@ispriter/core';
import { readFile, writeFile, glob } from 'node:fs/promises';

const program = new Command();

program
  .option('-c, --config <path>', 'config file path')
  .option('-f, --files <paths>', 'CSS files (comma separated)')
  .option('-o, --output <path>', 'output directory')
  .option('--watch', 'watch mode')
  .action(async (opts) => {
    // 解析配置 → 读取文件 → new Spriter(config).run() → 写入
  });
```

---

## 6. 错误处理

```typescript
export class IspriterError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IspriterError';
  }
}

// 错误码
type ErrorCode =
  | 'CONFIG_INVALID'      // zod 校验失败
  | 'CSS_PARSE_ERROR'     // postcss 解析失败
  | 'IMAGE_READ_ERROR'    // sharp 读取失败
  | 'IMAGE_NOT_FOUND'     // 图片文件不存在
  | 'PACK_ERROR'          // bin-packing 失败（超出限制等）
  | 'OUTPUT_ERROR';       // 写入失败
```

- 配置错误：启动即报，不运行时崩溃
- 图片错误：跳过该图片 + warn，对应 CSS 规则**保持原样不动**（保留原始 background-image 和 position），不阻塞其他图片处理。`SpriterResult.skippedImages` 记录所有跳过的图片路径，供调用方决策
- CSS 解析错误：抛出带文件名 + 行号的结构化错误

---

## 7. 测试策略

### 7.1 框架与覆盖率

| 层 | 框架 | 覆盖目标 | 重点 |
|----|------|----------|------|
| `core` | vitest | 80%+ | packer 算法、CSS 解析、配置校验、图片处理 |
| `shared` | vitest | 90%+ | 类型、工具函数、插件 helper |
| `cli` | vitest | 50%+ | 参数解析、流程集成 |
| `plugin-*` | vitest | 60%+ | mock 构建工具 hooks |

### 7.2 功能测试用例矩阵

> 每个功能至少一个自动化测试用例。E2E 测试使用 fixtures 目录下的测试素材。

#### F1: CSS background 解析

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F1.1 | 提取 background-image url | `background: url(img/icon.png)` | `[{imageUrl: 'img/icon.png'}]` | 单元 |
| F1.2 | 提取 background 简写 | `background: #fff url(img/a.png) no-repeat 0 0` | 正确拆分 url/position/repeat | 单元 |
| F1.3 | 跳过 #unsprite | `background: url(img/a.png#unsprite)` | 不提取 | 单元 |
| F1.4 | 跳过 repeat | `background: url(img/a.png) repeat` | 不提取 | 单元 |
| F1.5 | 跳过 background-size | 有 `background-size: 20px` 的规则 | 不提取 | 单元 |
| F1.6 | 跳过渐变 | `background-image: linear-gradient(...)` | 不提取（#32） | 单元 |
| F1.7 | 多个渐变共存 | 渐变 + url 同时存在 | 只提取 url，渐变不动（#32） | 单元 |
| F1.8 | animation 中的背景图 | `@keyframes { from { background: url(a.png) } }` | 正确提取（#14） | 单元 |
| F1.9 | center + px 混合 | `background: url(a.png) 415px center` | 保留 415px（#23） | 单元 |
| F1.10 | 跳过 right/center/bottom position | `background-position: right center` | 不提取 | 单元 |
| F1.11 | url 带查询参数和 hash | `url(../img/a.png?t=123#hash)` | 清理为 `../img/a.png` | 单元 |
| F1.12 | @import 语句（Phase 5） | `@import 'other.css'` | warn + 忽略（Phase 5 展开） | 单元 |

#### F2: 配置解析

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F2.1 | 最简字符串配置 | `'./css/'` | 自动包装为标准结构 | 单元 |
| F2.2 | 缺少必填字段 | `{ output: {...} }` | 抛出 CONFIG_INVALID | 单元 |
| F2.3 | 默认值填充 | `{ input: {cssSource: 'a.css'}, output: {cssDist: 'out/'} }` | format='png', margin=2 等 | 单元 |
| F2.4 | workspace 解析 | `workspace: '../'` | 相对路径正确解析 | 单元 |
| F2.5 | ignoreImages glob | `ignoreImages: ['icons/*', 'logo.png']` | 正确匹配 | 单元 |
| F2.6 | groups 配置 | `groups: [{name: 'nav', images: 'nav/*'}]` | 解析正确 | 单元 |
| F2.7 | unit=rem 配置 | `unit: 'rem', remBase: 16` | 校验通过 | 单元 |

#### F3: 图片去重

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F3.1 | 同一图片多选择器引用 | `.a{bg: url(x.png)} .b{bg: url(x.png)}` | 只打包一次，多选择器共享 | 单元 |
| F3.2 | 不同路径同内容 | `url(./a.png)` 和 `url(../img/a.png)` 同一文件 | 内容 hash 去重 | 单元 |

#### F4: Bin-packing 排列

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F4.1 | 3 个不同尺寸图片 | 100x100, 50x50, 200x80 | 无重叠，画布紧凑 | 单元 |
| F4.2 | margin 间距 | margin=5 | 相邻图片间距 5px | 单元 |
| F4.3 | 按面积降序排列 | 随机输入顺序 | 结果与降序一致 | 单元 |
| F4.4 | 单张图片 | 100x100 | 坐标 (0,0) | 单元 |
| F4.5 | 空输入 | `[]` | 空结果 | 单元 |

#### F5: 精灵图生成

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F5.1 | PNG 输出 | 3 张 PNG | 合并为一张 PNG | E2E |
| F5.2 | WebP 输出 | format='webp' | 输出 WebP 格式 | E2E |
| F5.3 | maxSingleSize 拆分 | 超 60KB 的合并图 | 拆分为多张 | E2E |
| F5.4 | GIF 图片输入 | icon.gif | 正确读取并合并（#21） | E2E |
| F5.5 | 图片读取失败 | 不存在的图片 | 跳过 + warn + skippedImages 记录 | 单元 |

#### F6: CSS 输出

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F6.1 | 更新 background-position | 合并后的坐标 | `background-position: -10px -20px` | 快照 |
| F6.2 | 更新 background-image url | 精灵图路径 | `background-image: url(../img/sprite_0.png)` | 快照 |
| F6.3 | combineCSSRule=true | 多选择器同一精灵图 | `.a, .b { background-image: url(sprite.png) }` | 快照 |
| F6.4 | combineCSSRule=false | 多选择器同一精灵图 | 各自保留独立 `background-image` | 快照 |
| F6.5 | compress=true | 输出 CSS | 压缩为单行 | 快照 |
| F6.6 | compress=false | 输出 CSS | 保留格式 | 快照 |
| F6.7 | unit=rem | 坐标 10px | `background-position: -0.625rem` (16px base) | 快照 |
| F6.8 | hack 样式保留 | CSS 含 IE hack | hack 不动（#16） | 快照 |
| F6.9 | 渐变保留 | CSS 含 linear-gradient | 渐变不变（#32） | 快照 |
| F6.10 | 标准 background-position | 原始短写法 | 用标准短写法不用 `-x`/`-y`（#26） | 快照 |

#### F7: 合并模式

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F7.1 | combine=false（默认） | 2 个 CSS 文件 | 2 张精灵图 + 2 个 CSS | E2E |
| F7.2 | combine=true | 2 个 CSS 文件 | 1 张精灵图 + 1 个合并 CSS | E2E |
| F7.3 | combine=true + maxSingleSize | 大量图片 | 多张精灵图 + 1 个 CSS | E2E |

#### F8: 分组（#28 #18）

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F8.1 | 按目录分组 | `groups: [{name: 'nav', images: 'nav/*'}]` | nav 单独精灵图 | E2E |
| F8.2 | 多分组 | 2 个 groups | 2 张独立精灵图 | E2E |
| F8.3 | 未分组图片 | 有 groups 但不匹配的图片 | 归入默认精灵图 | E2E |

#### F9: Retina（#29）

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F9.1 | @2x 命名 | `icon@2x.png` 存在 | 高清版 + `background-size` | E2E |
| F9.2 | 无 @2x 版本 | 只有 `icon.png` | 放大生成 @2x | E2E |
| F9.3 | @3x | retina=3 | 三倍图 + 正确 background-size | E2E |

#### F10: 排除图片

| 用例 ID | 描述 | 输入 | 期望输出 | 类型 |
|---------|------|------|----------|------|
| F10.1 | #unsprite 标记 | `url(a.png#unsprite)` | 不合并，保留原样 | 单元 |
| F10.2 | ignoreImages glob | `ignoreImages: 'icons/*'` | 匹配的不合并 | 单元 |
| F10.3 | ignoreImages 数组 | `ignoreImages: ['a.png', 'b/*']` | 多规则匹配 | 单元 |

#### F11: 完整 E2E

| 用例 ID | 描述 | 测试素材来源 |
|---------|------|------------|
| E2E.1 | 单个 CSS + 多张图片 | examples/single |
| E2E.2 | 多个 CSS + 合并模式 | examples/multi |
| E2E.3 | GIF 图片 | examples/include-gif |
| E2E.4 | @import CSS | examples/import-css |
| E2E.5 | maxSingleSize 限制 | examples/limit-image-size |
| E2E.6 | 多倍图 + 合并 | examples/multi-combine |
| E2E.7 | animation 背景图 | 自建 fixture |

### 7.3 测试目录结构

```
tests/
├── fixtures/              # 共享测试素材
│   ├── images/            # 标准测试图片（PNG/GIF/各尺寸）
│   ├── retina/            # @2x/@3x 图片
│   └── css/               # 标准测试 CSS
├── unit/                  # 单元测试
│   ├── packer.test.ts
│   ├── config.test.ts
│   ├── parser.test.ts
│   ├── background.test.ts
│   ├── emitter.test.ts
│   └── sprite.test.ts
├── snapshot/              # 快照测试
│   └── css-output.test.ts
└── e2e/                   # 端到端测试
    ├── basic.test.ts
    ├── combine.test.ts
    ├── groups.test.ts
    ├── retina.test.ts
    └── examples.test.ts   # 用原 examples 目录素材
```

**测试原则**：
- 每个功能有至少一个自动化测试用例
- 单元测试用内存数据（不读文件）
- E2E 测试使用实际文件（复用原 examples 素材）
- 快照测试锁定 CSS 输出，防止回归
- CI 中 `vitest run` 全量执行

---

## 8. 依赖清单

### 生产依赖

| 包 | 版本 | 用途 |
|----|------|------|
| postcss | ^8.x | CSS 解析 |
| sharp | ^0.33.x | 图片处理 |
| commander | ^12.x | CLI 框架 |
| clean-css | ^5.x | CSS 压缩 |
| zod | ^3.x | 配置校验 |
| chokidar | ^4.x | watch 模式（CLI） |

### 开发依赖

| 包 | 用途 |
|----|------|
| typescript | 编译 |
| vitest | 测试 |
| eslint + prettier | 代码规范 |
| tsup | 构建（ESM + CJS 双格式） |

---

## 9. 实施阶段

### Phase 1: 基础设施（脚手架）
- pnpm monorepo 初始化
- tsconfig / eslint / prettier 配置
- GitHub Actions CI
- packages/shared 骨架

### Phase 2: 核心逻辑 + 测试
- types.ts 类型定义（ImageAsset、PackInput/PackResult 泛型、SpriterRunInput、SpriterResult）
- config.ts + zod schema + normalizeConfig → F2 测试
- packer.ts bin-packing 移植（泛型版本）→ F4 测试
- css/parser.ts postcss 解析（`@import` 初始策略：**忽略并 warn**，Phase 5 展开）→ F1 测试
- css/background.ts 属性分析（渐变忽略、animation 支持、position 精确）→ F1 测试
- css/emitter.ts CSS 输出（跳过图片保持原样、标准 position 短写法、combineCSSRule、unit 支持）→ F6 测试
- image/sprite.ts 精灵图生成（sharp、GIF 支持）→ F5 测试
- 去重逻辑 → F3 测试
- 排除逻辑 → F10 测试

### Phase 3: CLI + E2E 测试
- CLI 入口
- E2E 测试（用原 examples 素材）→ E2E.1 ~ E2E.7
- 合并模式测试 → F7 测试
- 快照测试锁定输出 → F6 快照

### Phase 4: 构建插件 + 分组
- plugin-vite
- plugin-webpack
- plugin-rollup
- groups 分组功能（#28 #18）→ F8 测试

### Phase 5: 高级功能
- WebP 输出（image/output.ts format=webp + quality 配置）→ F5.2 测试
- Retina @2x/@3x（命名约定 `icon@2x.png`，独立精灵图 + background-size）→ F9 测试
- watch 模式（CLI 层 chokidar，检测 CSS/图片变化触发重新 run）
- @import 展开（postcss-import 插件集成）
- 百分比 background-position 支持（#13）

### Phase 6: Issue 关闭清单

重写完成后可关闭的 GitHub Issues：
- #32 渐变色兼容 → postcss 不动非 url() 渐变，自动解决
- #29 支持 retina → Phase 5 实现
- #28 支持分组 → groups 配置
- #27 config 配置单位 → unit + remBase 配置
- #26 图片定位不正确 → 标准 background-position，不用 -x/-y
- #23 center + px 丢失 → postcss 精确解析
- #21 GIF 不能合 → sharp 原生支持 GIF
- #18 指定图片分组 → groups 配置
- #16 hack 样式消失 → postcss 只改 url 和 position
- #14 animation 背景图 → parser 遍历 @keyframes
- #13 百分比 position → Phase 5 实现

---

## 10. 与 v0.3.x 的关系

- `master` 分支保留 v0.3.x 代码不动
- `fix/hotfix` 分支是 v0.3.x 的止血修复
- `feat/v2-rewrite` 分支是全新重写
- 重写完成后合并到 master，发布 v2.0.0
