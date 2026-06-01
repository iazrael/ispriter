import type { ErrorCode } from '@ispriter/shared';

export class IspriterError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'IspriterError';
  }
}
