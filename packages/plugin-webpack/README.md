# @ispriter/plugin-webpack

Webpack plugin for [iSpriter](https://github.com/iazrael/ispriter) — smart CSS sprite generator.

## Installation

```bash
npm install @ispriter/plugin-webpack -D
```

## Usage

```javascript
// webpack.config.js
import IspriterPlugin from '@ispriter/plugin-webpack';

export default {
  plugins: [
    new IspriterPlugin({
      input: { cssSource: './src/css/' },
      output: { cssDist: './dist/css/' },
    }),
  ],
};
```

## License

MIT
