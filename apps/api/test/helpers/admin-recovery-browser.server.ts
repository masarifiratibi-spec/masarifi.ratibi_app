import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PoolService } from '../../src/platform/database/pool.service';
import type { PlatformConfigService } from '../../src/platform/config/platform-config.service';
import { ClerkAuthGuard } from '../../src/identity/clerk-auth.guard';
import type { ClerkClientService } from '../../src/identity/clerk-client.service';
import { AdminAuthGuard } from '../../src/security/admin-auth.guard';
import { SecurityController } from '../../src/security/security.controller';
import { SecurityRepository } from '../../src/security/security.repository';
import { SecurityService } from '../../src/security/security.service';
import { CustomerAdminController } from '../../src/identity/customer-admin.controller';
import { CustomerAdminRepository } from '../../src/identity/customer-admin.repository';
import { CustomerAdminService } from '../../src/identity/customer-admin.service';
import {
  EngagementController,
  EngagementAdminController,
} from '../../src/engagement/engagement.controller';
import { EngagementRepository } from '../../src/engagement/engagement.repository';
import { EngagementService } from '../../src/engagement/engagement.service';
import { ReportsAdminController } from '../../src/reports/reports.admin.controller';
import { ReportsRepository } from '../../src/reports/reports.repository';
import { ReportsService } from '../../src/reports/reports.service';

// Test-only identity/provider boundary. Product controllers, services and SQL remain real.
// Never use this process with a hosted database, production identity, or public listener.
const admin = 'demo-admin';
const owner = 'user_recovery_browser_owner';
const database = new URL(process.env.DATABASE_URL ?? '');
if (
  process.env.MASARIFI_RECOVERY_HTTP_TEST !== '1' ||
  database.hostname !== '127.0.0.1' ||
  database.port !== '55442' ||
  database.pathname !== '/admin_recovery_browser'
)
  throw new Error('RECOVERY_DISPOSABLE_DATABASE_REQUIRED');

const values: Record<string, unknown> = {
  DATABASE_URL: database.toString(),
  MASARIFI_DATABASE_POOL_MAX: 5,
  MASARIFI_RECENT_AUTH_MAX_AGE_SECONDS: 600,
  MASARIFI_SUPPORT_REOPEN_HOURS: 48,
  MASARIFI_CAMPAIGN_APPROVAL_THRESHOLD: 100,
  MASARIFI_MOBILE_AUTOMATION_ENABLED: false,
  MASARIFI_SECURITY_IP_HASH_KEYS: `recovery:${Buffer.alloc(32, 3).toString('base64url')}`,
};
const config = {
  get: (key: string) => values[key],
  getRequired: (key: string) => {
    if (values[key] === undefined) throw new Error(`RECOVERY_CONFIG_MISSING:${key}`);
    return values[key];
  },
} as unknown as PlatformConfigService;

async function main() {
  const seed = new PoolService(config);
  await seed.query(
    `insert into public.profiles(id,display_name,locale,primary_email) values
    ($1,'Recovery test admin','en',null),($2,'Browser customer','en','browser@example.test') on conflict(id) do nothing`,
    [admin, owner],
  );
  await seed.query(
    "insert into public.admin_profiles(user_id,status) values($1,'active') on conflict(user_id) do nothing",
    [admin],
  );
  await seed.query(
    `insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
    select $1,id,$1,'Recovery browser fixture' from public.roles where key='super-admin'
    and not exists(select 1 from public.admin_role_assignments a where a.user_id=$1 and a.role_id=roles.id and a.revoked_at is null)`,
    [admin],
  );
  for (let index = 0; index < 27; index++)
    await seed.query(
      "insert into public.profiles(id,display_name,locale,created_at) values($1,$2,'en',clock_timestamp()-make_interval(days=>$3)) on conflict(id) do nothing",
      [
        `user_recovery_browser_${String(index)}`,
        `Browser customer ${String(index)}`,
        index === 26 ? 20 : 0,
      ],
    );
  await seed.query(
    "insert into public.support_categories(key,name) values('recovery_browser','Browser support') on conflict(key) do nothing",
  );
  await seed.query(
    `insert into public.support_tickets(user_id,category_id,subject,priority)
    select $1,c.id,'Browser pagination '||n,case when n=26 then 'urgent' else 'normal' end
    from public.support_categories c cross join generate_series(1,27) n where c.key='recovery_browser'
    and not exists(select 1 from public.support_tickets t where t.user_id=$1 and t.subject='Browser pagination '||n)`,
    [owner],
  );
  await seed.query(
    `update public.support_tickets set last_message_at=clock_timestamp()-make_interval(secs=>substring(subject from '[0-9]+$')::int)
    where user_id=$1 and subject ~ '^Browser pagination [0-9]+$'`,
    [owner],
  );
  await seed.onModuleDestroy();

  const pool = new PoolService(config);
  const withClient = pool.withClient.bind(pool);
  pool.withClient = (action) =>
    withClient(async (client) => {
      // The runtime connection cannot assume a sibling worker/migration role.
      await client.query('set session authorization masarifi_api');
      return action(client);
    });
  const disabled = new Proxy(
    {},
    {
      get() {
        return () => Promise.reject(new Error('RECOVERY_EXTERNAL_EFFECT_DISABLED'));
      },
    },
  );
  const clerk = {
    countActiveSessions: () => Promise.resolve(0),
    listCustomerSessions: () => Promise.resolve([]),
    getIdentityUser: (id: string) => Promise.resolve({ id, primaryEmailVerified: true }),
  } as unknown as ClerkClientService;
  const securityRepository = new SecurityRepository(pool);
  const security = new SecurityService(
    securityRepository,
    config,
    clerk,
    disabled as never,
    disabled as never,
  );
  const customer = new CustomerAdminService(new CustomerAdminRepository(pool), clerk, config);
  const engagement = new EngagementService(
    new EngagementRepository(pool, config),
    disabled as never,
    securityRepository,
  );
  const reports = new ReportsService(new ReportsRepository(pool, config), undefined, config, clerk);
  const identity = {
    canActivate(context: ExecutionContext) {
      const incoming = context
        .switchToHttp()
        .getRequest<{
          headers: Record<string, string | undefined>;
          clerkPrincipal?: { userId: string; sessionId: string; factorAgeSeconds: number };
          requestId?: string;
        }>();
      if (incoming.headers.authorization !== 'Bearer recovery-test-principal') return false;
      const actor = incoming.headers['x-recovery-actor'] ?? admin;
      if (![admin, owner].includes(actor)) return false;
      incoming.clerkPrincipal = {
        userId: actor,
        sessionId: 'recovery-browser-session',
        factorAgeSeconds: 10,
      };
      incoming.requestId = randomUUID();
      return true;
    },
  };
  const module = await Test.createTestingModule({
    controllers: [
      SecurityController,
      CustomerAdminController,
      EngagementController,
      EngagementAdminController,
      ReportsAdminController,
    ],
    providers: [
      { provide: SecurityService, useValue: security },
      { provide: CustomerAdminService, useValue: customer },
      { provide: EngagementService, useValue: engagement },
      { provide: ReportsService, useValue: reports },
      {
        provide: (await import('../../src/platform/config/platform-config.service'))
          .PlatformConfigService,
        useValue: config,
      },
    ],
  })
    .overrideGuard(ClerkAuthGuard)
    .useValue(identity)
    .overrideGuard(AdminAuthGuard)
    .useValue(identity)
    .compile();
  const app = module.createNestApplication();
  app.getHttpAdapter().get('/__recovery/ready', (_request: Request, response: Response) => {
    response.json({ ready: true, boundary: 'local-recovery' });
  });
  await app.listen(Number(process.env.MASARIFI_RECOVERY_API_PORT ?? 43169), '127.0.0.1');
  process.stdout.write('RECOVERY_API_READY\n');
  const close = () => {
    void app
      .close()
      .then(() => pool.onModuleDestroy())
      .then(() => process.exit(0));
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'RECOVERY_SERVER_FAILED'}\n`);
  process.exitCode = 1;
});
