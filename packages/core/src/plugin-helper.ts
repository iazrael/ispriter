import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { Spriter, type SpriterConfig, parseConfig } from './index.js';

export interface PluginRunOptions {
  config: SpriterConfig;
  outputDir: string;
}

/**
 * Common sprite generation flow shared by CLI and build plugins.
 */
export async function runSpriteGeneration(options: PluginRunOptions): Promise<void> {
  const { config, outputDir } = options;
  const resolved = parseConfig(config);

  // 1. Collect CSS files
  const cssSource = Array.isArray(resolved.input.cssSource)
    ? resolved.input.cssSource
    : [resolved.input.cssSource];

  const cssFiles = new Map<string, string>();
  for (const pattern of cssSource) {
    const absPattern = path.resolve(outputDir, pattern);
    try {
      const matches = await Array.fromAsync(glob(absPattern));
      for (const file of matches) {
        if (!file.endsWith('.css')) continue;
        const content = await readFile(file, 'utf-8');
        cssFiles.set(file, content);
      }
    } catch {
      // glob pattern may match nothing
    }
  }

  if (cssFiles.size === 0) return;

  // 2. Collect referenced images
  const images = new Map<string, Buffer>();
  for (const [cssFile, css] of cssFiles) {
    const cssDir = path.dirname(cssFile);
    for (const m of css.matchAll(/url\(['"]?([^'")]+?)['"]?\)/g)) {
      const rawUrl = m[1];
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('http')) continue;
      if (rawUrl.includes('#unsprite')) continue;
      const clean = rawUrl.replace(/\?[^#]*/g, '').replace(/#.*/g, '');
      if (images.has(clean)) continue;
      try {
        images.set(clean, await readFile(path.resolve(cssDir, clean)));
      } catch {
        // skip missing images
      }
    }
  }

  // 3. Run Spriter
  const spriter = new Spriter(config);
  const result = await spriter.run({ css: cssFiles, images, cssBaseDir: outputDir });

  // 4. Write outputs
  const cssDist = path.resolve(outputDir, resolved.output.cssDist);
  const imgDist = path.resolve(cssDist, resolved.output.imageDist);
  await mkdir(imgDist, { recursive: true });

  for (const [name, buf] of result.spriteImages) {
    await writeFile(path.join(imgDist, name), buf);
  }
  for (const [name, content] of result.cssFiles) {
    await writeFile(path.join(cssDist, path.basename(name)), content);
  }
}
