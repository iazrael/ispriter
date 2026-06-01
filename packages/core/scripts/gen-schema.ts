/**
 * Generate JSON Schema from the Zod config schema.
 * Run: npx tsx packages/core/scripts/gen-schema.ts
 */
import { SpriterConfigSchema } from '../src/config.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Lazy import — install if missing
let zodToJsonSchemaFn: typeof zodToJsonSchema;
try {
  const mod = await import('zod-to-json-schema');
  zodToJsonSchemaFn = mod.zodToJsonSchema;
} catch {
  console.error('Please install zod-to-json-schema: pnpm add -D zod-to-json-schema');
  process.exit(1);
}

const jsonSchema = zodToJsonSchemaFn(SpriterConfigSchema, {
  name: 'iSpriter Config',
  target: 'json-7',
});

// Remove $schema key for cleanliness
const clean = { ...jsonSchema };
delete (clean as any).$schema;

console.log(JSON.stringify(clean, null, 2));
