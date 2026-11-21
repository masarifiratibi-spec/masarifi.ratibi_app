import { MetaService } from '../../../src/platform/meta/meta.service';

describe('mobile social media projection', () => {
  it('reads only the social media projection under the API database role', async () => {
    const links = { instagram: 'https://instagram.com/masarifi', tiktok: '', snapchat: '' };
    const query = jest.fn((sql: string) =>
      Promise.resolve({ rows: sql.includes('read_social_media_links') ? [{ value: links }] : [] }),
    );
    const service = new MetaService(
      { get: jest.fn() } as never,
      {
        withClient: (run: (client: { query: typeof query }) => Promise<unknown>) => run({ query }),
      } as never,
    );
    await expect(service.getSocialMediaLinks()).resolves.toEqual(links);
    expect(query).toHaveBeenCalledWith('set local role masarifi_api');
    expect(query).toHaveBeenCalledWith('commit');
  });
  it('rolls back and propagates database failures', async () => {
    const failure = new Error('database unavailable');
    const query = jest.fn((sql: string) => {
      if (sql.includes('read_social_media_links')) return Promise.reject(failure);
      return Promise.resolve({ rows: [] });
    });
    const service = new MetaService(
      { get: jest.fn() } as never,
      {
        withClient: (run: (client: { query: typeof query }) => Promise<unknown>) => run({ query }),
      } as never,
    );
    await expect(service.getSocialMediaLinks()).rejects.toBe(failure);
    expect(query).toHaveBeenCalledWith('rollback');
  });
});
