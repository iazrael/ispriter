# @ispriter/plugin-rollup

Rollup plugin for [iSpriter](https://github.com/iazrael/ispriter) — smart CSS sprite generator.

## Installation

```bash
npm install @ispriter/plugin-rollup -D
```

## Usage

```javascript
// rollup.config.js
import ispriter from '@ispriter/plugin-rollup';

export default {
  plugins: [
    ispriter({
      input: { cssSource: './src/css/' },
      output: { cssDist: './dist/css/' },
    }),
  ],
};
```

## License

MIT
