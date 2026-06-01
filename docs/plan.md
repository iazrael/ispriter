# iSpriter Improvement Plan

Based on product review (2026-06-01). Branch: `fix/p0-polish`

## P0 — Must Fix (Completed ✅)

| # | Issue | Fix | Status |
|---|-------|-----|--------|
| 1 | CLI version hardcoded `2.0.0-alpha.1` | Dynamic read from `package.json` via `createRequire` | ✅ |
| 2 | `--watch` documented but `run` subcommand says "not yet implemented" | `--watch` was already implemented; removed duplicate command, unified to single default command with correct description | ✅ |
| 3 | Examples can't run — no `package.json`, v0.3 config format | Added `package.json` to all 7 examples, updated configs to v2.0 format, rewrote READMEs | ✅ |
| 4 | npm packages not published | Already published (all @2.0.1). Review report was incorrect on this point. | ✅ N/A |
| 5 | No CHANGELOG | Added `CHANGELOG.md` with full history (v0.1 → v0.3 → v2.0) | ✅ |
| 6 | Documentation all in README | Moved detailed docs to `docs/`: configuration.md, cli.md, api.md, plugins.md, migration.md. README now links to docs. | ✅ |

## P1 — Should Do (Next Sprint)

| # | Task | Priority | Est. | Notes |
|---|------|----------|------|-------|
| 1 | Vite dev mode support (`transform`/`load` hook) | 🔴 High | 3d | Currently only works at `closeBundle` — useless in dev |
| 2 | SVG sprite output | 🔴 High | 5d | svg-sprite has 820K monthly downloads; biggest growth opportunity |
| 3 | `--dry-run` preview mode | 🟡 Medium | 1d | Show what would be sprited without writing files |
| 4 | JSON Schema for config | 🟡 Medium | 0.5d | IDE autocomplete for config.json |
| 5 | Performance benchmark vs spritesmith | 🟡 Medium | 1d | Prove v2's advantage with data |
| 6 | CONTRIBUTING.md | 🟡 Medium | 0.5d | Lower barrier for contributors |

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
1. SVG sprite support (captures svg-sprite's audience)
2. Vite plugin dev mode (removes biggest friction)
3. Blog post: "Why CSS Sprite still matters in 2026"
4. Submit to awesome-vite
