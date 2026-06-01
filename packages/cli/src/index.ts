import { Command } from 'commander';
import { Spriter } from '@ispriter/core';
import { parseConfig, type SpriterConfig } from '@ispriter/core';
import { readFile, writeFile, mkdir, glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const program = new Command();

program
  .name('ispriter')
  .description('CSS sprite generator')
  .version(pkg.version);

function createRunAction() {
  return async (opts: any) => {
    try {
      const config = await resolveConfig(opts);
      if (opts.dryRun) {
        await runSpriterDry(config);
      } else {
        await runSpriter(config);
        if (opts.watch) {
          await startWatch(config);
        }
      }
    } catch (e: any) {
      if (e.name === 'IspriterError') {
        console.error(`❌ ${e.code}: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  };
}

program
  .command('run', { isDefault: true })
  .description('Generate sprites from CSS files')
  .option('-c, --config <path>', 'config file path (JSON)')
  .option('-f, --files <paths>', 'CSS files (comma separated)')
  .option('-o, --output <path>', 'CSS output directory')
  .option('--watch', 'watch for file changes and regenerate')
  .option('--dry-run', 'preview what would be sprited without writing files')
  .action(createRunAction());

async function resolveConfig(opts: any): Promise<SpriterConfig> {
  if (opts.config) {
    const configPath = path.resolve(opts.config);
    try {
      const raw = await readFile(configPath, 'utf-8');
      return JSON.parse(raw);
    } catch (e: any) {
      throw new Error(`Failed to read/parse config file "${configPath}": ${e.message}`);
    }
  }

  if (opts.files) {
    const files = opts.files.split(',').map((f: string) => f.trim());
    return {
      input: { cssSource: files },
      output: { cssDist: opts.output || './sprite/css/' },
    };
  }

  program.help();
  // unreachable, but keeps type checker happy
  return {} as SpriterConfig;
}

async function collectInputs(config: SpriterConfig) {
  const resolved = parseConfig(config);
  const workspace = path.resolve(resolved.workspace);

  const cssSource = Array.isArray(resolved.input.cssSource)
    ? resolved.input.cssSource
    : [resolved.input.cssSource];

  const cssFiles = new Map<string, string>();
  for (const pattern of cssSource) {
    const absPattern = path.resolve(workspace, pattern);
    const matches = await Array.fromAsync(glob(absPattern));
    for (const file of matches) {
      if (!file.endsWith('.css')) continue;
      const content = await readFile(file, 'utf-8');
      cssFiles.set(file, content);
    }
  }

  if (cssFiles.size === 0) {
    console.warn('⚠️ No CSS files found');
    return null;
  }

  const images = new Map<string, Buffer>();
  const allUrls: string[] = [];

  for (const [, css] of cssFiles) {
    const urlMatches = css.matchAll(/url\(['"]?([^'")]+?)['"]?\)/g);
    for (const m of urlMatches) {
      const rawUrl = m[1];
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('http')) continue;
      if (rawUrl.includes('#unsprite')) continue;
      const clean = rawUrl.replace(/\?[^#]*/g, '').replace(/#.*/g, '');
      if (!allUrls.includes(clean)) allUrls.push(clean);
    }
  }

  for (const [cssFile] of cssFiles) {
    const cssDir = path.dirname(cssFile);
    for (const url of allUrls) {
      if (images.has(url)) continue;
      const imgPath = path.resolve(cssDir, url);
      if (!imgPath.startsWith(workspace)) continue;
      try {
        const buf = await readFile(imgPath);
        images.set(url, buf);
      } catch {
        // 图片不存在，由 Spriter 处理跳过
      }
    }
  }

  return { resolved, workspace, cssFiles, images };
}

async function runSpriter(config: SpriterConfig): Promise<void> {
  const inputs = await collectInputs(config);
  if (!inputs) return;
  const { resolved, workspace, cssFiles, images } = inputs;

  console.log(`📦 Processing ${cssFiles.size} CSS files with ${images.size} images...`);

  const spriter = new Spriter(config);
  const result = await spriter.run({ css: cssFiles, images, cssBaseDir: workspace });

  const cssDist = path.resolve(workspace, resolved.output.cssDist);
  const imgDist = path.resolve(cssDist, resolved.output.imageDist);

  await mkdir(imgDist, { recursive: true });

  for (const [name, buf] of result.spriteImages) {
    await writeFile(path.join(imgDist, name), buf);
  }

  for (const [name, content] of result.cssFiles) {
    const outName = path.basename(name);
    await writeFile(path.join(cssDist, outName), content);
  }

  console.log(`✅ Generated ${result.spriteImages.size} sprite(s), updated ${result.cssFiles.size} CSS file(s)`);
  
  if (result.skippedImages.length > 0) {
    console.warn(`⚠️ Skipped ${result.skippedImages.length} image(s): ${result.skippedImages.join(', ')}`);
  }
}

async function runSpriterDry(config: SpriterConfig): Promise<void> {
  const inputs = await collectInputs(config);
  if (!inputs) return;
  const { workspace, cssFiles, images } = inputs;

  console.log(`📦 Dry-run: analyzing ${cssFiles.size} CSS files with ${images.size} images...`);

  const spriter = new Spriter(config);
  const result = await spriter.run({ css: cssFiles, images, cssBaseDir: workspace, dryRun: true });

  if (result.dryRunReport) {
    console.log(result.dryRunReport);
  }
}

async function startWatch(config: SpriterConfig): Promise<void> {
  const { watch } = await import('chokidar');
  const resolved = parseConfig(config);
  const workspace = path.resolve(resolved.workspace);

  console.log('👀 Watching for changes...');

  const cssPatterns = Array.isArray(resolved.input.cssSource)
    ? resolved.input.cssSource
    : [resolved.input.cssSource];

  const watcher = watch(cssPatterns.map((p) => path.resolve(workspace, p)), {
    ignoreInitial: true,
  });

  watcher.on('change', async (file) => {
    console.log(`📝 ${file} changed, regenerating...`);
    try {
      await runSpriter(config);
    } catch (e: any) {
      console.error(`❌ Error: ${e.message}`);
    }
  });

  watcher.on('add', async (file) => {
    console.log(`➕ ${file} added, regenerating...`);
    try {
      await runSpriter(config);
    } catch (e: any) {
      console.error(`❌ Error: ${e.message}`);
    }
  });
}

program.parse();
