# iSpriter v2.0

> [English](./README_EN.md) | 中文
>
> 智能 CSS 精灵图生成工具

编写 CSS 时该用什么图片就用什么，该怎么定位就怎么定位，不用改变任何习惯。发布前执行 iSpriter，合并图片和重定位全自动搞定。

基于 [bin-packing](https://github.com/jakesgordon/bin-packing) 算法排列图片，使用 [sharp](https://sharp.pixelplumbing.com/) 进行图像处理。

📚 **文档：[配置参考](./docs/configuration.md) | [CLI 用法](./docs/cli.md) | [编程 API](./docs/api.md) | [构建插件](./docs/plugins.md) | [迁移指南](./docs/migration.md)**

---

## 快速开始

```bash
# 项目内安装（推荐）
npm install ispriter --save-dev
npx ispriter -c config.json
```

最简配置 `config.json`：

```json
{
  "input": "./src/css/",
  "output": "./dist/css/"
}
```

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
- **排除图片** — `#unsprite` 标记 + `ignoreImages` 配置
- **animation 支持** — 正确处理 `@keyframes` 中的 background 动画

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
├── examples/          # 示例（单文件 / 多文件 / combine / animation / @import 等）
└── tests/             # 测试
```

## 开发

```bash
pnpm install
pnpm build        # 构建所有子包
pnpm test         # 运行测试
pnpm lint         # 代码检查
pnpm clean        # 清理构建产物
```

## License

[MIT](./LICENSE)
