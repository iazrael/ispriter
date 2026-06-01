# @ispriter/plugin-vite

Vite plugin for [iSpriter](https://github.com/iazrael/ispriter) — smart CSS sprite generator.

## Installation

```bash
npm install @ispriter/plugin-vite -D
```

## Usage

```typescript
// vite.config.ts
import ispriter from '@ispriter/plugin-vite';

export default {
  plugins: [ispriter({
    input: { cssSource: './src/css/' },
    output: { cssDist: './dist/css/' },
  })],
};
```

## License

MIT
