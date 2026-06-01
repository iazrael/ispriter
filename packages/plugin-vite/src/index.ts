import type { Plugin, ResolvedConfig as ViteConfig } from 'vite';
import { runSpriteGeneration, type SpriterConfig } from '@ispriter/core';

export default function ispriterVite(options: SpriterConfig): Plugin {
  let viteConfig: ViteConfig;

  return {
    name: '@ispriter/plugin-vite',
    apply: 'build',

    configResolved(config) {
      viteConfig = config;
    },

    async closeBundle() {
      await runSpriteGeneration({
        config: options,
        outputDir: viteConfig.build.outDir,
      });
    },
  };
}
