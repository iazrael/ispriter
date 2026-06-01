# Programmatic API

## Installation

```bash
npm install @ispriter/core
```

## Basic Usage

```typescript
import { Spriter } from '@ispriter/core';
import { readFile } from 'node:fs/promises';

const spriter = new Spriter({
  input: { cssSource: './src/css/style.css' },
  output: { cssDist: './dist/css/' },
});

const css = await readFile('./src/css/style.css', 'utf-8');
const images = new Map<string, Buffer>();

const result = await spriter.run({ css, images, cssBaseDir: './src/css/' });

// result.cssFiles — Map<filename, string> — updated CSS content
// result.spriteImages — Map<filename, Buffer> — generated sprite images
// result.skippedImages — string[] — images that were skipped
```

## API Reference

### `new Spriter(config: SpriterConfig)`

Create a Spriter instance.

- `config` — Configuration object (same format as config.json)

### `spriter.run(input: SpriterInput): Promise<SpriterResult>`

Execute sprite generation.

**Input:**
- `input.css` — `Map<string, string>` — CSS filename → content
- `input.images` — `Map<string, Buffer>` — image path → buffer
- `input.cssBaseDir` — `string` — base directory for resolving relative image paths

**Result:**
- `result.cssFiles` — `Map<string, string>` — updated CSS filename → content
- `result.spriteImages` — `Map<string, Buffer>` — sprite filename → image buffer
- `result.skippedImages` — `string[]` — skipped image URLs

### Error Handling

```typescript
import { IspriterError } from '@ispriter/core';

try {
  const result = await spriter.run(input);
} catch (e) {
  if (e instanceof IspriterError) {
    console.error(e.code, e.message);
    // e.code: CONFIG_INVALID | CSS_PARSE_ERROR | IMAGE_NOT_FOUND | ...
  }
}
```
