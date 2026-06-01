# Migration Guide: v0.3 → v2.0

## Breaking Changes

| v0.3 | v2.0 | Notes |
|------|------|-------|
| `input.cssSource` as top-level string | Same, but shorthand `{ "input": "./css/" }` supported | String shorthand maps to `cssSource`/`cssDist` |
| `output.format` only `"png"` | `"png"` or `"webp"` | WebP support added |
| `output.maxSize` | `output.maxSingleSize` | Renamed |
| `input.format` | Removed | v2 uses sharp, auto-detects format |
| `require('ispriter')` | `import { Spriter } from '@ispriter/core'` | ESM + TypeScript |
| `spriter.merge(config)` | `new Spriter(config).run(input)` | API completely rewritten |
| Dependencies: `cssom`, `eventproxy`, `pngjs`, `underscore` | `sharp`, `postcss`, `zod` | All replaced |

## Upgrade Steps

1. **Update config file** to v2.0 format
   - Rename `output.maxSize` → `output.maxSingleSize`
   - Remove `input.format`
   - Use standard JSON (no comments)

2. **If using programmatic API:**
   ```typescript
   // Old
   const spriter = require('ispriter');
   spriter.merge(config);

   // New
   import { Spriter } from '@ispriter/core';
   const result = await new Spriter(config).run({ css, images, cssBaseDir });
   ```

3. **If using build tools**, install the corresponding plugin:
   ```bash
   npm install @ispriter/plugin-vite    # or plugin-webpack, plugin-rollup
   ```

4. **Run and verify:**
   ```bash
   ispriter -c config.json
   ```

## Dropped Features

- **`input.format`** — sharp auto-detects image formats, no need to specify
- **JSON-with-comments config** — use standard JSON only
- **Legacy `src/bin/lib` API** — replaced by `@ispriter/core` + `@ispriter/cli`
