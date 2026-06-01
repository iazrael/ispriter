# iSpriter v2 Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite iSpriter from scratch as a modern TypeScript monorepo — core library (CSS sprite generation) + CLI + Vite/Webpack/Rollup plugins — closing 11 open GitHub issues.

**Architecture:** pnpm monorepo with 6 packages (`shared`, `core`, `cli`, `plugin-vite`, `plugin-webpack`, `plugin-rollup`). Core is pure logic (no filesystem I/O); CLI and plugins handle file reading/writing. CSS parsing via postcss, image processing via sharp, config validation via zod.

**Tech Stack:** TypeScript 5.x, ESM, pnpm workspaces, vitest, tsup, postcss, sharp, zod, commander, clean-css, chokidar

---

## File Structure Map

### Root config files
| File | Responsibility |
|------|---------------|
| `pnpm-workspace.yaml` | Workspace packages declaration |
| `package.json` | Root scripts, devDependencies |
| `tsconfig.base.json` | Shared TS compiler options |
| `vitest.config.ts` | Shared vitest config |
| `.github/workflows/ci.yml` | CI pipeline |
| `.prettierrc` | Prettier config |
| `.eslintrc.cjs` | ESLint config |

### packages/shared
| File | Responsibility |
|------|---------------|
| `packages/shared/package.json` | Package manifest |
| `packages/shared/tsconfig.json` | Extends base |
| `packages/shared/src/types.ts` | Shared type definitions (SpriterConfig, ResolvedConfig, ErrorCode) |
| `packages/shared/src/utils.ts` | Pure utility functions (cleanUrl, micromatch glob matching) |
| `packages/shared/src/index.ts` | Re-export barrel |

### packages/core
| File | Responsibility |
|------|---------------|
| `packages/core/package.json` | Package manifest |
| `packages/core/tsconfig.json` | Extends base |
| `packages/core/src/types.ts` | Core types (ImageAsset, PackInput, PackResult, BackgroundRule, SpriterRunInput, SpriterResult, PackedSprite) |
| `packages/core/src/error.ts` | IspriterError class |
| `packages/core/src/config.ts` | zod schema + parseConfig + normalizeConfig |
| `packages/core/src/packer.ts` | Bin-packing algorithm (GrowingPacker) |
| `packages/core/src/css/parser.ts` | postcss CSS parsing → BackgroundRule extraction |
| `packages/core/src/css/background.ts` | Background property analysis (url extraction, position parsing, repeat detection) |
| `packages/core/src/css/emitter.ts` | CSS output (update coordinates, combineCSSRule, compress, unit conversion) |
| `packages/core/src/image/sprite.ts` | Sprite image generation (sharp composite) |
| `packages/core/src/image/output.ts` | PNG/WebP output format handling |
| `packages/core/src/spriter.ts` | Spriter class — main orchestrator |
| `packages/core/src/index.ts` | Public API barrel |
| `packages/core/test/config.test.ts` | Config tests (F2) |
| `packages/core/test/packer.test.ts` | Packer tests (F4) |
| `packages/core/test/parser.test.ts` | CSS parser tests (F1) |
| `packages/core/test/background.test.ts` | Background analysis tests (F1) |
| `packages/core/test/emitter.test.ts` | CSS emitter tests (F6) |
| `packages/core/test/sprite.test.ts` | Sprite generation tests (F5) |
| `packages/core/test/dedupe.test.ts` | Deduplication tests (F3) |
| `packages/core/test/exclude.test.ts` | Exclusion tests (F10) |
| `packages/core/test/spriter.test.ts` | Integration tests (Spriter.run) |

### packages/cli
| File | Responsibility |
|------|---------------|
| `packages/cli/package.json` | Package manifest |
| `packages/cli/tsconfig.json` | Extends base |
| `packages/cli/src/index.ts` | CLI entry (commander) |

### packages/plugin-vite, plugin-webpack, plugin-rollup
| File | Responsibility |
|------|---------------|
| `packages/plugin-{vite,webpack,rollup}/package.json` | Package manifest |
| `packages/plugin-{vite,webpack,rollup}/tsconfig.json` | Extends base |
| `packages/plugin-{vite,webpack,rollup}/src/index.ts` | Plugin implementation |

### Test fixtures
| Directory | Responsibility |
|-----------|---------------|
| `tests/fixtures/images/` | Standard test PNGs (small, different sizes) |
| `tests/fixtures/retina/` | @2x/@3x test images |
| `tests/fixtures/css/` | Standard test CSS snippets |
| `tests/e2e/` | E2E tests using original `test/` directory |

---

## Phase 1: Scaffolding (Monorepo Init)

### Task 1.1: Initialize pnpm monorepo

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.prettierrc`
- Create: `.gitignore` (update)

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 2: Create root package.json**

```json
{
  "name": "ispriter",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint 'packages/*/src/**/*.ts'",
    "format": "prettier --write 'packages/*/src/**/*.ts'"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.1.0",
    "tsup": "^8.4.0",
    "eslint": "^9.16.0",
    "prettier": "^3.4.0",
    "@types/node": "^22.10.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 4: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 5: Install dependencies**

```bash
cd /Users/azrael/.openclaw/workspace/projects/ispriter
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .prettierrc
git commit -m "chore: init pnpm monorepo with base config"
```

### Task 1.2: Create packages/shared skeleton

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/utils.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ispriter/shared",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  },
  "devDependencies": {
    "tsup": "workspace:*"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/types.ts — shared config types**

```typescript
import { z } from 'zod';

/** 原始用户输入配置（zod input type） */
export const SpriterConfigSchema = z.object({
  workspace: z.string().default('./'),
  input: z.object({
    cssSource: z.union([z.string(), z.array(z.string())]),
    ignoreImages: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  output: z.object({
    cssDist: z.string(),
    imageDist: z.string().default('./img/'),
    format: z.enum(['png', 'webp']).default('png'),
    quality: z.number().min(1).max(100).default(80),
    retina: z.union([z.literal(2), z.literal(3)]).optional(),
    maxSingleSize: z.number().positive().optional(),
    margin: z.number().nonnegative().default(2),
    prefix: z.string().default('sprite_'),
    compress: z.union([z.boolean(), z.record(z.unknown())]).default(false),
    combine: z.boolean().default(false),
    combineCSSRule: z.boolean().default(true),
    unit: z.enum(['px', 'rem']).default('px'),
    remBase: z.number().positive().default(16),
  }),
  groups: z
    .array(
      z.object({
        name: z.string(),
        images: z.union([z.string(), z.array(z.string())]),
      }),
    )
    .optional(),
});

export type SpriterConfig = z.input<typeof SpriterConfigSchema>;
export type ResolvedConfig = z.output<typeof SpriterConfigSchema>;

/** 错误码 */
export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'CSS_PARSE_ERROR'
  | 'IMAGE_READ_ERROR'
  | 'IMAGE_NOT_FOUND'
  | 'PACK_ERROR'
  | 'OUTPUT_ERROR';
```

Wait — `shared` should be zero-dependency per the spec. zod is a dependency. Let me reconsider: config types with zod schema should live in `core`, not `shared`. `shared` only has pure type interfaces and zero-dep utility functions.

- [ ] **Step 3 (revised): Create src/types.ts — pure interface types**

```typescript
/** 错误码 */
export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'CSS_PARSE_ERROR'
  | 'IMAGE_READ_ERROR'
  | 'IMAGE_NOT_FOUND'
  | 'PACK_ERROR'
  | 'OUTPUT_ERROR';
```

- [ ] **Step 4: Create src/utils.ts**

```typescript
/**
 * 清理 URL 中的查询参数和 hash
 * url(../img/a.png?t=123#hash) → ../img/a.png
 */
export function cleanUrl(url: string): string {
  return url.split('?')[0].split('#')[0];
}

/**
 * 简单的 glob 模式匹配
 * 支持 * 通配符，不支持 **
 * micromatch 太重，这里用简单实现
 */
export function matchGlob(pattern: string, input: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${regexStr}$`).test(input);
}

/**
 * 检查路径是否匹配任一 glob 模式
 */
export function matchesAny(patterns: string[], input: string): boolean {
  return patterns.some((p) => matchGlob(p, input));
}
```

- [ ] **Step 5: Create src/index.ts**

```typescript
export type { ErrorCode } from './types.js';
export { cleanUrl, matchGlob, matchesAny } from './utils.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): add package skeleton with types and utils"
```

### Task 1.3: Create packages/core skeleton

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@ispriter/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@ispriter/shared": "workspace:*",
    "postcss": "^8.5.0",
    "sharp": "^0.33.0",
    "zod": "^3.24.0",
    "clean-css": "^5.3.0"
  },
  "devDependencies": {
    "tsup": "workspace:*",
    "@types/clean-css": "^4.2.11"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add package skeleton"
```

### Task 1.4: Create vitest config and CI

**Files:**
- Create: `vitest.config.ts`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['packages/*/test/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

- [ ] **Step 2: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main, feat/v2-rewrite]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: pnpm
      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts .github/
git commit -m "chore: add vitest config and GitHub Actions CI"
```

**Checkpoint:** Monorepo structure is ready. `pnpm install` succeeds. CI pipeline configured. All 6 package directories exist.

---

## Phase 2: Core Logic (TDD)

### Task 2.1: Core types + IspriterError

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/error.ts`

- [ ] **Step 1: Write test for IspriterError**

Create `packages/core/test/error.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { IspriterError } from '../src/error.js';

describe('IspriterError', () => {
  it('should have correct name and code', () => {
    const err = new IspriterError('test message', 'CONFIG_INVALID');
    expect(err.name).toBe('IspriterError');
    expect(err.code).toBe('CONFIG_INVALID');
    expect(err.message).toBe('test message');
  });

  it('should carry context', () => {
    const err = new IspriterError('fail', 'CSS_PARSE_ERROR', { file: 'a.css', line: 10 });
    expect(err.context).toEqual({ file: 'a.css', line: 10 });
  });

  it('should be instanceof Error', () => {
    const err = new IspriterError('x', 'PACK_ERROR');
    expect(err).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/error.test.ts
```

Expected: FAIL — `../src/error.js` does not exist.

- [ ] **Step 3: Implement error.ts**

Create `packages/core/src/error.ts`:

```typescript
import type { ErrorCode } from '@ispriter/shared';

export class IspriterError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'IspriterError';
  }
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/error.test.ts
```

- [ ] **Step 5: Create types.ts**

Create `packages/core/src/types.ts`:

```typescript
import type postcss from 'postcss';

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
  /** CSS 中的 url 路径（相对路径） */
  url: string;
  /** 图片 Buffer */
  buffer: Buffer;
  /** 实际像素尺寸 */
  naturalWidth: number;
  naturalHeight: number;
  /** 引用该图片的 CSS 规则 */
  rules: BackgroundRule[];
}

/** CSS background 规则提取结果 */
export interface BackgroundRule {
  file: string;
  selector: string;
  imageUrl: string;
  position: { x: number | string; y: number | string };
  size?: { w: number; h: number };
  repeat: string;
  node: unknown; // postcss.Rule — 用 unknown 避免在类型层强依赖
  inAnimation: boolean;
}

/** Spriter.run() 输入 */
export interface SpriterRunInput {
  css: Map<string, string>;
  images: Map<string, Buffer>;
  cssBaseDir: string;
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
  manifest: Map<string, { spriteFile: string; x: number; y: number; width: number; height: number }>;
  skippedImages: string[];
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/error.ts packages/core/test/error.test.ts
git commit -m "feat(core): add core types and IspriterError"
```

### Task 2.2: Config parsing with zod

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/test/config.test.ts`

- [ ] **Step 1: Write config tests**

Create `packages/core/test/config.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseConfig, normalizeConfig } from '../src/config.js';
import { IspriterError } from '../src/error.js';

const validConfig = {
  input: { cssSource: 'style.css' },
  output: { cssDist: './dist/' },
};

describe('normalizeConfig', () => {
  it('should wrap string into standard structure', () => {
    const result = normalizeConfig('./css/');
    expect(result.input.cssSource).toBe('./css/');
    expect(result.output.cssDist).toBe('./css/');
  });

  it('should pass through object config', () => {
    const result = normalizeConfig(validConfig);
    expect(result).toEqual(validConfig);
  });
});

describe('parseConfig', () => {
  it('should fill defaults for minimal valid config', () => {
    const config = parseConfig(validConfig);
    expect(config.output.format).toBe('png');
    expect(config.output.margin).toBe(2);
    expect(config.output.prefix).toBe('sprite_');
    expect(config.output.combine).toBe(false);
    expect(config.output.combineCSSRule).toBe(true);
    expect(config.output.unit).toBe('px');
    expect(config.output.remBase).toBe(16);
    expect(config.output.quality).toBe(80);
    expect(config.output.imageDist).toBe('./img/');
    expect(config.workspace).toBe('./');
  });

  it('should accept array cssSource', () => {
    const config = parseConfig({
      input: { cssSource: ['a.css', 'b.css'] },
      output: { cssDist: 'out/' },
    });
    expect(config.input.cssSource).toEqual(['a.css', 'b.css']);
  });

  it('should reject missing input', () => {
    expect(() => parseConfig({ output: { cssDist: 'out/' } })).toThrow(IspriterError);
  });

  it('should reject missing output', () => {
    expect(() => parseConfig({ input: { cssSource: 'a.css' } })).toThrow(IspriterError);
  });

  it('should parse groups config', () => {
    const config = parseConfig({
      ...validConfig,
      groups: [
        { name: 'nav', images: 'nav/*' },
        { name: 'icons', images: ['icon-a.png', 'icon-b.png'] },
      ],
    });
    expect(config.groups).toHaveLength(2);
    expect(config.groups![0].name).toBe('nav');
  });

  it('should accept retina config', () => {
    const config = parseConfig({
      ...validConfig,
      output: { ...validConfig.output, retina: 2 },
    });
    expect(config.output.retina).toBe(2);
  });

  it('should accept unit=rem config', () => {
    const config = parseConfig({
      ...validConfig,
      output: { ...validConfig.output, unit: 'rem', remBase: 16 },
    });
    expect(config.output.unit).toBe('rem');
    expect(config.output.remBase).toBe(16);
  });

  it('should reject invalid format', () => {
    expect(() =>
      parseConfig({
        input: { cssSource: 'a.css' },
        output: { cssDist: 'out/', format: 'jpg' as 'png' },
      }),
    ).toThrow();
  });

  it('should throw IspriterError with CONFIG_INVALID code', () => {
    try {
      parseConfig({} as any);
    } catch (e) {
      expect(e).toBeInstanceOf(IspriterError);
      expect((e as IspriterError).code).toBe('CONFIG_INVALID');
    }
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/config.test.ts
```

- [ ] **Step 3: Implement config.ts**

Create `packages/core/src/config.ts`:

```typescript
import { z, ZodError } from 'zod';
import { IspriterError } from './error.js';

export const SpriterConfigSchema = z.object({
  workspace: z.string().default('./'),
  input: z.object({
    cssSource: z.union([z.string(), z.array(z.string())]),
    ignoreImages: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  output: z.object({
    cssDist: z.string(),
    imageDist: z.string().default('./img/'),
    format: z.enum(['png', 'webp']).default('png'),
    quality: z.number().min(1).max(100).default(80),
    retina: z.union([z.literal(2), z.literal(3)]).optional(),
    maxSingleSize: z.number().positive().optional(),
    margin: z.number().nonnegative().default(2),
    prefix: z.string().default('sprite_'),
    compress: z.union([z.boolean(), z.record(z.unknown())]).default(false),
    combine: z.boolean().default(false),
    combineCSSRule: z.boolean().default(true),
    unit: z.enum(['px', 'rem']).default('px'),
    remBase: z.number().positive().default(16),
  }),
  groups: z
    .array(
      z.object({
        name: z.string(),
        images: z.union([z.string(), z.array(z.string())]),
      }),
    )
    .optional(),
});

export type SpriterConfig = z.input<typeof SpriterConfigSchema>;
export type ResolvedConfig = z.output<typeof SpriterConfigSchema>;

export function normalizeConfig(
  input: string | SpriterConfig,
): z.input<typeof SpriterConfigSchema> {
  if (typeof input === 'string') {
    return { input: { cssSource: input }, output: { cssDist: input } };
  }
  return input;
}

export function parseConfig(raw: unknown): ResolvedConfig {
  const config = normalizeConfig(raw as string | SpriterConfig);
  try {
    return SpriterConfigSchema.parse(config);
  } catch (e) {
    if (e instanceof ZodError) {
      throw new IspriterError(
        `Invalid config: ${e.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join('; ')}`,
        'CONFIG_INVALID',
        { zodErrors: e.errors },
      );
    }
    throw e;
  }
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config.ts packages/core/test/config.test.ts
git commit -m "feat(core): add config parsing with zod validation"
```

### Task 2.3: Bin-packing algorithm

**Files:**
- Create: `packages/core/src/packer.ts`
- Create: `packages/core/test/packer.test.ts`

- [ ] **Step 1: Write packer tests**

Create `packages/core/test/packer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { pack } from '../src/packer.js';

describe('pack', () => {
  it('should return empty array for empty input', () => {
    const result = pack([]);
    expect(result).toEqual([]);
  });

  it('should place single block at (0,0)', () => {
    const result = pack([{ width: 100, height: 100, data: 'a' }], 0);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(0);
    expect(result[0].y).toBe(0);
    expect(result[0].width).toBe(100);
    expect(result[0].height).toBe(100);
    expect(result[0].data).toBe('a');
  });

  it('should place multiple blocks without overlap', () => {
    const result = pack(
      [
        { width: 100, height: 100, data: 'big' },
        { width: 50, height: 50, data: 'small' },
        { width: 200, height: 80, data: 'wide' },
      ],
      0,
    );
    expect(result).toHaveLength(3);
    // Verify no overlap
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });

  it('should respect margin between blocks', () => {
    const result = pack(
      [
        { width: 50, height: 50, data: 'a' },
        { width: 50, height: 50, data: 'b' },
      ],
      5,
    );
    expect(result).toHaveLength(2);
    // Find the second block (not at origin)
    const second = result.find((r) => r.x > 0 || r.y > 0)!;
    // Check that gap is at least margin
    const first = result.find((r) => r !== second)!;
    if (second.y === first.y) {
      // Same row: horizontal gap
      expect(second.x - (first.x + first.width)).toBeGreaterThanOrEqual(5);
    } else {
      // Different row: vertical gap
      expect(second.y - (first.y + first.height)).toBeGreaterThanOrEqual(5);
    }
  });

  it('should sort by area descending', () => {
    const result = pack(
      [
        { width: 10, height: 10, data: 'small' },
        { width: 100, height: 100, data: 'big' },
      ],
      0,
    );
    // Largest area should be placed first (at origin)
    const atOrigin = result.find((r) => r.x === 0 && r.y === 0)!;
    expect(atOrigin.data).toBe('big');
  });

  it('should pack blocks tightly (canvas not too large)', () => {
    const result = pack(
      [
        { width: 50, height: 50, data: 'a' },
        { width: 50, height: 50, data: 'b' },
      ],
      0,
    );
    // Total area should be ~10000 (2 * 50*50)
    const maxX = Math.max(...result.map((r) => r.x + r.width));
    const maxY = Math.max(...result.map((r) => r.y + r.height));
    const canvasArea = maxX * maxY;
    // Should be within 2x of total image area (reasonable packing)
    expect(canvasArea).toBeLessThanOrEqual(100 * 100);
  });

  it('should preserve generic data type', () => {
    type MyData = { name: string; id: number };
    const result = pack<MyData>([{ width: 10, height: 10, data: { name: 'test', id: 1 } }], 0);
    expect(result[0].data.name).toBe('test');
    expect(result[0].data.id).toBe(1);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/packer.test.ts
```

- [ ] **Step 3: Implement packer.ts — GrowingPacker algorithm**

Create `packages/core/src/packer.ts`:

```typescript
import type { PackInput, PackResult } from './types.js';

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  used: boolean;
  data: unknown;
  rotated: boolean;
}

function findNode(root: Block, w: number, h: number): Block | null {
  if (root.used) {
    const right = findNode(root.right!, w, h);
    return right ?? findNode(root.down!, w, h);
  }
  if (w <= root.w && h <= root.h) {
    return root;
  }
  return null;
}

function splitNode(node: Block, w: number, h: number): Block {
  node.used = true;
  node.down = {
    x: node.x,
    y: node.y + h,
    w: node.w,
    h: node.h - h,
    used: false,
    right: undefined!,
    down: undefined!,
    data: undefined!,
    rotated: false,
  };
  node.right = {
    x: node.x + w,
    y: node.y,
    w: node.w - w,
    h: h,
    used: false,
    right: undefined!,
    down: undefined!,
    data: undefined!,
    rotated: false,
  };
  return node;
}

function growRight(root: Block, w: number, h: number): Block {
  const newRoot: Block = {
    x: 0,
    y: 0,
    w: root.w + w,
    h: root.h,
    used: true,
    down: root,
    right: {
      x: root.w,
      y: 0,
      w,
      h: root.h,
      used: false,
      right: undefined!,
      down: undefined!,
      data: undefined!,
      rotated: false,
    },
    data: undefined!,
    rotated: false,
  };
  const node = findNode(newRoot, w, h);
  if (node) {
    splitNode(node, w, h);
  }
  return newRoot;
}

function growDown(root: Block, w: number, h: number): Block {
  const newRoot: Block = {
    x: 0,
    y: 0,
    w: root.w,
    h: root.h + h,
    used: true,
    right: {
      x: 0,
      y: root.h,
      w: root.w,
      h,
      used: false,
      right: undefined!,
      down: undefined!,
      data: undefined!,
      rotated: false,
    },
    down: root,
    data: undefined!,
    rotated: false,
  };
  const node = findNode(newRoot, w, h);
  if (node) {
    splitNode(node, w, h);
  }
  return newRoot;
}

function grow(root: Block, w: number, h: number): Block {
  const canGrowRight = h <= root.h;
  const canGrowDown = w <= root.w;

  if (canGrowRight && canGrowDown) {
    // Grow in the direction that keeps the canvas more square
    return root.w <= root.h ? growRight(root, w, h) : growDown(root, w, h);
  }
  if (canGrowRight) return growRight(root, w, h);
  if (canGrowDown) return growDown(root, w, h);
  // Fallback — should not happen with correct GrowingPacker
  return growRight(root, w, h);
}

export function pack<T>(blocks: PackInput<T>[], margin = 0): PackResult<T>[] {
  if (blocks.length === 0) return [];

  // Sort by area descending
  const sorted = [...blocks].sort((a, b) => b.width * b.height - a.width * a.height);

  const paddedWidth = (b: PackInput<T>) => b.width + (margin > 0 ? margin : 0);
  const paddedHeight = (b: PackInput<T>) => b.height + (margin > 0 ? margin : 0);

  const first = sorted[0];
  let root: Block = {
    x: 0,
    y: 0,
    w: paddedWidth(first),
    h: paddedHeight(first),
    used: true,
    right: {
      x: paddedWidth(first),
      y: 0,
      w: 0,
      h: paddedHeight(first),
      used: false,
      right: undefined!,
      down: undefined!,
      data: undefined!,
      rotated: false,
    },
    down: {
      x: 0,
      y: paddedHeight(first),
      w: paddedWidth(first),
      h: 0,
      used: false,
      right: undefined!,
      down: undefined!,
      data: undefined!,
      rotated: false,
    },
    data: first.data,
    rotated: false,
  };

  const results: PackResult<T>[] = [
    {
      x: 0,
      y: 0,
      width: first.width,
      height: first.height,
      rotated: false,
      data: first.data,
    },
  ];

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    const pw = paddedWidth(block);
    const ph = paddedHeight(block);
    let node = findNode(root, pw, ph);
    if (!node) {
      root = grow(root, pw, ph);
      node = findNode(root, pw, ph);
    }
    if (!node) {
      // This should not happen with GrowingPacker, but safety fallback
      root = growRight(root, pw, ph);
      node = findNode(root, pw, ph);
    }
    splitNode(node, pw, ph);
    results.push({
      x: node.x,
      y: node.y,
      width: block.width,
      height: block.height,
      rotated: false,
      data: block.data,
    });
  }

  return results;
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/packer.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/packer.ts packages/core/test/packer.test.ts
git commit -m "feat(core): add bin-packing algorithm (GrowingPacker)"
```

### Task 2.4: CSS background analysis

**Files:**
- Create: `packages/core/src/css/background.ts`
- Create: `packages/core/test/background.test.ts`

- [ ] **Step 1: Write background analysis tests**

Create `packages/core/test/background.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  extractUrl,
  parsePosition,
  parseRepeat,
  cleanUrlValue,
} from '../src/css/background.js';

describe('extractUrl', () => {
  it('should extract url from background-image', () => {
    expect(extractUrl('url(img/icon.png)')).toBe('img/icon.png');
  });

  it('should extract url from background shorthand', () => {
    expect(extractUrl('#fff url(img/a.png) no-repeat 0 0')).toBe('img/a.png');
  });

  it('should extract url with quotes', () => {
    expect(extractUrl("url('img/a.png')")).toBe('img/a.png');
    expect(extractUrl('url("img/a.png")')).toBe('img/a.png');
  });

  it('should return null for gradient', () => {
    expect(extractUrl('linear-gradient(to right, red, blue)')).toBeNull();
    expect(extractUrl('radial-gradient(circle, red, blue)')).toBeNull();
  });

  it('should return null when no url', () => {
    expect(extractUrl('#fff')).toBeNull();
    expect(extractUrl('none')).toBeNull();
  });

  it('should handle url with spaces', () => {
    expect(extractUrl('url( img/a.png )')).toBe('img/a.png');
  });
});

describe('cleanUrlValue', () => {
  it('should remove query string', () => {
    expect(cleanUrlValue('img/a.png?t=123')).toBe('img/a.png');
  });

  it('should remove hash', () => {
    expect(cleanUrlValue('img/a.png#unsprite')).toBe('img/a.png');
  });

  it('should remove both query and hash', () => {
    expect(cleanUrlValue('img/a.png?t=123#unsprite')).toBe('img/a.png');
  });
});

describe('parsePosition', () => {
  it('should parse numeric px values', () => {
    const pos = parsePosition('url(a.png) -10px -20px');
    expect(pos).toEqual({ x: -10, y: -20 });
  });

  it('should parse 0 values', () => {
    const pos = parsePosition('url(a.png) 0 0');
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('should default to 0,0 when no position', () => {
    const pos = parsePosition('url(a.png)');
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('should handle center + px mix (issue #23)', () => {
    const pos = parsePosition('url(a.png) 415px center');
    expect(pos).toEqual({ x: 415, y: 'center' });
  });

  it('should handle keyword positions', () => {
    const pos = parsePosition('url(a.png) right center');
    expect(pos).toEqual({ x: 'right', y: 'center' });
  });
});

describe('parseRepeat', () => {
  it('should detect repeat', () => {
    expect(parseRepeat('url(a.png) repeat')).toBe('repeat');
    expect(parseRepeat('url(a.png) repeat-x')).toBe('repeat-x');
    expect(parseRepeat('url(a.png) repeat-y')).toBe('repeat-y');
  });

  it('should return no-repeat as default', () => {
    expect(parseRepeat('url(a.png)')).toBe('no-repeat');
    expect(parseRepeat('url(a.png) no-repeat')).toBe('no-repeat');
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/background.test.ts
```

- [ ] **Step 3: Implement background.ts**

Create `packages/core/src/css/background.ts`:

```typescript
/**
 * 从 background / background-image 值中提取 url()
 * 返回 url 内容（去掉引号和空格），或 null（无 url / 渐变）
 */
export function extractUrl(value: string): string | null {
  const match = value.match(/url\(\s*['"]?\s*(.*?)\s*['"]?\s*\)/);
  if (!match) return null;
  const url = match[1];
  // 排除 data URI（不合并）
  if (url.startsWith('data:')) return null;
  return url;
}

/**
 * 清理 URL 中的查询参数和 hash
 */
export function cleanUrlValue(url: string): string {
  return url.split('?')[0].split('#')[0];
}

/**
 * 解析 background-position 值
 */
export function parsePosition(
  value: string,
): { x: number | string; y: number | string } {
  // 去掉 url() 部分
  const withoutUrl = value.replace(/url\([^)]*\)/, '').trim();

  if (!withoutUrl) return { x: 0, y: 0 };

  // 提取 position token（在去掉 repeat/color 后）
  const tokens = withoutUrl
    .replace(/\s+(repeat(-[xy])?|no-repeat|round|space)\s*/gi, ' ')
    .replace(/#[0-9a-fA-F]{3,8}\s*/g, ' ')
    .replace(/(rgb|hsl)a?\([^)]*\)\s*/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return { x: 0, y: 0 };

  const parseToken = (token: string): number | string => {
    if (token.endsWith('px')) return parseFloat(token);
    if (token === '0') return 0;
    if (['left', 'right', 'center', 'top', 'bottom'].includes(token)) return token;
    if (/^\d+(\.\d+)?%$/.test(token)) return token;
    // Try parsing as number
    const num = parseFloat(token);
    if (!isNaN(num)) return num;
    return token;
  };

  if (tokens.length === 1) {
    const val = parseToken(tokens[0]);
    // Single value: x = val, y = center (CSS spec)
    return { x: val, y: 'center' };
  }

  return { x: parseToken(tokens[0]), y: parseToken(tokens[1]) };
}

/**
 * 检测 repeat 值
 */
export function parseRepeat(value: string): string {
  const match = value.match(/\b(repeat(-[xy])?|no-repeat|round|space)\b/i);
  return match ? match[1].toLowerCase() : 'no-repeat';
}

/**
 * 检测是否有 background-size 设置
 */
export function hasBackgroundSize(rule: any): boolean {
  if (!rule.nodes) return false;
  return rule.nodes.some((decl: any) => decl.prop === 'background-size');
}

/**
 * 检测 position 是否为关键词（right/center/bottom）— 这些不应合并
 */
export function isKeywordPosition(
  pos: { x: number | string; y: number | string },
): boolean {
  const keywords = ['right', 'center', 'bottom'];
  return keywords.includes(pos.x as string) || keywords.includes(pos.y as string);
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/background.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/css/background.ts packages/core/test/background.test.ts
git commit -m "feat(core): add CSS background analysis utilities"
```

### Task 2.5: CSS parser (postcss)

**Files:**
- Create: `packages/core/src/css/parser.ts`
- Create: `packages/core/test/parser.test.ts`

- [ ] **Step 1: Write parser tests**

Create `packages/core/test/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { extractBackgrounds } from '../src/css/parser.js';
import type { ResolvedConfig } from '../src/config.js';

const baseConfig: ResolvedConfig = {
  workspace: './',
  input: { cssSource: 'test.css' },
  output: {
    cssDist: './dist/',
    imageDist: './img/',
    format: 'png',
    quality: 80,
    margin: 2,
    prefix: 'sprite_',
    compress: false,
    combine: false,
    combineCSSRule: true,
    unit: 'px',
    remBase: 16,
  },
};

describe('extractBackgrounds', () => {
  it('F1.1: should extract background-image url', () => {
    const css = new Map([['test.css', '.a { background-image: url(img/icon.png); }']]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('img/icon.png');
    expect(rules[0].selector).toBe('.a');
  });

  it('F1.2: should extract background shorthand', () => {
    const css = new Map([
      ['test.css', '.a { background: #fff url(img/a.png) no-repeat 0 0; }'],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('img/a.png');
  });

  it('F1.3: should skip #unsprite', () => {
    const css = new Map([
      ['test.css', '.a { background: url(img/a.png#unsprite); }'],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(0);
  });

  it('F1.4: should skip repeat', () => {
    const css = new Map([['test.css', '.a { background: url(img/a.png) repeat; }']]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(0);
  });

  it('F1.6: should skip gradient', () => {
    const css = new Map([
      [
        'test.css',
        '.a { background-image: linear-gradient(to right, red, blue); }',
      ],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(0);
  });

  it('F1.7: should extract url from gradient+url mix, skip gradient', () => {
    const css = new Map([
      [
        'test.css',
        '.a { background: url(img/a.png) no-repeat, linear-gradient(to right, red, blue); }',
      ],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    // Multiple background layers: the url layer should be extracted
    expect(rules.length).toBeGreaterThanOrEqual(1);
    expect(rules.some((r) => r.imageUrl === 'img/a.png')).toBe(true);
  });

  it('F1.8: should extract from @keyframes', () => {
    const css = new Map([
      [
        'test.css',
        `@keyframes forever {
          0% { background: url(../images/doc.png); }
          50% { background: url(../images/doc_o.png); }
          100% { background: url(../images/doc.png); }
        }`,
      ],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.some((r) => r.imageUrl === '../images/doc.png')).toBe(true);
    expect(rules.some((r) => r.imageUrl === '../images/doc_o.png')).toBe(true);
    expect(rules.every((r) => r.inAnimation)).toBe(true);
  });

  it('F1.9: should preserve px value with center mix', () => {
    const css = new Map([
      ['test.css', '.a { background: url(a.png) 415px center; }'],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(1);
    expect(rules[0].position.x).toBe(415);
    expect(rules[0].position.y).toBe('center');
  });

  it('F1.11: should clean url with query and hash', () => {
    const css = new Map([
      ['test.css', '.a { background: url(../img/a.png?t=123#hash); }'],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(1);
    expect(rules[0].imageUrl).toBe('../img/a.png');
  });

  it('should extract from multiple files', () => {
    const css = new Map([
      ['a.css', '.a { background: url(img/a.png); }'],
      ['b.css', '.b { background: url(img/b.png); }'],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(2);
    expect(rules[0].file).toBe('a.css');
    expect(rules[1].file).toBe('b.css');
  });

  it('should skip background-size rules', () => {
    const css = new Map([
      [
        'test.css',
        '.a { background: url(img/a.png) no-repeat; background-size: 20px; }',
      ],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(0);
  });

  it('should skip absolute URLs (http/https)', () => {
    const css = new Map([
      [
        'test.css',
        '.a { background: url(http://example.com/img.png); }',
      ],
    ]);
    const rules = extractBackgrounds(css, baseConfig);
    expect(rules).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/parser.test.ts
```

- [ ] **Step 3: Implement parser.ts**

Create `packages/core/src/css/parser.ts`:

```typescript
import postcss from 'postcss';
import {
  extractUrl,
  cleanUrlValue,
  parsePosition,
  parseRepeat,
  hasBackgroundSize,
  isKeywordPosition,
} from './background.js';
import type { BackgroundRule } from '../types.js';
import type { ResolvedConfig } from '../config.js';

export { type BackgroundRule } from '../types.js';

export function extractBackgrounds(
  cssContents: Map<string, string>,
  _config: ResolvedConfig,
): BackgroundRule[] {
  const rules: BackgroundRule[] = [];

  for (const [filename, css] of cssContents) {
    const root = postcss.parse(css);

    // 1. Walk normal rules
    root.walkRules((rule) => {
      extractFromRule(rule, filename, false, rules);
    });

    // 2. Walk @keyframes rules
    root.walkAtRules(/^(-webkit-)?keyframes$/i, (atRule) => {
      if (!atRule.nodes) return;
      for (const node of atRule.nodes) {
        if (node.type === 'rule') {
          extractFromRule(node as postcss.Rule, filename, true, rules);
        }
      }
    });
  }

  return rules;
}

function extractFromRule(
  rule: postcss.Rule,
  file: string,
  inAnimation: boolean,
  results: BackgroundRule[],
): void {
  // Skip rules with background-size — already sized, don't merge
  if (hasBackgroundSize(rule)) return;

  for (const node of rule.nodes) {
    if (node.type !== 'decl') continue;
    const decl = node as postcss.Declaration;
    if (decl.prop !== 'background' && decl.prop !== 'background-image') continue;

    // Handle multiple background layers (comma-separated)
    const layers = splitBackgroundLayers(decl.value);

    for (const layer of layers) {
      const url = extractUrl(layer);
      if (!url) continue; // gradient or no url

      // Skip #unsprite marker
      if (url.includes('#unsprite')) continue;

      // Skip absolute URLs
      if (/^(https?:)?\/\//.test(url)) continue;

      // Skip repeat
      const repeat = parseRepeat(layer);
      if (repeat !== 'no-repeat') continue;

      const position = parsePosition(layer);

      // Skip keyword-only positions (right/center/bottom)
      if (
        decl.prop === 'background' &&
        isKeywordPosition(position) &&
        typeof position.x === 'string' &&
        typeof position.y === 'string'
      ) {
        continue;
      }

      results.push({
        file,
        selector: rule.selector,
        imageUrl: cleanUrlValue(url),
        position,
        repeat,
        node: rule,
        inAnimation,
      });
    }
  }
}

/**
 * Split comma-separated background layers
 * "url(a.png) no-repeat, linear-gradient(...)" → ["url(a.png) no-repeat", " linear-gradient(...)"]
 */
function splitBackgroundLayers(value: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      layers.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  layers.push(value.slice(start).trim());
  return layers;
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/parser.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/css/parser.ts packages/core/test/parser.test.ts
git commit -m "feat(core): add CSS parser with postcss — extract background rules"
```

### Task 2.6: CSS emitter

**Files:**
- Create: `packages/core/src/css/emitter.ts`
- Create: `packages/core/test/emitter.test.ts`

- [ ] **Step 1: Write emitter tests**

Create `packages/core/test/emitter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emitCSS } from '../src/css/emitter.js';
import type { PackedSprite, ImageAsset, BackgroundRule } from '../src/types.js';
import type { ResolvedConfig } from '../src/config.js';

const baseConfig: ResolvedConfig = {
  workspace: './',
  input: { cssSource: 'test.css' },
  output: {
    cssDist: './dist/',
    imageDist: '../img/',
    format: 'png',
    quality: 80,
    margin: 2,
    prefix: 'sprite_',
    compress: false,
    combine: false,
    combineCSSRule: true,
    unit: 'px',
    remBase: 16,
  },
};

function makeRule(overrides: Partial<BackgroundRule> = {}): BackgroundRule {
  return {
    file: 'style.css',
    selector: '.a',
    imageUrl: 'images/icon.png',
    position: { x: 0, y: 0 },
    repeat: 'no-repeat',
    node: null,
    inAnimation: false,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    url: 'images/icon.png',
    buffer: Buffer.alloc(0),
    naturalWidth: 16,
    naturalHeight: 16,
    rules: [makeRule()],
    ...overrides,
  };
}

function makeSprite(overrides: Partial<PackedSprite> = {}): PackedSprite {
  return {
    spriteFile: 'sprite_0.png',
    canvasWidth: 100,
    canvasHeight: 100,
    items: [
      {
        asset: makeAsset(),
        x: 0,
        y: 0,
        width: 16,
        height: 16,
      },
    ],
    ...overrides,
  };
}

describe('emitCSS', () => {
  it('F6.1: should update background-position', () => {
    const originalCSS = '.a { background: url(images/icon.png) no-repeat; }';
    const css = new Map([['style.css', originalCSS]]);
    const sprites = [
      makeSprite({
        items: [{ asset: makeAsset(), x: 10, y: 20, width: 16, height: 16 }],
      }),
    ];

    const result = emitCSS(sprites, css, baseConfig);
    const output = result.get('style.css')!;
    expect(output).toContain('background-position');
    expect(output).toContain('-10px');
    expect(output).toContain('-20px');
  });

  it('F6.2: should update background-image url', () => {
    const originalCSS = '.a { background: url(images/icon.png) no-repeat; }';
    const css = new Map([['style.css', originalCSS]]);
    const sprites = [makeSprite()];

    const result = emitCSS(sprites, css, baseConfig);
    const output = result.get('style.css')!;
    expect(output).toContain('../img/sprite_0.png');
    expect(output).not.toContain('images/icon.png');
  });

  it('F6.5: should compress CSS when compress=true', () => {
    const originalCSS = '.a {\n  background: url(images/icon.png) no-repeat;\n}';
    const css = new Map([['style.css', originalCSS]]);
    const sprites = [makeSprite()];
    const config = { ...baseConfig, output: { ...baseConfig.output, compress: true } };

    const result = emitCSS(sprites, css, config);
    const output = result.get('style.css')!;
    // Compressed = single line or minimal whitespace
    expect(output).not.toMatch(/\n\s*\n/);
  });

  it('F6.7: should use rem unit when configured', () => {
    const originalCSS = '.a { background: url(images/icon.png) no-repeat; }';
    const css = new Map([['style.css', originalCSS]]);
    const sprites = [
      makeSprite({
        items: [{ asset: makeAsset(), x: 16, y: 32, width: 16, height: 16 }],
      }),
    ];
    const config = {
      ...baseConfig,
      output: { ...baseConfig.output, unit: 'rem' as const, remBase: 16 },
    };

    const result = emitCSS(sprites, css, config);
    const output = result.get('style.css')!;
    // 16px / 16 = 1rem, 32px / 16 = 2rem
    expect(output).toContain('-1rem');
    expect(output).toContain('-2rem');
  });

  it('should preserve non-background rules', () => {
    const originalCSS = '.a { color: red; background: url(images/icon.png) no-repeat; }';
    const css = new Map([['style.css', originalCSS]]);
    const sprites = [makeSprite()];

    const result = emitCSS(sprites, css, baseConfig);
    const output = result.get('style.css')!;
    expect(output).toContain('color: red');
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/emitter.test.ts
```

- [ ] **Step 3: Implement emitter.ts**

Create `packages/core/src/css/emitter.ts`:

```typescript
import postcss from 'postcss';
import CleanCSS from 'clean-css';
import type { PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../src/config.js';

/**
 * 更新 CSS 中的 background-image url 和 background-position
 */
export function emitCSS(
  sprites: PackedSprite[],
  originalCSS: Map<string, string>,
  config: ResolvedConfig,
): Map<string, string> {
  // Build lookup: imageUrl → { spriteFile, x, y }
  const imageToSprite = new Map<
    string,
    { spriteFile: string; x: number; y: number }
  >();
  for (const sprite of sprites) {
    for (const item of sprite.items) {
      imageToSprite.set(item.asset.url, {
        spriteFile: sprite.spriteFile,
        x: item.x,
        y: item.y,
      });
    }
  }

  const result = new Map<string, string>();

  for (const [filename, css] of originalCSS) {
    const root = postcss.parse(css);
    const spriteUrl = config.output.imageDist;

    root.walkDecls(/^background(-image)?$/, (decl) => {
      const urlMatch = decl.value.match(/url\(\s*['"]?\s*(.*?)\s*['"]?\s*\)/);
      if (!urlMatch) return;

      const originalUrl = urlMatch[1].split('?')[0].split('#')[0];
      const mapping = imageToSprite.get(originalUrl);
      if (!mapping) return;

      // Update url
      const newUrl = `url(${spriteUrl}${mapping.spriteFile})`;
      decl.value = decl.value.replace(urlMatch[0], newUrl);

      // Update or add background-position
      const rule = decl.parent!;
      const existingPos = rule.nodes?.find(
        (n) => n.type === 'decl' && (n as postcss.Declaration).prop === 'background-position',
      );

      const posX = formatValue(-mapping.x, config);
      const posY = formatValue(-mapping.y, config);

      if (existingPos) {
        (existingPos as postcss.Declaration).value = `${posX} ${posY}`;
      } else {
        // Add background-position after background declaration
        const posDecl = postcss.decl({
          prop: 'background-position',
          value: `${posX} ${posY}`,
        });
        decl.after(posDecl);
      }

      // If background shorthand has position tokens, remove them from the shorthand value
      if (decl.prop === 'background') {
        decl.value = removePositionTokens(decl.value);
      }
    });

    let output = root.toString();

    // Compress if requested
    if (config.output.compress) {
      const minifier = new CleanCSS(
        typeof config.output.compress === 'object'
          ? (config.output.compress as CleanCSS.Options)
          : {},
      );
      const minified = minifier.minify(output);
      output = minified.styles;
    }

    result.set(filename, output);
  }

  return result;
}

function formatValue(px: number, config: ResolvedConfig): string {
  if (config.output.unit === 'rem') {
    return `${px / config.output.remBase}rem`;
  }
  return `${px}px`;
}

/**
 * 从 background shorthand 中移除 position token
 * "url(...) no-repeat -10px -20px" → "url(...) no-repeat"
 */
function removePositionTokens(value: string): string {
  // Remove px values and 0 from after url()/no-repeat
  return value
    .replace(/\s+-?\d+(\.\d+)?px/g, '')
    .replace(/\s+-?\d+(\.\d+)?(?=\s|$)/g, '');
}
```

Wait, the path `'../src/config.js'` is wrong — this file is in `packages/core/src/css/`, so it should be `../config.js`.

- [ ] **Step 3 (revised): Implement emitter.ts with correct import**

Create `packages/core/src/css/emitter.ts`:

```typescript
import postcss from 'postcss';
import CleanCSS from 'clean-css';
import type { PackedSprite } from '../types.js';
import type { ResolvedConfig } from '../config.js';

/**
 * 更新 CSS 中的 background-image url 和 background-position
 */
export function emitCSS(
  sprites: PackedSprite[],
  originalCSS: Map<string, string>,
  config: ResolvedConfig,
): Map<string, string> {
  // Build lookup: imageUrl → { spriteFile, x, y }
  const imageToSprite = new Map<
    string,
    { spriteFile: string; x: number; y: number }
  >();
  for (const sprite of sprites) {
    for (const item of sprite.items) {
      imageToSprite.set(item.asset.url, {
        spriteFile: sprite.spriteFile,
        x: item.x,
        y: item.y,
      });
    }
  }

  const result = new Map<string, string>();

  for (const [filename, css] of originalCSS) {
    const root = postcss.parse(css);
    const spriteUrl = config.output.imageDist;

    root.walkDecls(/^background(-image)?$/, (decl) => {
      const urlMatch = decl.value.match(/url\(\s*['"]?\s*(.*?)\s*['"]?\s*\)/);
      if (!urlMatch) return;

      const originalUrl = urlMatch[1].split('?')[0].split('#')[0];
      const mapping = imageToSprite.get(originalUrl);
      if (!mapping) return;

      // Update url
      const newUrl = `url(${spriteUrl}${mapping.spriteFile})`;
      decl.value = decl.value.replace(urlMatch[0], newUrl);

      // Calculate position
      const posX = formatValue(-mapping.x, config);
      const posY = formatValue(-mapping.y, config);

      // If background shorthand, update inline position
      if (decl.prop === 'background') {
        decl.value = removePositionTokens(decl.value) + ` ${posX} ${posY}`;
      } else {
        // background-image: add/update separate background-position
        const rule = decl.parent!;
        const existingPos = rule.nodes?.find(
          (n) => n.type === 'decl' && (n as postcss.Declaration).prop === 'background-position',
        );
        if (existingPos) {
          (existingPos as postcss.Declaration).value = `${posX} ${posY}`;
        } else {
          const posDecl = postcss.decl({
            prop: 'background-position',
            value: `${posX} ${posY}`,
          });
          decl.after(posDecl);
        }
      }
    });

    let output = root.toString();

    // Compress if requested
    if (config.output.compress) {
      const minifier = new CleanCSS(
        typeof config.output.compress === 'object'
          ? (config.output.compress as CleanCSS.Options)
          : {},
      );
      const minified = minifier.minify(output);
      output = minified.styles;
    }

    result.set(filename, output);
  }

  return result;
}

function formatValue(px: number, config: ResolvedConfig): string {
  if (config.output.unit === 'rem') {
    return `${px / config.output.remBase}rem`;
  }
  return `${px}px`;
}

/**
 * 从 background shorthand 中移除已有的 position token
 * "url(...) no-repeat -10px -20px" → "url(...) no-repeat"
 */
function removePositionTokens(value: string): string {
  return value
    .replace(/\s+-?\d+(\.\d+)?px/g, '')
    .replace(/\s+-?\d+(\.\d+)?(?=\s|$)/g, '');
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/emitter.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/css/emitter.ts packages/core/test/emitter.test.ts
git commit -m "feat(core): add CSS emitter — update url and position"
```

### Task 2.7: Sprite image generation

**Files:**
- Create: `packages/core/src/image/sprite.ts`
- Create: `packages/core/test/sprite.test.ts`

- [ ] **Step 1: Write sprite tests**

Create `packages/core/test/sprite.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { generateSprite } from '../src/image/sprite.js';

async function makeTestImage(width: number, height: number, color: { r: number; g: number; b: number; a: number }) {
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

describe('generateSprite', () => {
  it('should produce a valid PNG buffer', async () => {
    const img = await makeTestImage(10, 10, { r: 255, g: 0, b: 0, a: 255 });
    const result = await generateSprite(
      [{ buffer: img, x: 0, y: 0, width: 10, height: 10 }],
      10,
      10,
      'png',
      80,
    );
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);

    // Verify it's a valid PNG
    const meta = await sharp(result).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(10);
    expect(meta.height).toBe(10);
  });

  it('should place multiple images correctly', async () => {
    const red = await makeTestImage(10, 10, { r: 255, g: 0, b: 0, a: 255 });
    const blue = await makeTestImage(10, 10, { r: 0, g: 0, b: 255, a: 255 });

    const result = await generateSprite(
      [
        { buffer: red, x: 0, y: 0, width: 10, height: 10 },
        { buffer: blue, x: 10, y: 0, width: 10, height: 10 },
      ],
      20,
      10,
      'png',
      80,
    );

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(20);
    expect(meta.height).toBe(10);
  });

  it('should produce WebP when format=webp', async () => {
    const img = await makeTestImage(10, 10, { r: 0, g: 255, b: 0, a: 255 });
    const result = await generateSprite(
      [{ buffer: img, x: 0, y: 0, width: 10, height: 10 }],
      10,
      10,
      'webp',
      80,
    );

    const meta = await sharp(result).metadata();
    expect(meta.format).toBe('webp');
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/sprite.test.ts
```

- [ ] **Step 3: Implement sprite.ts**

Create `packages/core/src/image/sprite.ts`:

```typescript
import sharp from 'sharp';

export interface SpriteInput {
  buffer: Buffer;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 生成精灵图
 * 将多个图片合成到一张画布上
 */
export async function generateSprite(
  images: SpriteInput[],
  canvasWidth: number,
  canvasHeight: number,
  format: 'png' | 'webp',
  quality: number,
): Promise<Buffer> {
  if (images.length === 0) {
    // Empty sprite — return 1x1 transparent PNG
    return sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, a: 0 } } })
      .png()
      .toBuffer();
  }

  // Use sharp composite for each image
  const composites = await Promise.all(
    images.map(async (img) => {
      // Ensure image is the expected size
      const resized = await sharp(img.buffer)
        .resize(img.width, img.height, { fit: 'fill' })
        .toBuffer();
      return { input: resized, top: img.y, left: img.x };
    }),
  );

  // Create transparent canvas and composite all images
  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, a: 0 },
    },
  });

  const result = canvas.composite(composites);

  if (format === 'webp') {
    return result.webp({ quality }).toBuffer();
  }
  return result.png().toBuffer();
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/sprite.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/image/sprite.ts packages/core/test/sprite.test.ts
git commit -m "feat(core): add sprite image generation with sharp"
```

### Task 2.8: Deduplication logic

**Files:**
- Create: `packages/core/test/dedupe.test.ts`

- [ ] **Step 1: Write deduplication tests**

Create `packages/core/test/dedupe.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { deduplicateImages } from '../src/spriter.js';
import type { BackgroundRule, ImageAsset } from '../src/types.js';

function makeRule(url: string, selector: string = '.a'): BackgroundRule {
  return {
    file: 'style.css',
    selector,
    imageUrl: url,
    position: { x: 0, y: 0 },
    repeat: 'no-repeat',
    node: null,
    inAnimation: false,
  };
}

describe('deduplicateImages', () => {
  it('F3.1: same image referenced by multiple selectors → single asset', () => {
    const rules = [
      makeRule('images/icon.png', '.a'),
      makeRule('images/icon.png', '.b'),
    ];
    const images = new Map<string, Buffer>();
    images.set('images/icon.png', Buffer.from('fake'));

    const result = deduplicateImages(rules, images);
    expect(result).toHaveLength(1);
    expect(result[0].rules).toHaveLength(2);
    expect(result[0].rules.map((r) => r.selector)).toEqual(['.a', '.b']);
  });

  it('should return separate assets for different images', () => {
    const rules = [
      makeRule('images/a.png', '.a'),
      makeRule('images/b.png', '.b'),
    ];
    const images = new Map<string, Buffer>();
    images.set('images/a.png', Buffer.from('a'));
    images.set('images/b.png', Buffer.from('b'));

    const result = deduplicateImages(rules, images);
    expect(result).toHaveLength(2);
  });

  it('should skip images not in the images map', () => {
    const rules = [makeRule('images/missing.png', '.a')];
    const images = new Map<string, Buffer>();

    const result = deduplicateImages(rules, images);
    expect(result).toHaveLength(0);
  });
});
```

Wait — `deduplicateImages` should be a standalone pure function, not a method on Spriter. Let me refactor.

Actually, let me make it a helper function exported from `spriter.ts` or a separate `dedupe.ts` module.

- [ ] **Step 3: Implement deduplication in a separate module**

This is getting complex. Let me restructure: `deduplicateImages` will be part of the spriter orchestration, but as a testable exported function.

Actually, let me keep it simple and export it from spriter.ts since it's an internal helper.

Let me revise the plan — instead of testing a standalone function, I'll test the full Spriter.run() flow in a later task. For deduplication, I'll test it as part of the integration test.

Let me simplify: skip the standalone dedupe test module, and cover dedup in the spriter integration test (Task 2.10).

- [ ] **Step 5: Commit**

Skip this task — deduplication will be tested as part of Spriter integration.

### Task 2.9: Exclusion logic

**Files:**
- Create: `packages/core/test/exclude.test.ts`
- Create: helper in `packages/core/src/exclude.ts`

- [ ] **Step 1: Write exclusion tests**

Create `packages/core/test/exclude.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldExclude } from '../src/exclude.js';
import type { BackgroundRule } from '../src/types.js';

function makeRule(url: string): BackgroundRule {
  return {
    file: 'style.css',
    selector: '.a',
    imageUrl: url,
    position: { x: 0, y: 0 },
    repeat: 'no-repeat',
    node: null,
    inAnimation: false,
  };
}

describe('shouldExclude', () => {
  it('F10.2: should match glob pattern', () => {
    expect(shouldExclude('icons/a.png', ['icons/*'])).toBe(true);
    expect(shouldExclude('img/a.png', ['icons/*'])).toBe(false);
  });

  it('F10.3: should match array of patterns', () => {
    expect(shouldExclude('a.png', ['a.png', 'b/*'])).toBe(true);
    expect(shouldExclude('b/icon.png', ['a.png', 'b/*'])).toBe(true);
    expect(shouldExclude('c/icon.png', ['a.png', 'b/*'])).toBe(false);
  });

  it('should return false for empty patterns', () => {
    expect(shouldExclude('a.png', [])).toBe(false);
    expect(shouldExclude('a.png', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/exclude.test.ts
```

- [ ] **Step 3: Implement exclude.ts**

Create `packages/core/src/exclude.ts`:

```typescript
import { matchGlob } from '@ispriter/shared';

/**
 * 检查图片路径是否应该被排除
 */
export function shouldExclude(
  imageUrl: string,
  patterns: string[] | undefined,
): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((pattern) => matchGlob(pattern, imageUrl));
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/exclude.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/exclude.ts packages/core/test/exclude.test.ts
git commit -m "feat(core): add image exclusion logic with glob matching"
```

### Task 2.10: Spriter class (main orchestrator)

**Files:**
- Create: `packages/core/src/spriter.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/test/spriter.test.ts`

- [ ] **Step 1: Write Spriter integration tests**

Create `packages/core/test/spriter.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { Spriter } from '../src/spriter.js';
import type { SpriterConfig } from '../src/config.js';

async function makePNG(width: number, height: number, color: string) {
  return sharp({
    create: { width, height, channels: 4, background: color },
  })
    .png()
    .toBuffer();
}

const simpleConfig: SpriterConfig = {
  input: { cssSource: 'style.css' },
  output: { cssDist: './dist/', margin: 2 },
};

describe('Spriter', () => {
  it('should produce sprite image and updated CSS', async () => {
    const iconBuf = await makePNG(16, 16, '#ff0000');
    const css = new Map([
      ['style.css', '.a { width: 16px; height: 16px; background: url(images/icon.png) no-repeat; }'],
    ]);
    const images = new Map([['images/icon.png', iconBuf]]);

    const spriter = new Spriter(simpleConfig);
    const result = await spriter.run({ css, images, cssBaseDir: '.' });

    expect(result.spriteImages.size).toBe(1);
    expect(result.cssFiles.size).toBe(1);
    expect(result.skippedImages).toEqual([]);

    const outputCSS = result.cssFiles.get('style.css')!;
    expect(outputCSS).toContain('sprite_0.png');
    expect(outputCSS).toContain('background-position');
  });

  it('should deduplicate same image referenced by multiple selectors', async () => {
    const iconBuf = await makePNG(16, 16, '#ff0000');
    const css = new Map([
      [
        'style.css',
        `.a { background: url(images/icon.png) no-repeat; }
         .b { background: url(images/icon.png) no-repeat; }`,
      ],
    ]);
    const images = new Map([['images/icon.png', iconBuf]]);

    const spriter = new Spriter(simpleConfig);
    const result = await spriter.run({ css, images, cssBaseDir: '.' });

    // Should have one sprite image with one entry
    expect(result.spriteImages.size).toBe(1);
    // Both selectors should be in manifest
    expect(result.manifest.has('images/icon.png')).toBe(true);
  });

  it('should skip missing images and record them', async () => {
    const css = new Map([
      ['style.css', '.a { background: url(images/missing.png) no-repeat; }'],
    ]);
    const images = new Map(); // no images loaded

    const spriter = new Spriter(simpleConfig);
    const result = await spriter.run({ css, images, cssBaseDir: '.' });

    expect(result.skippedImages).toContain('images/missing.png');
    // CSS should remain unchanged for skipped images
    const outputCSS = result.cssFiles.get('style.css')!;
    expect(outputCSS).toContain('images/missing.png');
  });

  it('should handle combine=true mode', async () => {
    const iconBuf = await makePNG(16, 16, '#ff0000');
    const css = new Map([
      ['a.css', '.a { background: url(images/icon.png) no-repeat; }'],
      ['b.css', '.b { background: url(images/icon2.png) no-repeat; }'],
    ]);
    const images = new Map([
      ['images/icon.png', iconBuf],
      ['images/icon2.png', iconBuf],
    ]);
    const config: SpriterConfig = {
      ...simpleConfig,
      output: { ...simpleConfig.output, combine: true },
    };

    const spriter = new Spriter(config);
    const result = await spriter.run({ css, images, cssBaseDir: '.' });

    // combine=true: all into one sprite
    expect(result.spriteImages.size).toBe(1);
  });

  it('should reject invalid config with IspriterError', () => {
    const { IspriterError } = require('../src/error.js');
    expect(() => new Spriter({} as any)).toThrow();
  });
});
```

- [ ] **Step 2: Run test → expect FAIL**

```bash
cd packages/core && pnpm vitest run test/spriter.test.ts
```

- [ ] **Step 3: Implement spriter.ts**

Create `packages/core/src/spriter.ts`:

```typescript
import sharp from 'sharp';
import { parseConfig, type SpriterConfig, type ResolvedConfig } from './config.js';
import { extractBackgrounds } from './css/parser.js';
import { emitCSS } from './css/emitter.js';
import { generateSprite } from './image/sprite.js';
import { pack } from './packer.js';
import { shouldExclude } from './exclude.js';
import type {
  SpriterRunInput,
  SpriterResult,
  PackedSprite,
  ImageAsset,
  BackgroundRule,
} from './types.js';

export class Spriter {
  private config: ResolvedConfig;

  constructor(config: SpriterConfig) {
    this.config = parseConfig(config);
  }

  async run(input: SpriterRunInput): Promise<SpriterResult> {
    const { config } = this;

    // 1. Parse CSS → extract background rules
    const rules = extractBackgrounds(input.css, config);

    // 2. Filter excluded images
    const filtered = rules.filter(
      (r) => !shouldExclude(r.imageUrl, config.input.ignoreImages as string[] | undefined),
    );

    // 3. Build image assets (deduplicate + match with buffers)
    const { assets, skipped } = this.buildAssets(
      filtered,
      input.images,
    );

    // 4. Pack into sprite(s)
    const sprites = this.packSprites(assets);

    // 5. Generate sprite images
    const spriteImages = new Map<string, Buffer>();
    for (const sprite of sprites) {
      const buf = await generateSprite(
        sprite.items.map((item) => ({
          buffer: item.asset.buffer,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        })),
        sprite.canvasWidth,
        sprite.canvasHeight,
        config.output.format,
        config.output.quality,
      );
      spriteImages.set(sprite.spriteFile, buf);
    }

    // 6. Emit CSS
    const cssFiles = emitCSS(sprites, input.css, config);

    // 7. Build manifest
    const manifest = new Map<
      string,
      { spriteFile: string; x: number; y: number; width: number; height: number }
    >();
    for (const sprite of sprites) {
      for (const item of sprite.items) {
        manifest.set(item.asset.url, {
          spriteFile: sprite.spriteFile,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        });
      }
    }

    return { cssFiles, spriteImages, manifest, skippedImages: skipped };
  }

  /**
   * Deduplicate images and match with buffers
   */
  private buildAssets(
    rules: BackgroundRule[],
    images: Map<string, Buffer>,
  ): { assets: ImageAsset[]; skipped: string[] } {
    const assetMap = new Map<string, ImageAsset>();
    const skipped: string[] = [];

    for (const rule of rules) {
      const url = rule.imageUrl;

      if (!images.has(url)) {
        if (!skipped.includes(url)) {
          skipped.push(url);
        }
        continue;
      }

      if (assetMap.has(url)) {
        assetMap.get(url)!.rules.push(rule);
      } else {
        const buf = images.get(url)!;
        // Get dimensions from sharp metadata
        // Note: this is async in real code; for now use sync approach with cached metadata
        assetMap.set(url, {
          url,
          buffer: buf,
          naturalWidth: 0, // Will be filled later
          naturalHeight: 0,
          rules: [rule],
        });
      }
    }

    return { assets: Array.from(assetMap.values()), skipped };
  }

  private packSprites(assets: ImageAsset[]): PackedSprite[] {
    if (assets.length === 0) return [];

    // TODO: Get actual dimensions — for now we need async
    // This will be refactored to handle async dimension extraction
    const packInputs = assets.map((a) => ({
      width: a.naturalWidth || 16, // fallback
      height: a.naturalHeight || 16,
      data: a,
    }));

    const packResults = pack(packInputs, this.config.output.margin);

    const canvasWidth = Math.max(...packResults.map((r) => r.x + r.width));
    const canvasHeight = Math.max(...packResults.map((r) => r.y + r.height));

    return [
      {
        spriteFile: `${this.config.output.prefix}0.png`,
        canvasWidth,
        canvasHeight,
        items: packResults.map((r) => ({
          asset: r.data as ImageAsset,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        })),
      },
    ];
  }
}

/**
 * Standalone helper for deduplication (exported for testing)
 */
export function deduplicateImages(
  rules: BackgroundRule[],
  images: Map<string, Buffer>,
): ImageAsset[] {
  const assetMap = new Map<string, ImageAsset>();

  for (const rule of rules) {
    const url = rule.imageUrl;
    if (!images.has(url)) continue;

    if (assetMap.has(url)) {
      assetMap.get(url)!.rules.push(rule);
    } else {
      assetMap.set(url, {
        url,
        buffer: images.get(url)!,
        naturalWidth: 0,
        naturalHeight: 0,
        rules: [rule],
      });
    }
  }

  return Array.from(assetMap.values());
}
```

Hmm, the async dimension issue needs to be solved properly. sharp needs to read image metadata asynchronously. Let me restructure `buildAssets` to be async.

- [ ] **Step 3 (revised): Implement spriter.ts with async dimension extraction**

```typescript
import sharp from 'sharp';
import { parseConfig, type SpriterConfig, type ResolvedConfig } from './config.js';
import { extractBackgrounds } from './css/parser.js';
import { emitCSS } from './css/emitter.js';
import { generateSprite } from './image/sprite.js';
import { pack } from './packer.js';
import { shouldExclude } from './exclude.js';
import type {
  SpriterRunInput,
  SpriterResult,
  PackedSprite,
  ImageAsset,
  BackgroundRule,
} from './types.js';

export class Spriter {
  private config: ResolvedConfig;

  constructor(config: SpriterConfig) {
    this.config = parseConfig(config);
  }

  async run(input: SpriterRunInput): Promise<SpriterResult> {
    const { config } = this;

    // 1. Parse CSS → extract background rules
    const rules = extractBackgrounds(input.css, config);

    // 2. Filter excluded images
    const ignorePatterns = config.input.ignoreImages
      ? Array.isArray(config.input.ignoreImages)
        ? config.input.ignoreImages
        : [config.input.ignoreImages]
      : undefined;
    const filtered = rules.filter((r) => !shouldExclude(r.imageUrl, ignorePatterns));

    // 3. Build image assets (deduplicate + match buffers + get dimensions)
    const { assets, skipped } = await this.buildAssets(filtered, input.images);

    if (assets.length === 0) {
      return {
        cssFiles: input.css,
        spriteImages: new Map(),
        manifest: new Map(),
        skippedImages: skipped,
      };
    }

    // 4. Pack into sprite(s)
    const sprites = this.packSprites(assets);

    // 5. Generate sprite images
    const spriteImages = new Map<string, Buffer>();
    for (const sprite of sprites) {
      const buf = await generateSprite(
        sprite.items.map((item) => ({
          buffer: item.asset.buffer,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        })),
        sprite.canvasWidth,
        sprite.canvasHeight,
        config.output.format,
        config.output.quality,
      );
      spriteImages.set(sprite.spriteFile, buf);
    }

    // 6. Emit updated CSS
    const cssFiles = emitCSS(sprites, input.css, config);

    // 7. Build manifest
    const manifest = new Map<
      string,
      { spriteFile: string; x: number; y: number; width: number; height: number }
    >();
    for (const sprite of sprites) {
      for (const item of sprite.items) {
        manifest.set(item.asset.url, {
          spriteFile: sprite.spriteFile,
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        });
      }
    }

    return { cssFiles, spriteImages, manifest, skippedImages: skipped };
  }

  private async buildAssets(
    rules: BackgroundRule[],
    images: Map<string, Buffer>,
  ): Promise<{ assets: ImageAsset[]; skipped: string[] }> {
    const assetMap = new Map<string, ImageAsset>();
    const skipped: string[] = [];

    for (const rule of rules) {
      const url = rule.imageUrl;

      if (!images.has(url)) {
        if (!skipped.includes(url)) skipped.push(url);
        continue;
      }

      if (assetMap.has(url)) {
        assetMap.get(url)!.rules.push(rule);
      } else {
        const buf = images.get(url)!;
        const meta = await sharp(buf).metadata();
        assetMap.set(url, {
          url,
          buffer: buf,
          naturalWidth: meta.width ?? 0,
          naturalHeight: meta.height ?? 0,
          rules: [rule],
        });
      }
    }

    return { assets: Array.from(assetMap.values()), skipped };
  }

  private packSprites(assets: ImageAsset[]): PackedSprite[] {
    const packInputs = assets.map((a) => ({
      width: a.naturalWidth,
      height: a.naturalHeight,
      data: a,
    }));

    const packResults = pack(packInputs, this.config.output.margin);
    if (packResults.length === 0) return [];

    const canvasWidth = Math.max(...packResults.map((r) => r.x + r.width));
    const canvasHeight = Math.max(...packResults.map((r) => r.y + r.height));

    return [
      {
        spriteFile: `${this.config.output.prefix}0.png`,
        canvasWidth,
        canvasHeight,
        items: packResults.map((r) => ({
          asset: r.data as ImageAsset,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        })),
      },
    ];
  }
}

/** Standalone deduplication helper (exported for testing) */
export function deduplicateImages(
  rules: BackgroundRule[],
  images: Map<string, Buffer>,
): ImageAsset[] {
  const assetMap = new Map<string, ImageAsset>();
  for (const rule of rules) {
    const url = rule.imageUrl;
    if (!images.has(url)) continue;
    if (assetMap.has(url)) {
      assetMap.get(url)!.rules.push(rule);
    } else {
      assetMap.set(url, {
        url,
        buffer: images.get(url)!,
        naturalWidth: 0,
        naturalHeight: 0,
        rules: [rule],
      });
    }
  }
  return Array.from(assetMap.values());
}
```

- [ ] **Step 4: Run test → expect PASS**

```bash
cd packages/core && pnpm vitest run test/spriter.test.ts
```

- [ ] **Step 5: Create index.ts barrel export**

Create `packages/core/src/index.ts`:

```typescript
export { Spriter } from './spriter.js';
export { IspriterError } from './error.js';
export { parseConfig, normalizeConfig } from './config.js';
export type { SpriterConfig, ResolvedConfig } from './config.js';
export type {
  SpriterRunInput,
  SpriterResult,
  BackgroundRule,
  ImageAsset,
  PackedSprite,
  PackInput,
  PackResult,
} from './types.js';
```

- [ ] **Step 6: Run all core tests**

```bash
cd packages/core && pnpm vitest run
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/spriter.ts packages/core/src/index.ts packages/core/test/spriter.test.ts
git commit -m "feat(core): add Spriter orchestrator with full pipeline"
```

**Checkpoint:** Core library is complete and tested. All unit tests pass. `Spriter.run()` takes CSS + image buffers as input, returns sprite images + updated CSS + manifest, all in memory.

---

## Phase 3: CLI + E2E Tests

### Task 3.1: CLI entry point

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/src/index.ts`

**Key implementation:**
- Commander program with `-c`, `-f`, `-o`, `--watch` options
- Reads CSS files from disk (glob expansion)
- Extracts image URLs from CSS, reads image files
- Calls `new Spriter(config).run(input)`
- Writes output CSS and sprite images to disk
- Watch mode with chokidar

```bash
git commit -m "feat(cli): add CLI entry point with commander"
```

### Task 3.2: E2E tests using original test fixtures

**Files:**
- Create: `tests/e2e/basic.test.ts`
- Create: `tests/e2e/combine.test.ts`
- Create: `tests/e2e/examples.test.ts`

**Key tests:**
- E2E.1: Use `test/css/style.css` + `test/images/` → verify sprite output
- E2E.2: Multi-file with `style*.css` → verify separate sprites
- E2E.3: Multi-combine mode → verify single sprite
- Use `test/css/style2.css` for animation/unsprite tests

```bash
git commit -m "test: add E2E tests using original test fixtures"
```

### Task 3.3: Snapshot tests for CSS output

**Files:**
- Create: `packages/core/test/snapshot/css-output.test.ts`

**Key tests:**
- Snapshot lock CSS output for known inputs
- Verify regression protection for issues #16, #26, #32

```bash
git commit -m "test: add CSS output snapshot tests"
```

**Checkpoint:** CLI is functional. E2E tests pass with original test fixtures. Snapshots lock CSS output format.

---

## Phase 4: Build Plugins + Groups

### Task 4.1: Shared plugin helper

**Files:**
- Create: `packages/shared/src/plugin-helper.ts`

**Key implementation:**
- `loadImagesFromCSS(css, cssBaseDir)` → extract URLs + read files
- `writeResults(result, outputDir, imageDir)` → write CSS + sprite images

### Task 4.2: Vite plugin

**Files:**
- Create: `packages/plugin-vite/` skeleton
- Create: `packages/plugin-vite/src/index.ts`

**Key implementation:**
- `closeBundle` hook — post-process CSS from build output
- Tests with mock Vite config

### Task 4.3: Webpack plugin

**Files:**
- Create: `packages/plugin-webpack/` skeleton
- Create: `packages/plugin-webpack/src/index.ts`

**Key implementation:**
- `afterEmit` hook — same post-process pattern

### Task 4.4: Rollup plugin

**Files:**
- Create: `packages/plugin-rollup/` skeleton
- Create: `packages/plugin-rollup/src/index.ts`

### Task 4.5: Groups feature

**Files:**
- Modify: `packages/core/src/spriter.ts` (add group-based packing)
- Create: `packages/core/test/groups.test.ts`

**Key implementation:**
- Group images by `config.groups[].images` glob patterns
- Ungrouped images → default sprite
- Each group → separate sprite file

```bash
git commit -m "feat(core): add groups feature for sprite splitting"
```

**Checkpoint:** All 3 build plugins work. Groups feature allows splitting sprites by pattern.

---

## Phase 5: Advanced Features

### Task 5.1: WebP output

- `image/output.ts` — WebP format with quality config
- Already supported by sharp in `generateSprite`, just need config passthrough
- Test: F5.2

### Task 5.2: Retina @2x/@3x

**Files:**
- Create: `packages/core/src/image/retina.ts`
- Create: `packages/core/test/retina.test.ts`

**Key implementation:**
- Detect `@2x`/`@3x` file naming convention
- Generate separate retina sprite at scaled size
- Add `background-size` declarations in CSS
- Tests: F9.1, F9.2, F9.3

### Task 5.3: Watch mode

**Files:**
- Modify: `packages/cli/src/index.ts`

**Key implementation:**
- chokidar file watcher on CSS source + image directories
- Debounced re-run on change
- Tests: manual verification

### Task 5.4: @import expansion

**Files:**
- Modify: `packages/core/src/css/parser.ts`

**Key implementation:**
- Detect `@import` statements → warn initially
- Use `postcss-import` for full expansion
- Test with `test/css/main.css` (which imports style.css, style2.css, style3.css)

### Task 5.5: Percentage background-position

**Files:**
- Modify: `packages/core/src/css/background.ts`
- Modify: `packages/core/src/css/emitter.ts`

**Key implementation:**
- Support `%` values in position parsing
- Calculate correct pixel offset for percentage positions in sprites
- Test: #13 scenario

```bash
git commit -m "feat: add WebP, retina, watch, @import, and percentage position support"
```

**Checkpoint:** All advanced features implemented and tested. Feature-complete for v2.0.

---

## Phase 6: Issue Closure

### Task 6.1: Verify all 11 issues resolved

For each issue, run the corresponding test and verify:

| Issue | Title | Test | Status |
|-------|-------|------|--------|
| #32 | 渐变色兼容 | F1.6, F1.7 | ✅ postcss 不动非 url() |
| #29 | Retina | F9.1-F9.3 | ✅ Phase 5 |
| #28 | 分组 | F8.1-F8.3 | ✅ Phase 4 |
| #27 | 单位配置 | F2.7 | ✅ unit/remBase |
| #26 | 定位不正确 | F6.10 | ✅ 标准 short position |
| #23 | center+px 丢失 | F1.9 | ✅ postcss 精确解析 |
| #21 | GIF 不支持 | F5.4 | ✅ sharp 原生支持 |
| #18 | 指定分组 | F8.1-F8.3 | ✅ Phase 4 |
| #16 | hack 样式消失 | F6.8 | ✅ 只改 url+position |
| #14 | animation 背景图 | F1.8 | ✅ @keyframes 遍历 |
| #13 | 百分比 position | Phase 5 | ✅ |

### Task 6.2: Final cleanup and publish

- Update README.md
- Add CHANGELOG.md
- Verify `pnpm build` succeeds for all packages
- Verify `pnpm test` passes with coverage thresholds
- Commit and tag `v2.0.0-beta.1`

```bash
git commit -m "docs: update README and CHANGELOG for v2.0.0-beta.1"
git tag v2.0.0-beta.1
```

**Checkpoint:** All issues closed. Package ready for beta release.

---

## Summary

| Phase | Tasks | Est. Time | Dependencies |
|-------|-------|-----------|-------------|
| Phase 1: Scaffolding | 4 | 1h | None |
| Phase 2: Core Logic (TDD) | 8 | 4h | Phase 1 |
| Phase 3: CLI + E2E | 3 | 2h | Phase 2 |
| Phase 4: Plugins + Groups | 5 | 2h | Phase 2 |
| Phase 5: Advanced Features | 5 | 2h | Phase 2 |
| Phase 6: Issue Closure | 2 | 1h | All phases |
| **Total** | **27** | **~12h** | |

**Start with Phase 1 → Phase 2 (core TDD). Phases 3-5 can be parallelized after Phase 2 is complete.**
