# CLI Reference

## Installation

```bash
# Global
npm install ispriter -g

# Project-local (recommended)
npm install ispriter --save-dev
npx ispriter -c config.json
```

## Commands

### `ispriter` (default: `run`)

Generate sprites from CSS files.

```bash
ispriter -c config.json
ispriter -f style.css,style2.css -o ./dist/css/
ispriter -c config.json --watch
```

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--config <path>` | `-c` | Config file path (JSON) |
| `--files <paths>` | `-f` | CSS files, comma separated |
| `--output <path>` | `-o` | CSS output directory |
| `--watch` | — | Watch for file changes and regenerate |
| `--version` | `-V` | Print version |
| `--help` | `-h` | Print help |

## Examples

```bash
# With config file
ispriter -c config.json

# Direct file input
ispriter -f src/css/style.css -o dist/css/

# Watch mode
ispriter -c config.json --watch
```
