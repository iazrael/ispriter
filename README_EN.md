# iSpriter v2.0

> Smart CSS sprite generator — write CSS as usual, let iSpriter handle the rest.

[中文文档](./README.md)

---

## Features

- **Smart extraction** — Automatically parses `background` / `background-image` URLs and positions
- **Image deduplication** — Identical images packed only once
- **Bin-packing layout** — Efficient, compact sprite sheets
- **Grouped output** — Merge all into one sprite or split by groups
- **CSS minification** — Powered by clean-css with custom config support
- **Retina support** — Generate `@2x` / `@3x` sprites automatically
- **WebP output** — Choose between PNG and WebP formats
- **Build plugins** — First-class Vite, Webpack, and Rollup integration
- **Watch mode** — Auto-regenerate on file changes
- **@import expansion** — Recursively resolves CSS `@import` statements
- **Exclude images** — `#unsprite` marker in CSS or `ignoreImages` in config
- **rem support** — Output in `px` or `rem` units
- **@keyframes** — Correctly handles background animations

---

## Quick Start

```bash
npm install ispriter -g
ispriter -c config.json
```

Minimal `config.json`:

```json
{
  "input": "./src/css/",
  "output": "./dist/css/"
}
```

---

## Configuration

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

### Key Options

| Option | Default | Description |
|--------|---------|-------------|
| `input.cssSource` | — | *(required)* CSS file paths, supports glob |
| `output.cssDist` | — | *(required)* CSS output directory |
| `output.format` | `"png"` | `"png"` or `"webp"` |
| `output.retina` | — | `2` or `3` for Retina sprites |
| `output.maxSingleSize` | — | Max sprite size in KB, auto-splits if exceeded |
| `output.margin` | `2` | Spacing between images (px) |
| `output.compress` | `false` | CSS minification (bool or clean-css options) |
| `output.combine` | `false` | Merge all images + CSS into single files |

---

## CLI

```bash
# Config file
ispriter -c config.json

# Direct CSS files
ispriter -f style.css,style2.css -o ./dist/css/

# Preview mode (no files written)
ispriter -c config.json --dry-run

# Watch mode
ispriter -c config.json --watch
```

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Config file path (JSON) |
| `-f, --files <paths>` | CSS files, comma separated |
| `-o, --output <path>` | CSS output directory |
| `--watch` | Watch for file changes and regenerate |
| `--dry-run` | Preview mode, analyze without writing files |
| `-V, --version` | Print version |
| `-h, --help` | Print help |

---

## Programmatic API

```typescript
import { Spriter } from '@ispriter/core';

const spriter = new Spriter({
  input: { cssSource: './src/css/style.css' },
  output: { cssDist: './dist/css/' },
});

const result = await spriter.run({ css, images, cssBaseDir: './src/css/' });
// result.css — merged CSS string
// result.sprites — Map<filename, Buffer>
```

---

## Build Plugins

### Vite

```typescript
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

## Monorepo Structure

```
ispriter/
├── packages/
│   ├── core/            # @ispriter/core
│   ├── cli/             # CLI tool
│   ├── shared/          # Shared utilities
│   ├── plugin-vite/     # Vite plugin
│   ├── plugin-webpack/  # Webpack plugin
│   └── plugin-rollup/   # Rollup plugin
├── examples/
└── tests/
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

## License

[MIT](./LICENSE)
