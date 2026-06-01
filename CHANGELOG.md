# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.2] - 2026-06-01

### Added
- `--dry-run` CLI flag — preview sprite layout without writing files
- `dryRun` option in `SpriterRunInput` — programmatic dry-run support
- `dryRunReport` field in `SpriterResult` — structured analysis report
- JSON Schema for config (`docs/config.schema.json`) with generator script
- CONTRIBUTING.md
- E2E tests for all 7 example projects + dry-run

### Fixed
- CLI version now reads from package.json (was hardcoded `2.0.0-alpha.1`)
- `ispriter` without arguments shows help instead of throwing error
- Path traversal validation no longer blocks valid relative paths (`../../`)
- Output paths (`cssDist`/`imageDist`) now validated to stay within workspace
- `--dry-run` and `--watch` flagged as mutually exclusive

### Changed
- Refactored CLI: extracted `collectInputs()` shared by run/dry-run/watch
- Replaced `opts: any` with typed `CliOptions` interface
- Cleaned up `.gitignore` — removed legacy scattered rules
- Simplified README — moved detailed docs to `docs/` directory

## [2.0.1] - 2026-06-01

### Added
- English README (`README_EN.md`)
- Per-package README files for all published packages

## [2.0.0] - 2026-06-01

### Added — Complete Rewrite

This is a full rewrite of iSpriter from the ground up with a modern architecture.

**Architecture:**
- Monorepo structure with `@ispriter/core`, `@ispriter/cli`, `@ispriter/shared`
- TypeScript + ESM throughout
- Build plugins: `@ispriter/plugin-vite`, `@ispriter/plugin-webpack`, `@ispriter/plugin-rollup`
- Zod schema validation for configuration
- Custom error types with error codes (`IspriterError`)

**Core Features:**
- CSS-first sprite generation — zero code changes required
- Smart CSS parsing with `postcss` — handles `background`, `background-image`, shorthand, and `@keyframes` animations
- Bin-packing algorithm for compact sprite layouts
- Image deduplication — identical images packed only once
- Group mode — split sprites by configurable groups
- `@import` expansion — automatically resolves CSS `@import` statements
- `#unsprite` marker and `ignoreImages` config for exclusion
- WebP output format support
- Retina support — automatic `@2x` / `@3x` sprite generation
- CSS minification via `clean-css` (configurable)
- `rem` unit output support
- Watch mode for auto-regeneration on file changes
- `combine` mode — merge all images into one sprite and all CSS into one file
- `combineCSSRule` — merge selectors sharing the same sprite

**Image Processing:**
- `sharp` (libuv-based) replaces `pngjs` — 10x+ faster image processing
- Automatic format detection
- Configurable quality and margin

**Testing:**
- Unit tests with `vitest` for core, config, parser, packer, emitter
- E2E tests using original v0.3 test fixtures

### Changed (from v0.3.x)

| v0.3 | v2.0 | Notes |
|------|------|-------|
| Single package, CommonJS | Monorepo, ESM + TypeScript | Full architectural overhaul |
| `pngjs` for image processing | `sharp` | 10x+ performance improvement |
| `cssom` for CSS parsing | `postcss` | More reliable and extensible |
| `underscore`, `eventproxy` | Removed | Modern JS patterns |
| `spriter.merge(config)` | `new Spriter(config).run(input)` | New API |
| CLI: `node bin/ispriter` | `ispriter` (commander-based) | Proper CLI with options |

### Removed
- `input.format` config option (sharp auto-detects format)
- Legacy `src/bin/lib` v0.3 codebase

---

## [0.3.x] - 2013–2015

### Added
- Initial public release
- CSS sprite generation with bin-packing
- PNG output via `pngjs`
- CLI and programmatic API (`spriter.merge()`)
- Image deduplication and CSS compression
- `maxSize` config for sprite splitting
- Community contributions: image versioning, bug fixes

---

## [0.1.0] - 2012

- Initial release from AlloyTeam, Tencent
