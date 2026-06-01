# @ispriter/core

Core sprite generation engine for [iSpriter](https://github.com/iazrael/ispriter).

## Installation

```bash
npm install @ispriter/core
```

## Usage

```typescript
import { Spriter } from '@ispriter/core';

const spriter = new Spriter({
  input: { cssSource: './src/css/' },
  output: { cssDist: './dist/css/' },
});

const result = await spriter.run({ css, images, cssBaseDir: './src/css/' });
```

## License

MIT
