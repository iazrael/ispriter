# Contributing to iSpriter

Thanks for your interest! Here's how to get started.

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Setup

```bash
git clone https://github.com/iazrael/ispriter.git
cd ispriter
pnpm install
pnpm build
```

## Development

```bash
pnpm build          # Build all packages
pnpm test           # Run unit tests
pnpm test:watch     # Watch mode
pnpm test:e2e       # End-to-end tests
pnpm lint           # Check formatting
pnpm format         # Auto-fix formatting
```

## Project Structure

```
packages/
  core/           # Core library (@ispriter/core)
  cli/            # CLI entry point
  shared/         # Shared utilities
  plugin-vite/    # Vite plugin
  plugin-webpack/ # Webpack plugin
  plugin-rollup/  # Rollup plugin
tests/
  e2e/            # End-to-end tests with fixture projects
```

## Making Changes

1. Create a branch: `feat/your-feature` or `fix/your-fix`
2. Make changes with tests
3. Run `pnpm build && pnpm test` to verify
4. Open a PR against `main`

## Code Style

- TypeScript, strict mode
- Prettier for formatting (run `pnpm format`)
- No `any` types
- Exported APIs must have JSDoc comments

## Reporting Issues

- Include reproduction steps
- Include iSpriter version and Node.js version
- Attach config file if applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
