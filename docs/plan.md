# iSpriter Improvement Plan

Based on product review (2026-06-01).

## P0 — Must Fix (Completed ✅)

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | CLI version hardcoded `2.0.0-alpha.1` | Dynamic read from `package.json` via `createRequire` | ✅ |
| 2 | `--watch` documented but `run` subcommand says "not yet implemented" | `--watch` was already implemented; removed duplicate command, unified to single default command with correct description | ✅ |
| 3 | Examples can't run — no `package.json`, v0.3 config format | Added `package.json` to all 7 examples, updated configs to v2.0 format, rewrote READMEs | ✅ |
| 4 | npm packages not published | Already published (all @2.0.1). Review report was incorrect on this point. | ✅ N/A |
| 5 | No CHANGELOG | Added `CHANGELOG.md` with full history (v0.1 → v0.3 → v2.0) | ✅ |
| 6 | Documentation all in README | Moved detailed docs to `docs/`: configuration.md, cli.md, api.md, plugins.md, migration.md. README now links to docs. | ✅ |

## P1 — Should Do

| # | Task | Priority | Est. | Status |
|---|------|----------|------|--------|
| 1 | ~~Vite dev mode support~~ | ~~🔴 High~~ | ~~3d~~ | ❌ **Removed** — iSpriter is a build-time script, not a web app. `closeBundle` is correct. |
| 2 | ~~SVG sprite output~~ | ~~🔴 High~~ | ~~5d~~ | ❌ **Removed** — Different tech stack (SVG symbol defs), would be a separate product. |
| 3 | `--dry-run` preview mode | 🟡 Medium | 1d | ✅ **Done** — `ispriter -c config.json --dry-run` shows sprite layout without writing files. Core `Spriter.run({ dryRun: true })` supported. |
| 4 | JSON Schema for config | 🟡 Medium | 0.5d | ✅ **Done** — Generated `docs/config.schema.json` from Zod schema. |
| 5 | ~~Performance benchmark vs spritesmith~~ | ~~🟡 Medium~~ | ~~1d~~ | ❌ **Removed** — Better as blog post content than repo artifact. |
| 6 | CONTRIBUTING.md | 🟡 Medium | 0.5d | ✅ **Done** — Added contributing guide. |

## P2 — Nice to Have

| # | Task | Priority | Est. | Notes |
|---|------|----------|------|-------|
| 1 | `ispriter init` interactive config generator | 🟢 Low | 1d | |
| 2 | Email template mode (inline CSS, VML) | 🟢 Low | 3d | Niche but high-value |
| 3 | Game engine export (TexturePacker compatible) | 🟢 Low | 5d | |
| 4 | CI/CD integration guide | 🟢 Low | 1d | GitHub Actions example |

## 6-Month Success Metric

**Monthly npm downloads reach 5,000.** If not, reconsider continued investment.

Key growth levers:
1. Blog post: "Why CSS Sprite still matters in 2026"
2. Submit to awesome-vite
3. Email template / game engine niche targeting
