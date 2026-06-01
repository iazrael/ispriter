import type { Compiler } from 'webpack';
import { runSpriteGeneration, type SpriterConfig } from '@ispriter/core';

export class IspriterWebpackPlugin {
  constructor(private options: SpriterConfig) {}

  apply(compiler: Compiler) {
    compiler.hooks.afterEmit.tapPromise('IspriterWebpackPlugin', async () => {
      await runSpriteGeneration({
        config: this.options,
        outputDir: compiler.outputPath,
      });
    });
  }
}
