# iSpriter v2.0

> [English](./README_EN.md) | 中文
>
> 智能 CSS 精灵图生成工具

编写 CSS 时该用什么图片就用什么，该怎么定位就怎么定位，不用改变任何习惯。发布前执行 iSpriter，合并图片和重定位全自动搞定。

基于 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片，使用 [sharp](https://sharp.pixelplumbing.com/) 进行图像处理。

---

## 特性

- **智能提取** — 自动解析 CSS 中的 `background` / `background-image` 的 url 和 position
- **图片去重** — 相同图片只打包一次
- **Bin-packing 排列** — 高效紧凑的精灵图布局
- **合并/分组模式** — 支持将所有图片合并为一张，或按 `groups` 分组输出
- **CSS 压缩** — 基于 clean-css，支持自定义压缩配置
- **Retina 支持** — `@2x` / `@3x` 精灵图自动生成
- **WebP 输出** — 支持 PNG 和 WebP 两种输出格式
- **构建插件** — Vite / Webpack / Rollup 一键接入
- **Watch 模式** — 文件变动自动重新生成
- **@import 展开** — 自动展开 CSS 中的 `@import` 语句
- **排除图片** — `#unsprite` 标记 + `ignoreImages` 配置，灵活跳过
- **rem 单位** — 支持 `px` / `rem` 两种输出单位
- **animation 支持** — 正确处理 `@keyframes` 中的 background 动画

---

## 快速开始

```bash
# 安装
npm install ispriter -g

# 运行
ispriter -c config.json
```

最简配置 `config.json`：

```json
{
  "input": "./src/css/",
  "output": "./dist/css/"
}
```

---

## 配置

完整的 `config.json` 示例：

```json
{
  "workspace": "./",
  "input": {
    "cssSource": ["./src/css/style*.css"],
    "ignoreImages": ["icons/*", "logo.png"]
  },
  "output": {
    "cssDist": "./dist/css/",
    "imageDist": "./img/",
    "format": "png",
    "quality": 80,
    "retina": 2,
    "maxSingleSize": 0,
    "margin": 2,
    "prefix": "sprite_",
    "compress": false,
    "combine": false,
    "combineCSSRule": true,
    "unit": "px",
    "remBase": 16
  },
  "groups": [
    { "name": "icons", "images": ["icons/*"] },
    { "name": "bg", "images": ["bg/*"] }
  ]
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `workspace` | `string` | `"./"` | 工作目录，相对/绝对路径均可 |
| **input** | | | |
| `input.cssSource` | `string \| string[]` | — | **必填**，CSS 文件路径，支持 glob 通配符 |
| `input.ignoreImages` | `string \| string[]` | — | 排除的图片，支持 glob |
| **output** | | | |
| `output.cssDist` | `string` | — | **必填**，CSS 输出目录 |
| `output.imageDist` | `string` | `"./img/"` | 精灵图相对于 cssDist 的路径 |
| `output.format` | `"png" \| "webp"` | `"png"` | 输出图片格式 |
| `output.quality` | `number` | `80` | 图片质量（1-100） |
| `output.retina` | `2 \| 3` | — | Retina 倍率，生成 `@2x` / `@3x` 精灵图 |
| `output.maxSingleSize` | `number` | — | 单张精灵图最大体积（KB），超限自动拆分 |
| `output.margin` | `number` | `2` | 图片间距（px） |
| `output.prefix` | `string` | `"sprite_"` | 精灵图文件名前缀 |
| `output.compress` | `boolean \| object` | `false` | CSS 压缩，`true` 用默认配置，传对象自定义 clean-css 参数 |
| `output.combine` | `boolean` | `false` | 合并所有图片为一张 + 合并所有 CSS 为一个文件 |
| `output.combineCSSRule` | `boolean` | `true` | 将相同精灵图的 CSS 规则合并为一条 |
| `output.unit` | `"px" \| "rem"` | `"px"` | 输出单位 |
| `output.remBase` | `number` | `16` | rem 基准值（仅 `unit: "rem"` 时生效） |
| **groups** | | | |
| `groups[].name` | `string` | — | 分组名称 |
| `groups[].images` | `string \| string[]` | — | 分组包含的图片，支持 glob |

### 排除图片

两种方式：

1. **CSS 内联标记** — 在 `background-image` url 后加 `#unsprite`：
   ```css
   background: url(../images/logo.png#unsprite);
   ```

2. **配置文件** — 使用 `ignoreImages`，支持 glob：
   ```json
   { "input": { "ignoreImages": ["icons/*", "logo.png"] } }
   ```

---

## CLI 用法

```bash
# 指定配置文件
ispriter -c config.json

# 指定 CSS 文件和输出目录
ispriter -f style.css,style2.css -o ./dist/css/

# Watch 模式
ispriter -c config.json --watch
```

| 参数 | 说明 |
|------|------|
| `-c, --config <path>` | 配置文件路径（JSON） |
| `-f, --files <paths>` | CSS 文件，逗号分隔 |
| `-o, --output <path>` | CSS 输出目录 |
| `--watch` | 监听文件变化，自动重新生成 |

---

## 编程接口

```typescript
import { Spriter, parseConfig } from '@ispriter/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

// 读取 CSS 和图片
const css = await readFile('./src/css/style.css', 'utf-8');
const images = new Map<string, Buffer>();
// images.set(absoluteImagePath, buffer) ...

const spriter = new Spriter({
  input: { cssSource: './src/css/style.css' },
  output: { cssDist: './dist/css/' },
});

const result = await spriter.run({ css, images, cssBaseDir: './src/css/' });

// result.css — 合并后的 CSS 字符串
// result.sprites — Map<filename, Buffer> 精灵图
```

---

## 构建插件

### Vite

```typescript
// vite.config.ts
import ispriter from '@ispriter/plugin-vite';

export default {
  plugins: [
    ispriter({
      input: { cssSource: './src/css/**/*.css' },
      output: { cssDist: './assets/css/', format: 'webp' },
    }),
  ],
};
```

### Webpack

```javascript
// webpack.config.js
const { IspriterWebpackPlugin } = require('@ispriter/plugin-webpack');

module.exports = {
  plugins: [
    new IspriterWebpackPlugin({
      input: { cssSource: './src/css/**/*.css' },
      output: { cssDist: './dist/css/', retina: 2 },
    }),
  ],
};
```

### Rollup

```typescript
// rollup.config.ts
import ispriter from '@ispriter/plugin-rollup';

export default {
  plugins: [
    ispriter({
      input: { cssSource: './src/css/**/*.css' },
      output: { cssDist: './dist/css/' },
      outDir: './dist',
    }),
  ],
};
```

---

## 迁移指南（v0.3 → v2.0）

### 破坏性变更

| v0.3 | v2.0 | 说明 |
|------|------|------|
| `input.cssSource` 之外直接写字符串 | 同上，但支持简写 `{ "input": "./css/" }` | 简写形式 `input`/`output` 直接写字符串等同于 `cssSource`/`cssDist` |
| `output.format` 仅 `"png"` | `"png"` 或 `"webp"` | 新增 WebP 支持 |
| `output.maxSize` | `output.maxSingleSize` | 重命名 |
| `input.format` | 已移除 | v2 使用 sharp，自动检测图片格式 |
| `var spriter = require('ispriter')` | `import { Spriter } from '@ispriter/core'` | 改为 ESM + TypeScript |
| `spriter.merge(config)` | `new Spriter(config).run(input)` | API 完全重写 |
| 依赖 `cssom`, `eventproxy`, `pngjs`, `underscore` | 使用 `sharp`, `zod`, 自研 CSS 解析器 | 底层全部替换 |

### 推荐升级步骤

1. 将配置文件调整为 v2.0 结构（参考上方配置表）
2. 如果使用编程接口，改用 `new Spriter(config).run()`
3. 如果使用构建工具，安装对应的 `@ispriter/plugin-*` 插件
4. 运行 `ispriter -c config.json` 验证输出

---

## Monorepo 结构

```
ispriter/
├── packages/
│   ├── core/          # 核心库 @ispriter/core
│   ├── cli/           # 命令行工具
│   ├── shared/        # 共享工具函数
│   ├── plugin-vite/   # Vite 插件
│   ├── plugin-webpack/# Webpack 插件
│   └── plugin-rollup/ # Rollup 插件
├── examples/          # 示例
└── tests/             # 测试
```

## 开发

```bash
pnpm install
pnpm build        # 构建所有子包
pnpm test         # 运行测试
pnpm test:watch   # 监听模式
pnpm lint         # 代码检查
pnpm clean        # 清理构建产物
```

## License

[MIT](./LICENSE)
