import { Command } from 'commander';
import { Spriter } from '@ispriter/core';
import { parseConfig, type SpriterConfig } from '@ispriter/core';
import { readFile, writeFile, mkdir, glob } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('ispriter')
  .description('CSS sprite generator')
  .version('2.0.0-alpha.1');

program
  .command('run')
  .description('Generate sprites from CSS files')
  .option('-c, --config <path>', 'config file path (JSON)')
  .option('-f, --files <paths>', 'CSS files (comma separated)')
  .option('-o, --output <path>', 'CSS output directory')
  .option('--watch', 'watch mode (not yet implemented)')
  .action(async (opts) => {
    try {
      const config = await resolveConfig(opts);
      await runSpriter(config);
    } catch (e: any) {
      if (e.name === 'IspriterError') {
        console.error(`❌ ${e.code}: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  });

// 默认命令：直接运行
program
  .option('-c, --config <path>', 'config file path (JSON)')
  .option('-f, --files <paths>', 'CSS files (comma separated)')
  .option('-o, --output <path>', 'CSS output directory')
  .action(async (opts) => {
    try {
      const config = await resolveConfig(opts);
      await runSpriter(config);
    } catch (e: any) {
      if (e.name === 'IspriterError') {
        console.error(`❌ ${e.code}: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  });

async function resolveConfig(opts: any): Promise<SpriterConfig> {
  if (opts.config) {
    const configPath = path.resolve(opts.config);
    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  }

  if (opts.files) {
    const files = opts.files.split(',').map((f: string) => f.trim());
    return {
      input: { cssSource: files },
      output: { cssDist: opts.output || './sprite/css/' },
    };
  }

  throw new Error('Either --config or --files is required');
}

async function runSpriter(config: SpriterConfig): Promise<void> {
  const resolved = parseConfig(config);
  const workspace = path.resolve(resolved.workspace);

  // 收集 CSS 文件
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
    return;
  }

  // 收集图片
  const images = new Map<string, Buffer>();
  const allUrls: string[] = [];

  // 简单提取 url() 用于读取图片
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

  // 读取图片文件
  for (const [cssFile] of cssFiles) {
    const cssDir = path.dirname(cssFile);
    for (const url of allUrls) {
      if (images.has(url)) continue;
      const imgPath = path.resolve(cssDir, url);
      try {
        const buf = await readFile(imgPath);
        images.set(url, buf);
      } catch {
        // 图片不存在，由 Spriter 处理跳过
      }
    }
  }

  console.log(`📦 Processing ${cssFiles.size} CSS files with ${images.size} images...`);

  // 运行
  const spriter = new Spriter(config);
  const result = await spriter.run({ css: cssFiles, images, cssBaseDir: workspace });

  // 输出
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

program.parse();
