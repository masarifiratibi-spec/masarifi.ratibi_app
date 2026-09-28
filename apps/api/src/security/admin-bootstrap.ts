import { createClerkClient } from '@clerk/backend';
import { Pool } from 'pg';

import { containsControlCharacter } from './security.dto';
import { buildSecurityEventPayload } from './security.events';

export interface AdminBootstrapInput {
  userId: string;
  email: string;
  reason: string;
}

export interface AdminBootstrapIdentity {
  id: string;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  banned: boolean;
  locked: boolean;
}

function argument(argv: readonly string[], name: string): string {
  const index = argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error('ADMIN_BOOTSTRAP_ARGUMENT_INVALID');
  return value;
}

export function parseBootstrapArgs(argv: readonly string[]): AdminBootstrapInput {
  const input = {
    userId: argument(argv, 'user-id'),
    email: argument(argv, 'email'),
    reason: argument(argv, 'reason'),
  };
  if (
    !/^user_[A-Za-z0-9_-]{1,123}$/.test(input.userId) ||
    input.email.length > 320 ||
    input.email !== input.email.trim().toLowerCase() ||
    !/^[^\s@]+@[^\s@]+$/.test(input.email) ||
    input.reason.trim() !== input.reason ||
    containsControlCharacter(input.reason) ||
    input.reason.length < 10 ||
    input.reason.length > 500
  ) {
    throw new Error('ADMIN_BOOTSTRAP_ARGUMENT_INVALID');
  }
  return input;
}

export function assertBootstrapIdentity(
  input: AdminBootstrapInput,
  identity: AdminBootstrapIdentity,
): void {
  if (
    identity.id !== input.userId ||
    identity.primaryEmail !== input.email ||
    !identity.primaryEmailVerified ||
    identity.banned ||
    identity.locked
  ) {
    throw new Error('ADMIN_BOOTSTRAP_IDENTITY_INELIGIBLE');
  }
}

async function getBootstrapIdentity(
  secretKey: string,
  userId: string,
): Promise<AdminBootstrapIdentity> {
  const user = await createClerkClient({
    secretKey,
    telemetry: { disabled: true, debug: false, samplingRate: 0 },
  }).users.getUser(userId);
  const primaryEmail = user.emailAddresses.find(
    (entry) => entry.id === user.primaryEmailAddressId,
  );
  return {
    id: user.id,
    primaryEmail: primaryEmail?.emailAddress.trim().toLowerCase() ?? null,
    primaryEmailVerified: primaryEmail?.verification?.status === 'verified',
    banned: user.banned,
    locked: user.locked,
  };
}

export async function bootstrapAdmin(
  pool: Pool,
  input: AdminBootstrapInput,
): Promise<{ assignmentId: string }> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('masarifi:first-super-admin',0))",
    );
    const unavailable = await client.query<{ unavailable: boolean }>(`select (
      exists(select 1 from private.owner_bootstrap_state) or exists(
      select 1 from public.admin_role_assignments a join public.roles r on r.id=a.role_id
      join public.admin_profiles p on p.user_id=a.user_id
      where p.status='active' and r.key='super-admin' and r.enabled and a.revoked_at is null
        and a.starts_at<=clock_timestamp() and (a.ends_at is null or a.ends_at>clock_timestamp())
      )) as unavailable`);
    if (unavailable.rows[0]?.unavailable) throw new Error('ADMIN_BOOTSTRAP_ALREADY_CONSUMED');
    const profile = await client.query<{ id: string; primary_email: string }>(
      "select id,primary_email from public.profiles where id=$1 and status='active' and primary_email=$2",
      [input.userId, input.email],
    );
    if (!profile.rows[0]) throw new Error('ADMIN_BOOTSTRAP_PROFILE_MISMATCH');
    await client.query(
      `insert into public.admin_profiles(user_id,status) values($1,'active') on conflict(user_id) do update set status='active'`,
      [input.userId],
    );
    const assignment = await client.query<{ id: string; role_id: string }>(
      `insert into public.admin_role_assignments(user_id,role_id,assigned_by,reason)
      select $1,id,$1,$2 from public.roles where key='super-admin' and enabled returning id,role_id`,
      [input.userId, input.reason],
    );
    const row = assignment.rows[0];
    if (!row) throw new Error('ADMIN_BOOTSTRAP_ROLE_MISSING');
    const requestId = `bootstrap:${row.id}`;
    await client.query(
      'insert into private.owner_bootstrap_state(singleton,user_id,assignment_id) values(true,$1,$2)',
      [input.userId, row.id],
    );
    await client.query(
      `select audit.append_event($1,'system','admin.bootstrap_completed','admin_assignment',$2,null,null,$3,$4,$5)`,
      [
        input.userId,
        row.id,
        input.reason,
        requestId,
        JSON.stringify({ procedure: 'one-time-owner-bootstrap' }),
      ],
    );
    await client.query(
      `select private.enqueue_outbox_event('admin.role_assigned','admin_assignment',$1,$2)`,
      [
        row.id,
        JSON.stringify(
          buildSecurityEventPayload('admin.role_assigned', {
            adminId: input.userId,
            roleId: row.role_id,
            assignmentId: row.id,
            occurredAt: new Date().toISOString(),
            requestId,
          }),
        ),
      ],
    );
    await client.query('commit');
    return { assignmentId: row.id };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  if (process.env.MASARIFI_ADMIN_ROUTES_ENABLED === 'true')
    throw new Error('ADMIN_BOOTSTRAP_REQUIRES_DISABLED_ROUTES');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('ADMIN_BOOTSTRAP_DATABASE_MISSING');
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) throw new Error('ADMIN_BOOTSTRAP_CLERK_SECRET_MISSING');
  const input = parseBootstrapArgs(process.argv.slice(2));
  assertBootstrapIdentity(input, await getBootstrapIdentity(clerkSecretKey, input.userId));
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const result = await bootstrapAdmin(pool, input);
    process.stdout.write(`ADMIN_BOOTSTRAP_CREATED:${result.assignmentId}\n`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main().catch(() => {
    process.stderr.write('ADMIN_BOOTSTRAP_FAILED\n');
    process.exitCode = 1;
  });
}
