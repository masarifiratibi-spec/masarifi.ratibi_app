import { AiGateway } from '../src/ai/ai.gateway';

export function createTestGateway(
  options: Omit<ConstructorParameters<typeof AiGateway>[0], 'circuit'>,
) {
  return new AiGateway({
    circuit: {
      acquireCircuit: () => Promise.resolve('test-token'),
      finishCircuit: () => Promise.resolve(),
    },
    ...options,
  });
}
