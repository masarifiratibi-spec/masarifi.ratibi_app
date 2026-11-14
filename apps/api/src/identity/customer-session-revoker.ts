import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  ClerkClientService,
  ClerkProviderUnavailableError,
  ClerkSessionIneligibleError,
} from './clerk-client.service';
import { CustomerAdminRepository } from './customer-admin.repository';

export function customerSessionReference(userId: string, sessionId: string): string {
  return `sess_${createHash('sha256').update(`${userId}\0${sessionId}`).digest('hex')}`;
}

interface Command {
  id: string;
  user_id: string;
  operation: string;
  requested_at: Date;
  command: { scope?: string; sessionIds?: string[] };
  session_ids: string[] | null;
  device_id: string | null;
}

@Injectable()
export class CustomerSessionRevoker {
  constructor(
    private readonly repository: CustomerAdminRepository,
    private readonly clerk: ClerkClientService,
  ) {}

  async process(commandId?: string): Promise<boolean> {
    const command = await this.repository.withWorker(async (client) => {
      const row = (
        await client.query<Command>(
          `update private.customer_session_commands set attempts=attempts+1,retry_at=clock_timestamp()+interval '30 seconds'
        where id=(select id from private.customer_session_commands where status in ('pending','failed') and retry_at<=clock_timestamp()
          and ($1::uuid is null or id=$1) order by requested_at,id for update skip locked limit 1)
        returning id,user_id,operation,requested_at,command,session_ids,device_id`,
          [commandId ?? null],
        )
      ).rows[0];
      return row;
    });
    if (!command) return false;
    try {
      const ids = command.session_ids ?? (await this.snapshot(command));
      await this.repository.withWorker((client) =>
        client.query(
          'update private.customer_session_commands set session_ids=$2::jsonb where id=$1',
          [command.id, JSON.stringify(ids)],
        ),
      );
      for (const id of ids) await this.clerk.revokeSession(id);
      await this.repository.withWorker(async (client) => {
        await client.query(
          "update private.customer_session_commands set status='completed',response=response||jsonb_build_object('providerStatus','completed','outcome','success','message','Session revocation completed / تم إلغاء الجلسات') where id=$1",
          [command.id],
        );
        if (command.device_id)
          await client.query(
            'update public.user_devices set clerk_session_id=null where id=$1 and revoked_at is not null and clerk_session_id=any($2::text[])',
            [command.device_id, ids],
          );
      });
    } catch (error) {
      await this.repository.withWorker((client) =>
        client.query(
          "update private.customer_session_commands set status='failed',retry_at=clock_timestamp()+interval '1 minute' where id=$1 and status<>'completed'",
          [command.id],
        ),
      );
      if (
        !(error instanceof ClerkProviderUnavailableError) &&
        !(error instanceof ClerkSessionIneligibleError)
      )
        throw error;
    }
    return true;
  }

  private async snapshot(command: Command): Promise<string[]> {
    if (command.device_id)
      return this.repository.withWorker(async (client) => {
        const row = (
          await client.query<{ clerk_session_id: string | null }>(
            'select clerk_session_id from public.user_devices where id=$1 and user_id=$2 and revoked_at is not null',
            [command.device_id, command.user_id],
          )
        ).rows[0];
        return row?.clerk_session_id ? [row.clerk_session_id] : [];
      });
    const sessions = await this.clerk.listCustomerSessions(command.user_id);
    // Provider timestamps have millisecond precision; exclude an ambiguous boundary session.
    const eligible = sessions.filter((session) => session.createdAt < command.requested_at);
    if (command.command.scope !== 'selected') return eligible.map((session) => session.id);
    const requested = command.command.sessionIds ?? [];
    const selected = eligible.filter((session) =>
      requested.includes(customerSessionReference(command.user_id, session.id)),
    );
    if (selected.length !== requested.length) throw new ClerkSessionIneligibleError();
    return selected.map((session) => session.id);
  }
}
