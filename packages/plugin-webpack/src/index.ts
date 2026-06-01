import type { Compiler } from 'webpack';
import { Spriter, parseConfig, type SpriterConfig } from '@ispriter/core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';

export class IspriterWebpackPlugin {
  constructor(private options: SpriterConfig) {}

  apply(compiler: Compiler) {
    const options = this.options;
    compiler.hooks.afterEmit.tapPromise('IspriterWebpackPlugin', async () => {
      const resolved = parseConfig(options);
      const outDir = compiler.outputPath;

      // Collect CSS from output directory
      const cssFiles = new Map<string, string>();
      const cssPatterns = Array.isArray(resolved.input.cssSource)
        ? resolved.input.cssSource
        : [resolved.input.cssSource];
      for (const pattern of cssPatterns) {
        try {
          const matches = await Array.fromAsync(glob(path.resolve(outDir, pattern)));
          for (const f of matches) {
            if (!f.endsWith('.css')) continue;
            cssFiles.set(f, await readFile(f, 'utf-8'));
          }
        } catch { /* skip */ }
      }
      if (cssFiles.size === 0) return;

      // Collect referenced images
      const images = new Map<string, Buffer>();
      for (const [cssFile, css] of cssFiles) {
        const cssDir = path.dirname(cssFile);
        for (const m of css.matchAll(/url\(['"]?([^'")]+?)['"]?\)/g)) {
          const raw = m[1];
          if (raw.startsWith('data:') || raw.startsWith('http') || raw.includes('#unsprite')) continue;
          const clean = raw.replace(/\?[^#]*/g, '').replace(/#.*/g, '');
          if (images.has(clean)) continue;
          try { images.set(clean, await readFile(path.resolve(cssDir, clean))); } catch { /* skip */ }
        }
      }

      // Run Spriter
      const spriter = new Spriter(options);
      const result = await spriter.run({ css: cssFiles, images, cssBaseDir: outDir });

      // Write outputs
      const cssDist = path.resolve(outDir, resolved.output.cssDist);
      const imgDist = path.resolve(cssDist, resolved.output.imageDist);
      await mkdir(imgDist, { recursive: true });
      for (const [name, buf] of result.spriteImages) await writeFile(path.join(imgDist, name), buf);
      for (const [name, content] of result.cssFiles) await writeFile(path.join(cssDist, path.basename(name)), content);
    });
  }
}
