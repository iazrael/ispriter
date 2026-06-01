import { z } from 'zod';
import { IspriterError } from './error.js';

export const SpriterConfigSchema = z.object({
  workspace: z.string().default('./'),
  input: z.object({
    cssSource: z.union([z.string(), z.array(z.string())]),
    ignoreImages: z.union([z.string(), z.array(z.string())]).optional(),
  }),
  output: z.object({
    cssDist: z.string(),
    imageDist: z.string().default('./img/'),
    format: z.enum(['png', 'webp']).default('png'),
    quality: z.number().min(1).max(100).default(80),
    retina: z.union([z.literal(2), z.literal(3)]).optional(),
    maxSingleSize: z.number().positive().optional(),
    margin: z.number().nonnegative().default(2),
    prefix: z.string().default('sprite_'),
    compress: z.union([z.boolean(), z.record(z.unknown())]).default(false),
    combine: z.boolean().default(false),
    combineCSSRule: z.boolean().default(true),
    unit: z.enum(['px', 'rem']).default('px'),
    remBase: z.number().positive().default(16),
  }),
  groups: z
    .array(z.object({
      name: z.string(),
      images: z.union([z.string(), z.array(z.string())]),
    }))
    .optional(),
});

export type SpriterConfig = z.input<typeof SpriterConfigSchema>;
export type ResolvedConfig = z.output<typeof SpriterConfigSchema>;

export function normalizeConfig(input: string | SpriterConfig): SpriterConfig {
  if (typeof input === 'string') {
    return { input: { cssSource: input }, output: { cssDist: input } };
  }
  return input;
}

export function parseConfig(raw: unknown): ResolvedConfig {
  const config = normalizeConfig(raw as string | SpriterConfig);
  const result = SpriterConfigSchema.safeParse(config);
  if (!result.success) {
    throw new IspriterError(
      `Invalid config: ${result.error.issues.map((i) => i.message).join(', ')}`,
      'CONFIG_INVALID',
      { issues: result.error.issues },
    );
  }
  return result.data;
}
