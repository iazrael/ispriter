# Configuration Reference

Complete configuration reference for iSpriter v2.0.

## Minimal Config

```json
{
  "input": "./src/css/",
  "output": "./dist/css/"
}
```

## Full Config

```json
{
  "workspace": "./",
  "input": {
    "cssSource": ["./src/css/style*.css"],
    "ignoreImages": ["icons/*", "logo.png"]
  },
  "output": {
    "cssDist": "./dist/css/",
    "imageDist": "./img/",
    "format": "png",
    "quality": 80,
    "retina": 2,
    "maxSingleSize": 0,
    "margin": 2,
    "prefix": "sprite_",
    "compress": false,
    "combine": false,
    "combineCSSRule": true,
    "unit": "px",
    "remBase": 16
  },
  "groups": [
    { "name": "icons", "images": ["icons/*"] },
    { "name": "bg", "images": ["bg/*"] }
  ]
}
```

## Config Options

### `workspace`
- **Type:** `string`
- **Default:** `"./"`
- Working directory. Relative or absolute paths accepted.

### Input

#### `input` (shorthand)
- **Type:** `string`
- Shorthand for `input.cssSource`.

#### `input.cssSource`
- **Type:** `string | string[]`
- **Required**
- CSS file paths. Supports glob patterns.

#### `input.ignoreImages`
- **Type:** `string | string[]`
- Images to exclude from spriting. Supports glob patterns.
- Alternative: add `#unsprite` to the URL in CSS.

### Output

#### `output` (shorthand)
- **Type:** `string`
- Shorthand for `output.cssDist`.

#### `output.cssDist`
- **Type:** `string`
- **Required**
- CSS output directory.

#### `output.imageDist`
- **Type:** `string`
- **Default:** `"./img/"`
- Sprite image path, relative to `cssDist`.

#### `output.format`
- **Type:** `"png" | "webp"`
- **Default:** `"png"`
- Output image format.

#### `output.quality`
- **Type:** `number`
- **Default:** `80`
- Image quality (1-100). Applies to WebP.

#### `output.retina`
- **Type:** `2 | 3`
- Retina multiplier. Generates `@2x` / `@3x` sprites.

#### `output.maxSingleSize`
- **Type:** `number`
- Max sprite file size in KB. Exceeding this will split into multiple sprites.

#### `output.margin`
- **Type:** `number`
- **Default:** `2`
- Spacing between images in pixels.

#### `output.prefix`
- **Type:** `string`
- **Default:** `"sprite_"`
- Sprite filename prefix.

#### `output.compress`
- **Type:** `boolean | object`
- **Default:** `false`
- CSS compression via clean-css. `true` for defaults, or pass clean-css options.

#### `output.combine`
- **Type:** `boolean`
- **Default:** `false`
- Merge all images into one sprite + all CSS into one file.

#### `output.combineCSSRule`
- **Type:** `boolean`
- **Default:** `true`
- Merge selectors that share the same sprite into one CSS rule.

#### `output.unit`
- **Type:** `"px" | "rem"`
- **Default:** `"px"`
- Output unit for background-position values.

#### `output.remBase`
- **Type:** `number`
- **Default:** `16`
- Base value for rem conversion. Only used when `unit: "rem"`.

### Groups

#### `groups[].name`
- **Type:** `string`
- Group name. Used as sprite filename.

#### `groups[].images`
- **Type:** `string | string[]`
- Images in this group. Supports glob patterns.

## Excluding Images

Two methods:

1. **CSS inline marker:** Add `#unsprite` after the URL:
   ```css
   background: url(../images/logo.png#unsprite);
   ```

2. **Config file:** Use `ignoreImages`:
   ```json
   { "input": { "ignoreImages": ["icons/*", "logo.png"] } }
   ```
