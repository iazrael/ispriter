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
import type { SpriterConfig, SpriterResult, SpriteTask } from './types.js';
import { parseConfig } from './config.js';
import { extractBackgrounds } from './css/parser.js';
import { generateSprite } from './image/sprite.js';
import { emitCSS } from './css/emitter.js';

export class Spriter {
  private config: ResolvedConfig;

  constructor(config: SpriterConfig) {
    this.config = parseConfig(config); // zod 校验，失败即抛 IspriterError
  }

  async run(cssContents: Map<string, string>): Promise<SpriterResult> {
    // 1. postcss 解析所有 CSS，提取 background 规则
    const tasks = this.buildSpriteTasks(cssContents);

    // 2. bin-packing 排列
    const packedTasks = this.packSprites(tasks);

    // 3. sharp 生成精灵图
    const imageOutputs = await this.generateImages(packedTasks);

    // 4. 更新 CSS 坐标 + 压缩
    const cssOutputs = this.emitCSS(packedTasks, cssContents);

    return { cssFiles: cssOutputs, spriteImages: imageOutputs, manifest: this.buildManifest(packedTasks) };
  }
}
```

**关键设计决策**：
- `run()` 接收 `Map<string, string>`（文件名 → 内容），不直接读文件。文件 I/O 由调用方（CLI/插件）负责
- 这样 core 是纯逻辑，方便测试，且构建插件可以对接虚拟文件系统
- 返回 `SpriterResult`，输出文件也由调用方写入

### 3.2 配置 Schema（core/src/config.ts）

```typescript
import { z } from 'zod';

export const SpriterConfigSchema = z.object({
  input: z.object({
    cssSource: z.union([z.string(), z.array(z.string())]),
    ignoreImages: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  output: z.object({
    cssDist: z.string(),
    imageDist: z.string(),
    format: z.enum(['png', 'webp']).default('png'),
    quality: z.number().min(1).max(100).default(80),  // WebP quality
    retina: z.union([z.literal(2), z.literal(3)]).optional(),
    maxSingleSize: z.number().positive().optional(),   // KB
    margin: z.number().nonnegative().default(2),
    compress: z.boolean().default(true),
    combine: z.boolean().default(false),
  }),
});

export type SpriterConfig = z.input<typeof SpriterConfigSchema>;
export type ResolvedConfig = z.output<typeof SpriterConfigSchema>;
```

支持最简配置：
```typescript
spriter.run({ input: './src/css/', output: './dist/css/' });
```

### 3.3 CSS 解析（core/src/css/parser.ts）

```typescript
import postcss from 'postcss';
import { analyseBackground } from './background.js';

export interface BackgroundRule {
  file: string;           // 所属 CSS 文件
  selector: string;       // CSS 选择器
  imageUrl: string;       // 原始图片路径
  position: { x: number; y: number };  // 原 background-position
  size?: { w: number; h: number };     // 原 background-size
  repeat: string;         // repeat 值
  node: postcss.Rule;     // postcss 节点引用（用于修改）
}

export function extractBackgrounds(
  filename: string,
  css: string
): BackgroundRule[] {
  const root = postcss.parse(css);
  const rules: BackgroundRule[] = [];

  root.walkRules((rule) => {
    // 遍历 decl，找 background/background-image
    // 过滤：排除 #unsprite、排除 repeat、排除 background-size
    // 返回结构化的 BackgroundRule[]
  });

  return rules;
}
```

### 3.4 Bin-Packing（core/src/packer.ts）

从 GrowingPacker 移植，加 TypeScript + strict：

```typescript
export interface PackInput {
  width: number;
  height: number;
  data: any;  // 关联的图片信息
}

export interface PackResult {
  width: number;
  height: number;
  x: number;
  y: number;
  data: any;
}

export function pack(blocks: PackInput[], margin: number): PackResult[] {
  // GrowingPacker 算法，带 margin 支持
  // 输入按面积降序排序
  // 返回每个块的最终坐标
}
```

### 3.5 图片生成（core/src/image/sprite.ts）

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

### 3.6 Retina 支持（core/src/image/retina.ts）

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

### 4.1 Vite 插件

```typescript
import type { Plugin } from 'vite';
import { Spriter } from '@ispriter/core';
import type { SpriterConfig } from '@ispriter/shared';

export default function ispriterVite(options: SpriterConfig): Plugin {
  return {
    name: '@ispriter/plugin-vite',
    async closeBundle() {
      const spriter = new Spriter(options);
      // 读取 CSS 文件 → run() → 写入输出
    },
    // Vite dev 模式下可跳过（精灵图是生产优化）
    apply: 'build',
  };
}
```

### 4.2 Webpack 插件

```typescript
import type { Compiler } from 'webpack';
import { Spriter } from '@ispriter/core';

export class IspriterWebpackPlugin {
  constructor(private options: SpriterConfig) {}

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapPromise('IspriterWebpackPlugin', async () => {
      const spriter = new Spriter(this.options);
      // run() + 写入
    });
  }
}
```

### 4.3 Rollup 插件

```typescript
import type { Plugin } from 'rollup';
import { Spriter } from '@ispriter/core';

export default function ispriterRollup(options: SpriterConfig): Plugin {
  return {
    name: '@ispriter/plugin-rollup',
    async closeBundle() {
      const spriter = new Spriter(options);
      // run() + 写入
    },
  };
}
```

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
- 图片错误：跳过 + warn，不阻塞其他图片
- CSS 解析错误：抛出带文件名 + 行号的结构化错误

---

## 7. 测试策略

| 层 | 框架 | 覆盖目标 | 重点 |
|----|------|----------|------|
| `core` | vitest | 80%+ | packer 算法、CSS 解析、配置校验 |
| `shared` | vitest | 90%+ | 纯函数，容易覆盖 |
| `cli` | vitest | 50%+ | 参数解析、流程集成 |
| `plugin-*` | vitest | 60%+ | mock 构建工具 hooks |

测试分类：
- **单元测试**：packer、config、background 解析
- **快照测试**：CSS 输出对比（输入 CSS → 期望输出 CSS）
- **E2E 测试**：完整流程（CSS + 图片 → 精灵图 + 更新后的 CSS）

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

### Phase 2: 核心逻辑
- types.ts 类型定义
- config.ts + zod schema
- packer.ts bin-packing 移植
- css/parser.ts postcss 解析
- css/background.ts 属性分析
- css/emitter.ts CSS 输出
- image/sprite.ts 精灵图生成

### Phase 3: CLI + 测试
- CLI 入口
- vitest 单元测试 + 快照测试
- E2E 测试（用原项目 examples 的素材）

### Phase 4: 构建插件
- plugin-vite
- plugin-webpack
- plugin-rollup

### Phase 5: 高级功能
- WebP 输出
- Retina @2x/@3x
- watch 模式
- @import 展开

---

## 10. 与 v0.3.x 的关系

- `master` 分支保留 v0.3.x 代码不动
- `fix/hotfix` 分支是 v0.3.x 的止血修复
- `feat/v2-rewrite` 分支是全新重写
- 重写完成后合并到 master，发布 v2.0.0
