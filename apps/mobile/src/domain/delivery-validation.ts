import { z } from 'zod';

export const validationStatusSchema = z.enum(['pass', 'fail', 'blocked']);

const workspaceEvidencePath = z
  .string()
  .min(1)
  .refine((value) => !/^[A-Za-z]:[\\/]/.test(value), 'use workspace-relative evidence path')
  .refine((value) => !value.includes('..'), 'evidence path must stay in workspace');

export const validationCaseSchema = z
  .object({
    id: z.string().min(1),
    requirements: z.array(z.string().regex(/^(FR|SC)-\d{3}$/)).min(1),
    kind: z.enum(['automated', 'visual', 'native', 'participant', 'inspection', 'performance']),
    environment: z.string().min(1),
    procedure: z.string().min(1),
    expected: z.string().min(1),
    actual: z.string().min(1),
    status: validationStatusSchema,
    evidencePaths: z.array(workspaceEvidencePath),
    executedAt: z.number().int().nonnegative().optional(),
    blockedBy: z.string().min(1).optional()
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === 'blocked' && !value.blockedBy) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'blocked case needs prerequisite' });
    }
    if (value.status !== 'blocked' && value.executedAt === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'executed case needs date' });
    }
  });

export type ValidationCase = z.infer<typeof validationCaseSchema>;

export const deliveryGateSchema = z
  .object({
    id: z.enum([
      'architecture',
      'behavior-regression',
      'persistence',
      'localization',
      'accessibility',
      'privacy',
      'visual-states',
      'performance',
      'android-native',
      'ios-native',
      'participant-study',
      'final-end-to-end-consistency'
    ]),
    requiredCases: z.array(z.string().min(1)).min(1),
    status: validationStatusSchema,
    exceptionId: z.string().min(1).nullable().optional()
  })
  .strict();

export type DeliveryGate = z.infer<typeof deliveryGateSchema>;

export const deliveryExceptionSchema = z
  .object({
    id: z.string().min(1),
    gateId: deliveryGateSchema.shape.id,
    approvedBy: z.string().min(1),
    risk: z.string().min(1),
    owner: z.string().min(1),
    expiresAt: z.number().int().positive(),
    requiredEvidence: z.string().min(1),
    status: z.enum(['active', 'fulfilled', 'expired', 'revoked'])
  })
  .strict()
  .refine((value) => value.expiresAt > Date.now(), 'exception expiry must be in the future');

export type DeliveryException = z.infer<typeof deliveryExceptionSchema>;

export function canCloseDeliveryGate(
  gate: DeliveryGate,
  cases: readonly ValidationCase[],
  exception: DeliveryException | null,
  now = Date.now()
) {
  if (cases.some((item) => item.status === 'fail') || gate.status === 'fail') return false;
  const blocked = cases.some((item) => item.status === 'blocked') || gate.status === 'blocked';
  if (!blocked) return gate.status === 'pass' && cases.every((item) => item.status === 'pass');
  return Boolean(
    exception &&
      exception.status === 'active' &&
      exception.gateId === gate.id &&
      gate.exceptionId === exception.id &&
      exception.expiresAt > now
  );
}

export function evaluateDeliveryGate(
  gate: DeliveryGate,
  cases: readonly ValidationCase[],
  exception: DeliveryException | null,
  now = Date.now()
) {
  const required = gate.requiredCases.map((id) => cases.find((item) => item.id === id));
  const present = required.filter((item): item is ValidationCase => Boolean(item));
  const status: ValidationCase['status'] = required.some((item) => !item || item.status === 'blocked')
    ? 'blocked'
    : present.some((item) => item.status === 'fail')
      ? 'fail'
      : 'pass';
  const evaluatedGate = { ...gate, status };
  return {
    gateId: gate.id,
    status,
    closureAllowed: canCloseDeliveryGate(evaluatedGate, present, exception, now),
    exceptionId: status === 'blocked' && exception?.status === 'active' && exception.expiresAt > now ? exception.id : null
  };
}
