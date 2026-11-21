import { EngagementRepository } from '../../../src/engagement/engagement.repository';
import { EngagementWorker } from '../../../src/engagement/engagement.worker';

it.each([1, 10, 100])(
  'ingests %i source events with a fixed number of database statements',
  async (count) => {
    const sources = Array.from({ length: count }, (_, index) => ({
      source_event_id: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      source_id: null,
      event_type: 'transaction.created',
      user_id: `user-${String(index)}`,
      locale: 'en',
      time_zone: 'Asia/Riyadh',
      occurred_at: '2026-09-05T07:00:00.000Z',
      expires_at: null,
    }));
    const statements: string[] = [];
    const query = (sql: string) => {
      statements.push(sql);
      if (sql.includes('from private.outbox_events o')) return Promise.resolve({ rows: sources });
      if (sql.includes('from public.notification_templates t'))
        return Promise.resolve({
          rows: sources.map((_, index) => ({
            source_index: index,
            id: 'template',
            key: 'transaction.created',
            locale: 'en',
            channel: 'in_app',
            template_version: 1,
            subject: null,
            body: 'Safe update',
            enabled: true,
            quiet_hours: {},
          })),
        });
      if (sql.includes('insert into public.notification_events'))
        return Promise.resolve({ rows: [{ id: 'notification', created_count: count }] });
      return Promise.resolve({ rows: [] });
    };
    const repository = new EngagementRepository(
      {
        withClient: async (work: (client: { query: typeof query }) => Promise<unknown>) =>
          work({ query }),
      } as never,
      {} as never,
    );
    const worker = new EngagementWorker(
      repository,
      {} as never,
      {} as never,
      {
        getRequired: () => 100,
      } as never,
    );

    await expect(worker.runJob('source.consume')).resolves.toBe(count);
    const dataStatements = statements.filter(
      (sql) => !/^(begin|commit|rollback|set local role|select set_config)/.test(sql),
    );
    expect(dataStatements).toHaveLength(4);
  },
);
