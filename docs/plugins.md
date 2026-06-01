# Build Plugins

iSpriter provides plugins for Vite, Webpack, and Rollup.

## Vite

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

## Webpack

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

## Rollup

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

## Notes

- Plugins run at build time (`closeBundle` phase for production builds)
- For development, use the CLI in watch mode: `ispriter -c config.json --watch`
- Configuration is the same as the CLI config.json format
