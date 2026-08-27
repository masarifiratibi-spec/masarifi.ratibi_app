export type PlatformEventName = 'platform.started' | 'platform.ready';

export interface PlatformEventFields {
  processKind?: 'api' | 'worker' | 'migration';
  version?: string;
  state?: 'ready' | 'not_ready';
}

export interface PlatformEvent extends PlatformEventFields {
  schemaVersion: 1;
  name: PlatformEventName;
}

const allowedFields = new Set(['processKind', 'version', 'state']);

export function platformEvent(name: PlatformEventName, fields: PlatformEventFields): PlatformEvent {
  if (Object.keys(fields).some((key) => !allowedFields.has(key))) {
    throw new Error('PLATFORM_EVENT_FIELD_INVALID');
  }
  return { schemaVersion: 1, name, ...fields };
}
