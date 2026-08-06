/**
 * Typed storage errors. Raw provider/system messages never reach the UI;
 * these errors carry a message key the UI can render (Constitution FR-025).
 */

export class PayloadValidationError extends Error {
  constructor(public readonly detail: string) {
    super('Payload validation failed');
    this.name = 'PayloadValidationError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly to: string
  ) {
    super(`Invalid transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
