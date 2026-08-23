import {
  canCloseDeliveryGate,
  deliveryExceptionSchema,
  deliveryGateSchema,
  evaluateDeliveryGate,
  validationCaseSchema,
  type ValidationCase
} from './delivery-validation';

const now = Date.UTC(2026, 7, 13);
const futureExpiry = Date.now() + 86_400_000;

test('ValidationCase requires reproducible, non-sensitive evidence fields', () => {
  expect(validationCaseSchema.parse(caseInput())).toMatchObject({ status: 'pass' });
  expect(validationCaseSchema.safeParse({ ...caseInput(), environment: '' }).success).toBe(false);
  expect(validationCaseSchema.safeParse({ ...caseInput(), procedure: '' }).success).toBe(false);
  expect(validationCaseSchema.safeParse({ ...caseInput(), actual: '' }).success).toBe(false);
  expect(
    validationCaseSchema.safeParse({ ...caseInput(), evidencePaths: ['C:\\raw\\secret.log'] }).success
  ).toBe(false);
});

test('blocked ValidationCase records a missing prerequisite', () => {
  expect(
    validationCaseSchema.safeParse({
      ...caseInput(),
      status: 'blocked',
      blockedBy: 'Android USB device unavailable'
    }).success
  ).toBe(true);
  expect(validationCaseSchema.safeParse({ ...caseInput(), status: 'blocked' }).success).toBe(false);
});

test('DeliveryGate and exception lifecycle block failed gates and require future expiry', () => {
  const gate = deliveryGateSchema.parse({
    id: 'android-native',
    requiredCases: ['V010-ANDROID'],
    status: 'blocked',
    exceptionId: 'EX-1'
  });
  const exception = deliveryExceptionSchema.parse({
    id: 'EX-1',
    gateId: 'android-native',
    approvedBy: 'product-owner',
    risk: 'Android TalkBack evidence missing',
    owner: 'mobile-qa',
    expiresAt: futureExpiry,
    requiredEvidence: 'TalkBack run on USB device',
    status: 'active'
  });

  expect(canCloseDeliveryGate(gate, [caseInput({ status: 'blocked', blockedBy: 'USB device' })], exception, now)).toBe(true);
  expect(() => deliveryExceptionSchema.parse({ ...exception, expiresAt: Date.now() - 1 })).toThrow();
  expect(
    canCloseDeliveryGate({ ...gate, status: 'fail' }, [caseInput({ status: 'fail' })], exception, now)
  ).toBe(false);
});

test('evaluateDeliveryGate derives status from evidence, not task markers', () => {
  const pass = caseInput({ id: 'PASS' });
  const fail = caseInput({ id: 'FAIL', status: 'fail' });
  const blocked = caseInput({ id: 'BLOCK', status: 'blocked', blockedBy: 'USB phone unavailable' });
  const gate = {
    id: 'android-native' as const,
    requiredCases: ['PASS', 'BLOCK'],
    status: 'blocked' as const,
    exceptionId: 'EX-1'
  };
  const exception = deliveryExceptionSchema.parse({
    id: 'EX-1',
    gateId: 'android-native',
    approvedBy: 'product-owner',
    risk: 'Android device evidence missing',
    owner: 'mobile-qa',
    expiresAt: futureExpiry,
    requiredEvidence: 'USB Android evidence',
    status: 'active'
  });

  expect(evaluateDeliveryGate({ ...gate, requiredCases: ['PASS'] }, [pass], null, now).status).toBe('pass');
  expect(evaluateDeliveryGate({ ...gate, requiredCases: ['PASS', 'FAIL'] }, [pass, fail], exception, now).status).toBe('fail');
  expect(evaluateDeliveryGate(gate, [pass, blocked], null, now).status).toBe('blocked');
  expect(evaluateDeliveryGate(gate, [pass, blocked], exception, now)).toMatchObject({
    status: 'blocked',
    closureAllowed: true,
    exceptionId: 'EX-1'
  });
  expect(evaluateDeliveryGate(gate, [pass, blocked], { ...exception, status: 'revoked' }, now).closureAllowed).toBe(false);
});

function caseInput(overrides: Partial<ValidationCase> = {}): ValidationCase {
  return {
    id: 'V010-AUTO',
    requirements: ['FR-055'],
    kind: 'automated',
    environment: 'Local Jest',
    procedure: 'npm test',
    expected: 'exit 0',
    actual: 'exit 0',
    status: 'pass',
    evidencePaths: ['specs/010-frontend-quality/evidence/visual/us4-automated-visual-access-matrix.md'],
    executedAt: now,
    ...overrides
  } as ValidationCase;
}
