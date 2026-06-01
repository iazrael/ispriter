import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import path from 'node:path';
import { Spriter, type SpriterConfig, parseConfig, extractBackgrounds } from './index.js';

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

  // 2. Collect referenced images using parser (instead of fragile regex)
  const rules = await extractBackgrounds(cssFiles);
  const imageUrls = new Set<string>();
  for (const rule of rules) {
    imageUrls.add(rule.imageUrl);
  }

  const images = new Map<string, Buffer>();
  const allowedDir = path.resolve(outputDir);
  for (const url of imageUrls) {
    if (url.startsWith('data:') || url.startsWith('http')) continue;
    if (url.length > 4096) continue; // S4: skip overly long URLs
    // Try resolving relative to each CSS file's directory
    for (const [cssFile] of cssFiles) {
      const absPath = path.resolve(path.dirname(cssFile), url);
      // S1: prevent path traversal
      if (!absPath.startsWith(allowedDir)) continue;
      try {
        if (!images.has(url)) {
          images.set(url, await readFile(absPath));
        }
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
