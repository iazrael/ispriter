import type { Plugin } from 'rollup';
import { runSpriteGeneration, type SpriterConfig } from '@ispriter/core';

export interface IspriterRollupOptions extends SpriterConfig {
  /** Output directory — defaults to current working directory */
  outDir?: string;
}

export default function ispriterRollup(options: IspriterRollupOptions): Plugin {
  return {
    name: '@ispriter/plugin-rollup',
    async closeBundle() {
      const { outDir: customOutDir, ...config } = options;
      await runSpriteGeneration({
        config,
        outputDir: customOutDir ?? '.',
      });
    },
  };
}
